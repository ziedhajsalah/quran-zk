import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { and, eq, getTableColumns, sql } from 'drizzle-orm'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { getAuthTables } from '@better-auth/core/db'
import { withDatabase } from '../../src/server/db.server'
import * as authSchema from '../../src/server/db/schema/auth'
import { account, session, user } from '../../src/server/db/schema/auth'
import { notes, resetCodes } from '../../src/server/db/schema/app'
import { createAuth } from '../../src/server/auth.server'
import { getActor } from '../../src/server/auth-guards.server'
import {
  createAccount,
  staffCreateStudent,
  updateAccount,
} from '../../src/server/services/accounts.server'
import {
  listGrades,
  listStudents,
  removeGrade,
  setGrade,
} from '../../src/server/services/grades.server'
import {
  assignReview,
  finishReview,
  listReviews,
} from '../../src/server/services/reviews.server'
import {
  addNote,
  editNote,
  listNotes,
  removeNote,
} from '../../src/server/services/notes.server'
import {
  issueCode,
  redeemCode,
} from '../../src/server/services/reset-codes.server'
import { serializeUser } from '../../src/server/accounts'
import type { Actor } from '../../src/server/auth-guards.server'
import type { Database } from '../../src/server/db.server'

const url =
  process.env.TEST_DATABASE_URL ??
  'postgresql://quran_dev:quran_local@127.0.0.1:55432/quran_test'
if (!new URL(url).pathname.endsWith('_test'))
  throw new Error('TEST_DATABASE_URL must end in _test; tests erase its data.')
const config = {
  SITE_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: 'integration-test-secret-at-least-32-characters',
}
const dbRun = <T>(run: (db: Database) => Promise<T>) => withDatabase(url, run)
let admin: Actor, teacher: Actor, student: Actor, other: Actor
const password = 'TestPassword-2026!'
beforeAll(async () => {
  await dbRun((db) => migrate(db, { migrationsFolder: './drizzle' }))
})
beforeEach(async () => {
  await dbRun(async (db) => {
    await db.execute(sql`truncate "user", auth_rate_limits cascade`)
    for (const [id, role] of [
      ['admin', 'admin'],
      ['teacher', 'teacher'],
      ['student', 'student'],
      ['other', 'student'],
    ]) {
      await db.insert(user).values({
        id,
        name: id,
        username: id,
        email: `${id}@example.com`,
        role,
      })
    }
    const users = await db.select().from(user)
    const actors = Object.fromEntries(
      users.map((row) => [row.id, serializeUser(row)]),
    )
    admin = actors.admin
    teacher = actors.teacher
    student = actors.student
    other = actors.other
  })
})

describe('schema and transaction runtime', () => {
  it('matches every field in the installed Better Auth schema, including enabled plugins', async () => {
    await dbRun(async (db) => {
      const auth = createAuth(db, config)
      await auth.$context
      const blocked = await auth.handler(
        new Request(`${config.SITE_URL}/api/auth/admin/set-role`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: config.SITE_URL,
          },
          body: JSON.stringify({ userId: 'admin', role: 'student' }),
        }),
      )
      expect(blocked.status).toBe(404)
      const tables = getAuthTables(auth.options)
      for (const [name, table] of Object.entries(tables)) {
        const columns = getTableColumns(
          authSchema[name as keyof typeof authSchema],
        )
        for (const field of Object.keys(table.fields))
          expect(columns, `${name}.${field}`).toHaveProperty(field)
      }
    })
  })
  it('commits multiple writes and rolls back on failure', async () => {
    await dbRun(async (db) => {
      await expect(
        db.transaction(async (tx) => {
          await tx.insert(notes).values({
            id: 'rollback',
            studentId: student.id,
            authorId: teacher.id,
            body: 'note',
            createdAt: new Date(),
          })
          throw new Error('forced failure')
        }),
      ).rejects.toThrow('forced failure')
      expect(await db.select().from(notes)).toHaveLength(0)
      await db.transaction(async (tx) => {
        await tx.insert(notes).values({
          id: 'commit',
          studentId: student.id,
          authorId: teacher.id,
          body: 'note',
          createdAt: new Date(),
        })
        await tx
          .update(user)
          .set({ name: 'updated' })
          .where(eq(user.id, student.id))
      })
      expect(await db.select().from(notes)).toHaveLength(1)
    })
  })
  it('rejects invalid surahs and foreign keys', async () => {
    await expect(
      dbRun((db) =>
        setGrade(db, teacher, {
          studentId: student.id,
          surahNumber: 115,
          grade: 'good',
        }),
      ),
    ).rejects.toThrow()
    await expect(
      dbRun((db) =>
        db.insert(notes).values({
          id: 'orphan',
          studentId: 'missing',
          body: 'note',
          createdAt: new Date(),
        }),
      ),
    ).rejects.toThrow()
  })
})

describe('auth and account permissions', () => {
  it('creates normalized credentials compatible with username and email login, rejects public signup', async () => {
    await dbRun(async (db) => {
      const created = await staffCreateStudent(db, teacher, {
        username: ' New.Student ',
        displayName: 'طالب جديد',
        email: null,
        password,
      })
      expect(created.username).toBe('new.student')
      expect(created.roles).toEqual(['student'])
      const auth = createAuth(db, config)
      const response = await auth.handler(
        new Request(`${config.SITE_URL}/api/auth/sign-in/username`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: config.SITE_URL,
          },
          body: JSON.stringify({ username: 'NEW.STUDENT', password }),
        }),
      )
      expect(response.status).toBe(200)
      const cookies = response.headers.get('set-cookie')!.split(';')[0]
      expect(
        (await getActor(db, auth, new Headers({ cookie: cookies })))?.id,
      ).toBe(created.id)
      await updateAccount(db, admin, {
        userId: created.id,
        status: 'disabled',
      })
      expect(
        await getActor(db, auth, new Headers({ cookie: cookies })),
      ).toBeNull()
      const signup = await auth.handler(
        new Request(`${config.SITE_URL}/api/auth/sign-up/email`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: config.SITE_URL,
          },
          body: JSON.stringify({
            email: 'public@example.com',
            name: 'public',
            password,
          }),
        }),
      )
      expect(signup.status).toBeGreaterThanOrEqual(400)
    })
  })
  it('rejects unauthorized creation, duplicate canonical usernames and writes to nonstudents', async () => {
    const input = {
      username: 'new.student',
      displayName: 'test',
      email: null,
      password,
    }
    await expect(
      dbRun((db) => staffCreateStudent(db, student, input)),
    ).rejects.toThrow('غير مصرح')
    await dbRun((db) => staffCreateStudent(db, teacher, input))
    await expect(
      dbRun((db) =>
        staffCreateStudent(db, teacher, { ...input, username: 'NEW.STUDENT' }),
      ),
    ).rejects.toThrow()
    await expect(
      dbRun((db) =>
        setGrade(db, teacher, {
          studentId: teacher.id,
          surahNumber: 1,
          grade: 'good',
        }),
      ),
    ).rejects.toThrow()
  })
  it('serializes simultaneous demotions and retains the last active admin', async () => {
    await dbRun((db) =>
      db.update(user).set({ role: 'admin' }).where(eq(user.id, teacher.id)),
    )
    const outcomes = await Promise.allSettled([
      dbRun((db) =>
        updateAccount(db, admin, { userId: admin.id, roles: ['student'] }),
      ),
      dbRun((db) =>
        updateAccount(db, admin, { userId: teacher.id, status: 'disabled' }),
      ),
    ])
    expect(
      outcomes.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    const remaining = await dbRun((db) =>
      db
        .select()
        .from(user)
        .where(and(eq(user.role, 'admin'), eq(user.banned, false))),
    )
    expect(remaining).toHaveLength(1)
  })
  it('bootstrap refuses existing users', async () => {
    await expect(
      dbRun((db) =>
        createAccount(
          db,
          { username: 'bootstrap', displayName: 'test', email: null, password },
          ['admin'],
          true,
        ),
      ),
    ).rejects.toThrow('Bootstrap')
  })
})

describe('grades, reviews, and notes', () => {
  it('isolates student reads and permissions, concurrent upserts stay unique', async () => {
    await expect(dbRun((db) => listStudents(db, student))).rejects.toThrow()
    await expect(
      dbRun((db) => listGrades(db, student, other.id)),
    ).rejects.toThrow()
    await expect(
      dbRun((db) =>
        setGrade(db, student, {
          studentId: student.id,
          surahNumber: 1,
          grade: 'good',
        }),
      ),
    ).rejects.toThrow()
    await Promise.all(
      ['good', 'medium'].map((grade) =>
        dbRun((db) =>
          setGrade(db, teacher, {
            studentId: student.id,
            surahNumber: 1,
            grade: grade as 'good' | 'medium',
          }),
        ),
      ),
    )
    expect(
      await dbRun((db) => listGrades(db, student, student.id)),
    ).toHaveLength(1)
    await expect(
      dbRun((db) =>
        removeGrade(db, teacher, { studentId: student.id, surahNumber: 1 }),
      ),
    ).rejects.toThrow()
  })
  it('requires an existing grade and rejects duplicate assignments under race', async () => {
    await expect(
      dbRun((db) =>
        assignReview(db, teacher, { studentId: student.id, surahNumber: 1 }),
      ),
    ).rejects.toThrow()
    await dbRun((db) =>
      setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'good',
      }),
    )
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        dbRun((db) =>
          assignReview(db, teacher, { studentId: student.id, surahNumber: 1 }),
        ),
      ),
    )
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
  })
  it('only one simultaneous close/cancel succeeds and snapshots closing grade', async () => {
    await dbRun((db) =>
      setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'good',
      }),
    )
    await dbRun((db) =>
      assignReview(db, teacher, { studentId: student.id, surahNumber: 1 }),
    )
    const [row] = await dbRun((db) => listReviews(db, teacher, student.id))
    const results = await Promise.allSettled([
      dbRun((db) =>
        finishReview(db, teacher, { assignmentId: row.id, newGrade: 'medium' }),
      ),
      dbRun((db) => finishReview(db, teacher, { assignmentId: row.id }, true)),
    ])
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(
      await dbRun((db) => listReviews(db, student, student.id)),
    ).toHaveLength(0)
  })
  it('rolls back a grade change if closing the review fails', async () => {
    await dbRun(async (db) => {
      await setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'good',
      })
      await assignReview(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
      })
      const [row] = await listReviews(db, teacher, student.id)
      await db.execute(
        sql`create or replace function test_review_failure() returns trigger language plpgsql as $$ begin raise exception 'forced close failure'; end $$`,
      )
      await db.execute(
        sql`create trigger test_review_failure before update on surah_review_assignments for each row execute function test_review_failure()`,
      )
      try {
        await expect(
          finishReview(db, teacher, {
            assignmentId: row.id,
            newGrade: 'medium',
          }),
        ).rejects.toThrow()
        expect((await listGrades(db, teacher, student.id))[0].grade).toBe(
          'good',
        )
        expect(await listReviews(db, teacher, student.id)).toHaveLength(1)
      } finally {
        await db.execute(
          sql`drop trigger test_review_failure on surah_review_assignments`,
        )
        await db.execute(sql`drop function test_review_failure()`)
      }
    })
  })
  it('enforces author ownership, body bounds and retains notes after author deletion', async () => {
    await dbRun(async (db) => {
      await expect(
        addNote(db, teacher, { studentId: student.id, body: '   ' }),
      ).rejects.toThrow()
      await expect(
        addNote(db, teacher, { studentId: student.id, body: 'x'.repeat(2001) }),
      ).rejects.toThrow()
      await addNote(db, teacher, { studentId: student.id, body: ' note ' })
      const [note] = await listNotes(db, student, student.id)
      expect(note.body).toBe('note')
      await expect(
        editNote(db, admin, { noteId: note.id, body: 'other' }),
      ).rejects.toThrow()
      await expect(removeNote(db, admin, { noteId: note.id })).rejects.toThrow()
      await editNote(db, teacher, { noteId: note.id, body: 'edited' })
      await db.delete(user).where(eq(user.id, teacher.id))
      expect(
        (await listNotes(db, student, student.id))[0].authorDisplayName,
      ).toBe('مستخدم محذوف')
      await db.delete(user).where(eq(user.id, student.id))
      expect(await db.select().from(notes)).toHaveLength(0)
    })
  })
})

describe('reset code atomicity', () => {
  beforeEach(async () => {
    await dbRun((db) =>
      db.insert(account).values({
        id: 'credential',
        userId: student.id,
        accountId: student.id,
        providerId: 'credential',
        password: 'old',
      }),
    )
    await dbRun((db) =>
      db.insert(session).values({
        id: 'session',
        userId: student.id,
        token: 'token',
        expiresAt: new Date(Date.now() + 86400000),
      }),
    )
  })
  it('allows only one redemption, revokes sessions and rejects replay', async () => {
    const { code } = await dbRun((db) =>
      issueCode(db, admin, config.BETTER_AUTH_SECRET, 'student'),
    )
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        dbRun((db) =>
          redeemCode(db, config.BETTER_AUTH_SECRET, {
            identifier: 'student',
            code,
            newPassword: password,
          }),
        ),
      ),
    )
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    expect(await dbRun((db) => db.select().from(session))).toHaveLength(0)
    await expect(
      dbRun((db) =>
        redeemCode(db, config.BETTER_AUTH_SECRET, {
          identifier: 'student',
          code,
          newPassword: password,
        }),
      ),
    ).rejects.toThrow('رمز غير صالح')
    await dbRun(async (db) => {
      const auth = createAuth(db, config)
      const login = await auth.api.signInEmail({
        body: { email: 'student@example.com', password },
      })
      expect(login.user.id).toBe(student.id)
    })
  })
  it('commits failed attempts and expires a code after five failures', async () => {
    const { code } = await dbRun((db) =>
      issueCode(db, admin, config.BETTER_AUTH_SECRET, 'student'),
    )
    const wrong = code === '000000' ? '000001' : '000000'
    for (let i = 0; i < 5; i++)
      await expect(
        dbRun((db) =>
          redeemCode(db, config.BETTER_AUTH_SECRET, {
            identifier: 'student',
            code: wrong,
            newPassword: password,
          }),
        ),
      ).rejects.toThrow()
    const [row] = await dbRun((db) => db.select().from(resetCodes))
    expect(row.attempts).toBe(5)
    expect(row.usedAt).not.toBeNull()
    await expect(
      dbRun((db) =>
        redeemCode(db, config.BETTER_AUTH_SECRET, {
          identifier: 'student',
          code,
          newPassword: password,
        }),
      ),
    ).rejects.toThrow()
  })
  it('invalidates older codes and rejects expired codes', async () => {
    const old = await dbRun((db) =>
      issueCode(db, admin, config.BETTER_AUTH_SECRET, 'student'),
    )
    await dbRun((db) =>
      issueCode(db, admin, config.BETTER_AUTH_SECRET, 'student'),
    )
    const rows = await dbRun((db) => db.select().from(resetCodes))
    expect(rows.filter((row) => row.usedAt === null)).toHaveLength(1)
    await dbRun((db) => db.update(resetCodes).set({ expiresAt: new Date(0) }))
    await expect(
      dbRun((db) =>
        redeemCode(db, config.BETTER_AUTH_SECRET, {
          identifier: 'student',
          code: old.code,
          newPassword: password,
        }),
      ),
    ).rejects.toThrow()
  })
  it('rolls back credentials, consumption and session deletion on forced failure', async () => {
    const { code } = await dbRun((db) =>
      issueCode(db, admin, config.BETTER_AUTH_SECRET, 'student'),
    )
    await dbRun(async (db) => {
      await db.execute(
        sql`create or replace function test_reset_failure() returns trigger language plpgsql as $$ begin raise exception 'forced reset failure'; end $$`,
      )
      await db.execute(
        sql`create trigger test_reset_failure before delete on session for each row execute function test_reset_failure()`,
      )
      try {
        await expect(
          redeemCode(db, config.BETTER_AUTH_SECRET, {
            identifier: 'student',
            code,
            newPassword: password,
          }),
        ).rejects.toThrow()
        expect((await db.select().from(account))[0].password).toBe('old')
        expect((await db.select().from(resetCodes))[0].usedAt).toBeNull()
      } finally {
        await db.execute(sql`drop trigger test_reset_failure on session`)
        await db.execute(sql`drop function test_reset_failure()`)
      }
      await redeemCode(db, config.BETTER_AUTH_SECRET, {
        identifier: 'student',
        code,
        newPassword: password,
      })
    })
  })
})

describe('additional migration boundaries', () => {
  it('only one close succeeds and the completed review snapshots its grade', async () => {
    await dbRun((db) =>
      setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'good',
      }),
    )
    await dbRun((db) =>
      assignReview(db, teacher, { studentId: student.id, surahNumber: 1 }),
    )
    const [row] = await dbRun((db) => listReviews(db, teacher, student.id))
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        dbRun((db) =>
          finishReview(db, teacher, {
            assignmentId: row.id,
            newGrade: 'medium',
          }),
        ),
      ),
    )
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1)
    await dbRun(async (db) => {
      const result = await db.execute(
        sql`select closing_grade, status from surah_review_assignments where id = ${row.id}`,
      )
      expect(result.rows[0]).toMatchObject({
        closing_grade: 'medium',
        status: 'closed',
      })
    })
  })
  it('orders dated reviews before undated reviews', async () => {
    await dbRun(async (db) => {
      for (const number of [1, 2, 3])
        await setGrade(db, teacher, {
          studentId: student.id,
          surahNumber: number,
          grade: 'good',
        })
      await assignReview(db, teacher, { studentId: student.id, surahNumber: 1 })
      await assignReview(db, teacher, {
        studentId: student.id,
        surahNumber: 2,
        dueAt: 2000,
      })
      await assignReview(db, teacher, {
        studentId: student.id,
        surahNumber: 3,
        dueAt: 1000,
      })
      expect(
        (await listReviews(db, teacher, student.id)).map(
          (row) => row.surahNumber,
        ),
      ).toEqual([3, 2, 1])
    })
  })
  it('returns only the latest 100 notes', async () => {
    await dbRun(async (db) => {
      await db.insert(notes).values(
        Array.from({ length: 101 }, (_, i) => ({
          id: `note-${i}`,
          studentId: student.id,
          authorId: teacher.id,
          body: `${i}`,
          createdAt: new Date(i),
        })),
      )
      const result = await listNotes(db, student, student.id)
      expect(result).toHaveLength(100)
      expect(result[0].body).toBe('100')
      expect(result.at(-1)?.body).toBe('1')
    })
  })
  it('cannot disable or delete the sole active admin', async () => {
    await expect(
      dbRun((db) =>
        updateAccount(db, admin, { userId: admin.id, status: 'disabled' }),
      ),
    ).rejects.toThrow('مشرف نشط')
    await expect(
      dbRun((db) =>
        updateAccount(db, admin, { userId: admin.id, remove: true }),
      ),
    ).rejects.toThrow('مشرف نشط')
  })
  it('does not allow nonadmins to issue reset codes or reset disabled accounts', async () => {
    await expect(
      dbRun((db) =>
        issueCode(db, teacher, config.BETTER_AUTH_SECRET, 'student'),
      ),
    ).rejects.toThrow()
    const { code } = await dbRun((db) =>
      issueCode(db, admin, config.BETTER_AUTH_SECRET, 'student'),
    )
    await dbRun((db) =>
      updateAccount(db, admin, { userId: student.id, status: 'disabled' }),
    )
    await expect(
      dbRun((db) =>
        redeemCode(db, config.BETTER_AUTH_SECRET, {
          identifier: 'student',
          code,
          newPassword: password,
        }),
      ),
    ).rejects.toThrow('رمز غير صالح')
  })
  it('does not consume a valid code if there is no credential account', async () => {
    const { code } = await dbRun((db) =>
      issueCode(db, admin, config.BETTER_AUTH_SECRET, 'student'),
    )
    await expect(
      dbRun((db) =>
        redeemCode(db, config.BETTER_AUTH_SECRET, {
          identifier: 'student',
          code,
          newPassword: password,
        }),
      ),
    ).rejects.toThrow()
    const [row] = await dbRun((db) => db.select().from(resetCodes))
    expect(row.usedAt).toBeNull()
  })
})

describe('Claude review regressions', () => {
  it('blocks self-service account changes and keeps renamed usernames/display/email consistent', async () => {
    await dbRun(async (db) => {
      const auth = createAuth(db, config)
      const response = await auth.handler(
        new Request(`${config.SITE_URL}/api/auth/update-user`, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            origin: config.SITE_URL,
          },
          body: JSON.stringify({ username: 'changed' }),
        }),
      )
      expect(response.status).toBe(404)
      await db
        .update(user)
        .set({
          email: 'student@auth.local.invalid',
          displayUsername: 'student',
        })
        .where(eq(user.id, student.id))
      await updateAccount(db, admin, {
        userId: student.id,
        username: 'renamed',
      })
      const [row] = await db.select().from(user).where(eq(user.id, student.id))
      expect(row.username).toBe('renamed')
      expect(row.displayUsername).toBe('renamed')
      expect(row.email).toBe('renamed@auth.local.invalid')
    })
  })
  it('does not close a disabled student review with a grade change', async () => {
    await dbRun(async (db) => {
      await setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'good',
      })
      await assignReview(db, teacher, { studentId: student.id, surahNumber: 1 })
      const [review] = await listReviews(db, teacher, student.id)
      await updateAccount(db, admin, { userId: student.id, status: 'disabled' })
      await expect(
        finishReview(db, teacher, {
          assignmentId: review.id,
          newGrade: 'medium',
        }),
      ).rejects.toThrow('طالب نشط')
      expect((await listGrades(db, teacher, student.id))[0].grade).toBe('good')
    })
  })
  it('serializes grade removal with assignment creation and cancels invalidated open reviews', async () => {
    await dbRun((db) =>
      setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'good',
      }),
    )
    await Promise.allSettled([
      dbRun((db) =>
        assignReview(db, teacher, { studentId: student.id, surahNumber: 1 }),
      ),
      dbRun((db) =>
        removeGrade(db, admin, { studentId: student.id, surahNumber: 1 }),
      ),
    ])
    expect(
      await dbRun((db) => listGrades(db, teacher, student.id)),
    ).toHaveLength(0)
    expect(
      await dbRun((db) => listReviews(db, teacher, student.id)),
    ).toHaveLength(0)
  })
})
