import { Client } from 'pg'

// Synthetic data stays in a connection-local temporary table. Never load env files
// or benchmark hosted data; TEST_DATABASE_URL must explicitly target local tests.
const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
const target = new URL(url)
if (
  !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname) ||
  !target.pathname.endsWith('_test')
) {
  throw new Error(
    'History benchmarks require a local database ending in _test.',
  )
}
interface PlanNode {
  'Node Type': string
  'Actual Rows': number
  'Rows Removed by Filter'?: number
  'Local Hit Blocks'?: number
  'Index Name'?: string
  Plans?: Array<PlanNode>
}
interface Explain {
  Plan: PlanNode
  'Execution Time': number
}
const flatten = (plan: PlanNode): Array<PlanNode> => [
  plan,
  ...(plan.Plans ?? []).flatMap(flatten),
]
let transactionStarted = false
const client = new Client({
  connectionString: url,
  connectionTimeoutMillis: 10000,
})
try {
  await client.connect()
  await client.query('begin')
  transactionStarted = true
  await client.query(`create temporary table memorization_history_bench
    (like memorization_assignments including all) on commit drop`)
  for (const count of [100, 1000, 10000]) {
    await client.query('truncate memorization_history_bench')
    await client.query(
      `
      insert into memorization_history_bench
        (id, student_id, surah_number, status, assigned_at, due_at, closed_at, closing_grade)
      select md5(student || ':' || n)::uuid::text, student, n % 114 + 1,
        (case when n % 10 = 0 then 'cancelled' else 'closed' end)::review_status,
        '2026-11-01'::timestamptz - n * interval '1 minute',
        '2026-11-07'::timestamptz,
        '2026-11-07'::timestamptz - (n / 3) * interval '1 minute',
        (case when n % 10 = 0 then null else 'medium' end)::surah_grade
      from (
        select 'target' as student, generate_series(1, $1::int) as n
        union all
        select 'other-' || student, n from generate_series(1, 99) student
          cross join generate_series(1, 100) n
      ) fixtures`,
      [count],
    )
    await client.query('analyze memorization_history_bench')
    const cursor = (
      await client.query<{ closed_at: Date; id: string }>(
        `
      select closed_at, id from memorization_history_bench where student_id = 'target'
      order by closed_at desc, id desc offset $1 limit 1`,
        [Math.floor(count * 0.9)],
      )
    ).rows[0]
    for (const indexed of [false, true]) {
      if (indexed)
        await client.query(`create index memorization_history_candidate_idx
        on memorization_history_bench (student_id, closed_at desc, id desc)
        where status in ('closed', 'cancelled')`)
      const bytes = indexed
        ? Number(
            (
              await client.query<{ bytes: string }>(
                "select pg_relation_size('memorization_history_candidate_idx')::text as bytes",
              )
            ).rows[0].bytes,
          )
        : 0
      for (const status of ['all', 'closed', 'cancelled']) {
        for (const page of ['first', 'late']) {
          // Same projection, status predicate, OR cursor and ordering as the service.
          const filter =
            status === 'all'
              ? "status in ('closed', 'cancelled')"
              : `status = '${status}'`
          const sql = `explain (analyze, buffers, format json)
            select id, surah_number, status, assigned_at, due_at, closed_at, closing_grade
            from memorization_history_bench where student_id = 'target' and ${filter}
            ${page === 'late' ? 'and (closed_at < $1 or (closed_at = $1 and id < $2))' : ''}
            order by closed_at desc, id desc limit 21`
          const times: Array<number> = []
          let plan: PlanNode | undefined
          for (let sample = 0; sample < 8; sample++) {
            const result = await client.query<{ 'QUERY PLAN': Array<Explain> }>(
              sql,
              page === 'late' ? [cursor.closed_at, cursor.id] : [],
            )
            const explanation = result.rows[0]['QUERY PLAN'][0]
            if (sample > 0) times.push(explanation['Execution Time'])
            plan = explanation.Plan
          }
          times.sort((a, b) => a - b)
          const nodes = plan ? flatten(plan) : []
          console.log(
            JSON.stringify({
              count,
              totalRows: count + 9900,
              indexed,
              status,
              page,
              medianMs: times[3],
              indexBytes: bytes,
              sort: nodes.some((node) => node['Node Type'].includes('Sort')),
              scans: nodes
                .filter((node) => node['Node Type'].includes('Scan'))
                .map((node) => ({
                  type: node['Node Type'],
                  index: node['Index Name'],
                  rows: node['Actual Rows'],
                  removed: node['Rows Removed by Filter'] ?? 0,
                })),
              localHitBlocks: plan?.['Local Hit Blocks'],
            }),
          )
        }
      }
      if (indexed)
        await client.query('drop index memorization_history_candidate_idx')
    }
  }
} finally {
  // Rollback also removes temporary fixtures/indexes after partial failures.
  try {
    if (transactionStarted) await client.query('rollback')
  } finally {
    await client.end()
  }
}
