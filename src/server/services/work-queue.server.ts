import { sql } from 'drizzle-orm'
import { requireStaff } from '../auth-guards.server'
import { memorizationAssignments, reviews } from '../db/schema/app'
import { user } from '../db/schema/auth'
import { workQueueInput } from '../functions/validation'
import type { Actor } from '../auth-guards.server'
import type { Database } from '../db.server'
import type { WorkPage, WorkRow } from '~/lib/work-queue'

export async function listWorkQueue(
  db: Database,
  actor: Actor | null,
  input: unknown,
  now = new Date(),
): Promise<WorkPage> {
  requireStaff(actor)
  const { q, kind, deadline, cursor } = workQueueInput.parse(input)
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  )
  const start = new Date(today).toISOString()
  const tomorrow = new Date(today + 86400000).toISOString()
  const pattern = `%${q.replace(/[\\%_]/g, '\\$&')}%`
  const deadlineWhere = {
    all: sql`true`,
    overdue: sql`w.due_at < ${start}::timestamptz`,
    today: sql`w.due_at >= ${start}::timestamptz and w.due_at < ${tomorrow}::timestamptz`,
    upcoming: sql`w.due_at >= ${tomorrow}::timestamptz`,
    undated: sql`w.due_at is null`,
  }[deadline]
  const tie = cursor
    ? sql`(w.kind, w.id) > (${cursor.kind}::text, ${cursor.id}::text)`
    : sql`true`
  const after = !cursor
    ? sql`true`
    : cursor.dueAt === null
      ? sql`w.due_at is null and ${tie}`
      : sql`(w.due_at > ${new Date(cursor.dueAt).toISOString()}::timestamptz
        or w.due_at is null
        or (w.due_at = ${new Date(cursor.dueAt).toISOString()}::timestamptz and ${tie}))`
  const result = await db.execute<WorkRow & Record<string, unknown>>(sql`
    with work as (
      select id, student_id, surah_number, due_at, 'review'::text as kind
      from ${reviews} where status = 'open'
      union all
      select id, student_id, surah_number, due_at, 'memorization'::text as kind
      from ${memorizationAssignments} where status = 'open'
    )
    select w.id, w.kind, w.student_id as "studentId", w.surah_number as "surahNumber",
      (extract(epoch from w.due_at) * 1000)::float8 as "dueAt",
      u.name as "displayName", coalesce(u.username, '') as username
    from work w join ${user} u on u.id = w.student_id
    where u.banned = false and 'student' = any(string_to_array(u.role, ','))
      and (${kind} = 'all' or w.kind = ${kind})
      and (u.name ilike ${pattern} or coalesce(u.username, '') ilike ${pattern})
      and (${deadlineWhere}) and (${after})
    order by w.due_at asc nulls last, w.kind asc, w.id asc
    limit 21
  `)
  const rows = result.rows.slice(0, 20)
  const last = rows.at(-1)
  return {
    rows,
    nextCursor:
      result.rows.length > 20 && last
        ? { dueAt: last.dueAt, kind: last.kind, id: last.id }
        : null,
  }
}
