import { eq } from 'drizzle-orm'
import { withDatabase } from '../src/server/db.server'
import { createAccount } from '../src/server/services/accounts.server'
import { user } from '../src/server/db/schema/auth'
import { grades, notes, reviews } from '../src/server/db/schema/app'
import type { AppRole } from '../src/server/accounts'

const url = process.env.DATABASE_URL
const password = process.env.DEV_SEED_PASSWORD
if (!url || !password)
  throw new Error('DATABASE_URL and DEV_SEED_PASSWORD are required.')
const target = new URL(url)
if (
  !['localhost', '127.0.0.1'].includes(target.hostname) ||
  process.env.NODE_ENV === 'production'
)
  throw new Error('Development seed is restricted to local PostgreSQL.')
await withDatabase(url, async (db) => {
  const accounts: Array<{
    username: string
    displayName: string
    role: AppRole
  }> = [
    { username: 'qa.admin.oct13', displayName: 'مشرف الاختبار', role: 'admin' },
    {
      username: 'qa.teacher.oct13',
      displayName: 'معلم الاختبار',
      role: 'teacher',
    },
    {
      username: 'qa.student.oct13',
      displayName: 'طالب الاختبار',
      role: 'student',
    },
  ]
  const ids: Record<string, string> = {}
  for (const value of accounts) {
    const existing = (
      await db.select().from(user).where(eq(user.username, value.username))
    ).at(0)
    ids[value.role] =
      existing?.id ??
      (
        await createAccount(db, { ...value, email: null, password }, [
          value.role,
        ])
      ).id
    console.log(`Available local ${value.role}: ${value.username}`)
  }
  await db
    .insert(grades)
    .values({
      id: 'seed-grade',
      studentId: ids.student,
      surahNumber: 1,
      grade: 'medium',
      updatedBy: ids.teacher,
      updatedAt: new Date(),
    })
    .onConflictDoNothing()
  await db
    .insert(reviews)
    .values({
      id: 'seed-review',
      studentId: ids.student,
      surahNumber: 1,
      assignedBy: ids.teacher,
      assignedAt: new Date(),
      dueAt: new Date(Date.now() + 86400000),
    })
    .onConflictDoNothing()
  await db
    .insert(notes)
    .values({
      id: 'seed-note',
      studentId: ids.student,
      authorId: ids.teacher,
      body: 'واصل المراجعة يومياً.',
      createdAt: new Date(),
    })
    .onConflictDoNothing()
})
