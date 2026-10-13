import { sql } from 'drizzle-orm'
import { withDatabase } from '../src/server/db.server'

const url = process.env.DATABASE_URL
if (!url)
  throw new Error(
    'DATABASE_URL is required for the hosted database smoke check.',
  )
const target = new URL(url)
if (target.hostname.includes('-pooler'))
  throw new Error(
    'Use the direct Neon connection for this transaction smoke check.',
  )

await withDatabase(url, async (db) => {
  const result = await db.execute(
    sql`select current_database() as database, version() as version`,
  )
  console.log('Connected to PostgreSQL:', result.rows[0].database)
  // A temporary table is connection-local; the deliberate error must roll back its writes.
  await db.execute(
    sql`create temporary table migration_smoke (value integer not null)`,
  )
  await db.transaction(async (tx) => {
    await tx.execute(sql`insert into migration_smoke values (1), (2)`)
  })
  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`insert into migration_smoke values (3)`)
      throw new Error('expected smoke rollback')
    })
  } catch (error) {
    if (
      !(error instanceof Error) ||
      error.message !== 'expected smoke rollback'
    )
      throw error
  }
  const count = await db.execute(
    sql`select count(*)::integer as count from migration_smoke`,
  )
  if (count.rows[0].count !== 2) throw new Error('Transaction rollback failed.')
  const tables = await db.execute(
    sql`select count(*)::integer as count from information_schema.tables where table_schema = 'public' and table_name in ('user', 'session', 'account', 'verification', 'student_surah_grades', 'surah_review_assignments', 'student_notes', 'password_reset_codes')`,
  )
  if (tables.rows[0].count !== 8)
    throw new Error(
      'Apply the committed migration before running this smoke check.',
    )
  console.log(
    'Commit, rollback and all eight migration tables verified. No persistent test data created.',
  )
})
