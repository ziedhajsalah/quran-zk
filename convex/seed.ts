import { v } from 'convex/values'
import { hashPassword } from 'better-auth/crypto'
import { internalAction, internalMutation } from './_generated/server'
import { components, internal } from './_generated/api'
import { createAuth } from './auth'
import {
  buildStoredEmail,
  normalizeDisplayName,
  normalizeUsername,
} from './auth/utils'
import type { ActionCtx, MutationCtx } from './_generated/server'

const DEMO_PASSWORD = 'DemoPass123!'

type DemoRole = 'admin' | 'teacher' | 'student'
type DemoGrade = 'good' | 'medium' | 'forgotten'

type DemoAccount = {
  username: string
  displayName: string
  email: string
  role: DemoRole
}

const DEMO_ACCOUNTS: ReadonlyArray<DemoAccount> = [
  {
    username: 'demo.admin',
    displayName: 'المشرف التجريبي',
    email: 'demo.admin@example.com',
    role: 'admin',
  },
  {
    username: 'demo.teacher',
    displayName: 'الأستاذ أحمد',
    email: 'demo.teacher@example.com',
    role: 'teacher',
  },
  {
    username: 'demo.teacher2',
    displayName: 'الأستاذة فاطمة',
    email: 'demo.teacher2@example.com',
    role: 'teacher',
  },
  {
    username: 'demo.ahmad',
    displayName: 'أحمد محمد',
    email: 'demo.ahmad@example.com',
    role: 'student',
  },
  {
    username: 'demo.fatima',
    displayName: 'فاطمة علي',
    email: 'demo.fatima@example.com',
    role: 'student',
  },
  {
    username: 'demo.yusuf',
    displayName: 'يوسف الحسن',
    email: 'demo.yusuf@example.com',
    role: 'student',
  },
]

const dayMs = 1000 * 60 * 60 * 24

async function ensureDemoUser(
  ctx: ActionCtx,
  account: DemoAccount,
): Promise<{ id: string; created: boolean }> {
  const normalizedUsername = normalizeUsername(account.username)
  const existing = await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: 'user',
    where: [{ field: 'username', value: normalizedUsername.username }],
  })

  if (existing) {
    const userId = String(existing._id)
    await setUserRole(ctx, userId, account.role)
    await setUserPassword(ctx, userId, DEMO_PASSWORD)
    return { id: userId, created: false }
  }

  const auth = createAuth(ctx, { disableSignUp: false })
  const email = buildStoredEmail(normalizedUsername.username, account.email)
  const created = await auth.api.signUpEmail({
    body: {
      email,
      password: DEMO_PASSWORD,
      name: normalizeDisplayName(account.displayName),
      username: normalizedUsername.username,
    },
  })

  if (!created.user) {
    throw new Error(`Failed to create demo user ${account.username}.`)
  }

  await setUserRole(ctx, created.user.id, account.role)
  return { id: created.user.id, created: true }
}

async function setUserRole(
  ctx: ActionCtx,
  userId: string,
  role: DemoRole,
) {
  await ctx.runMutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: 'user',
      where: [{ field: '_id', value: userId }],
      update: {
        role,
        banned: false,
        banReason: null,
        banExpires: null,
      },
    },
  })
}

async function setUserPassword(
  ctx: ActionCtx,
  userId: string,
  password: string,
) {
  const accounts = await ctx.runQuery(components.betterAuth.adapter.findMany, {
    model: 'account',
    where: [{ field: 'userId', value: userId }],
    paginationOpts: { numItems: 50, cursor: null },
  })

  const credentialAccount = accounts.page.find(
    (entry: Record<string, unknown>) => entry.providerId === 'credential',
  )
  if (!credentialAccount) {
    throw new Error(`No credential account found for user ${userId}.`)
  }

  const newHash = await hashPassword(password)
  await ctx.runMutation(components.betterAuth.adapter.updateOne, {
    input: {
      model: 'account',
      where: [{ field: '_id', value: credentialAccount._id as string }],
      update: { password: newHash, updatedAt: Date.now() },
    },
  })
}

export const applyDomainData = internalMutation({
  args: {
    teacherId: v.string(),
    teacher2Id: v.string(),
    ahmadId: v.string(),
    fatimaId: v.string(),
    yusufId: v.string(),
    reset: v.boolean(),
  },
  handler: async (ctx, args) => {
    const studentIds = [args.ahmadId, args.fatimaId, args.yusufId]
    if (args.reset) {
      await clearStudentDomainData(ctx, studentIds)
    }

    const now = Date.now()
    await upsertGrades(ctx, args.ahmadId, args.teacherId, now, [
      { surahNumber: 1, grade: 'good', daysAgo: 1 },
      { surahNumber: 18, grade: 'medium', daysAgo: 3 },
      { surahNumber: 36, grade: 'forgotten', daysAgo: 14 },
      { surahNumber: 67, grade: 'good', daysAgo: 2 },
      { surahNumber: 112, grade: 'good', daysAgo: 5 },
      { surahNumber: 113, grade: 'medium', daysAgo: 8 },
      { surahNumber: 114, grade: 'good', daysAgo: 6 },
    ])
    await upsertGrades(ctx, args.fatimaId, args.teacher2Id, now, [
      { surahNumber: 1, grade: 'good', daysAgo: 4 },
      { surahNumber: 78, grade: 'medium', daysAgo: 7 },
      { surahNumber: 112, grade: 'forgotten', daysAgo: 20 },
    ])

    await ensureOpenReview(ctx, {
      studentId: args.ahmadId,
      surahNumber: 18,
      assignedBy: args.teacherId,
      assignedAt: now - 2 * dayMs,
      dueAt: now + 5 * dayMs,
    })
    await ensureOpenReview(ctx, {
      studentId: args.ahmadId,
      surahNumber: 36,
      assignedBy: args.teacherId,
      assignedAt: now - 10 * dayMs,
      dueAt: now - 2 * dayMs,
    })
    await ensureOpenReview(ctx, {
      studentId: args.ahmadId,
      surahNumber: 67,
      assignedBy: args.teacher2Id,
      assignedAt: now - dayMs,
      dueAt: null,
    })
    await ensureOpenReview(ctx, {
      studentId: args.fatimaId,
      surahNumber: 112,
      assignedBy: args.teacher2Id,
      assignedAt: now - 3 * dayMs,
      dueAt: now + dayMs,
    })

    await ensureNotes(ctx, args.ahmadId, [
      {
        authorId: args.teacherId,
        body: 'يحفظ بسرعة بعد المغرب، وركّز معه على مخارج الحروف في سورة الكهف.',
        createdAt: now - 2 * 60 * 60 * 1000,
        editedAt: null,
      },
      {
        authorId: args.teacher2Id,
        body: 'تحسن كبير في المراجعة هذا الأسبوع. يحتاج إعادة لسورة يس قبل الحصة القادمة.',
        createdAt: now - 3 * dayMs,
        editedAt: now - 2 * dayMs,
      },
    ])
    await ensureNotes(ctx, args.fatimaId, [
      {
        authorId: args.teacher2Id,
        body: 'أداء جيد في الفاتحة. الإخلاص تحتاج مراجعة هادئة قبل التقييم التالي.',
        createdAt: now - dayMs,
        editedAt: null,
      },
    ])
  },
})

export const run = internalAction({
  args: {
    reset: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const createdUsernames: Array<string> = []
    const ids: Record<string, string> = {}

    for (const account of DEMO_ACCOUNTS) {
      const result = await ensureDemoUser(ctx, account)
      ids[account.username] = result.id
      if (result.created) {
        createdUsernames.push(account.username)
      }
    }

    const teacherId = ids['demo.teacher']
    const teacher2Id = ids['demo.teacher2']
    const ahmadId = ids['demo.ahmad']
    const fatimaId = ids['demo.fatima']
    const yusufId = ids['demo.yusuf']
    if (!teacherId || !teacher2Id || !ahmadId || !fatimaId || !yusufId) {
      throw new Error('Demo user ids were not resolved.')
    }

    await ctx.runMutation(internal.seed.applyDomainData, {
      teacherId,
      teacher2Id,
      ahmadId,
      fatimaId,
      yusufId,
      reset: args.reset ?? false,
    })

    return {
      password: DEMO_PASSWORD,
      createdUsernames,
      accounts: DEMO_ACCOUNTS.map((account) => ({
        username: account.username,
        displayName: account.displayName,
        role: account.role,
        id: ids[account.username] ?? '',
      })),
    }
  },
})

async function clearStudentDomainData(
  ctx: MutationCtx,
  studentIds: ReadonlyArray<string>,
) {
  for (const studentId of studentIds) {
    const grades = await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student', (q) => q.eq('studentId', studentId))
      .collect()
    for (const row of grades) {
      await ctx.db.delete('studentSurahGrades', row._id)
    }

    const open = await ctx.db
      .query('surahReviewAssignments')
      .withIndex('by_student_status', (q) =>
        q.eq('studentId', studentId).eq('status', 'open'),
      )
      .collect()
    for (const row of open) {
      await ctx.db.delete('surahReviewAssignments', row._id)
    }

    const notes = await ctx.db
      .query('studentNotes')
      .withIndex('by_student_created', (q) => q.eq('studentId', studentId))
      .collect()
    for (const row of notes) {
      await ctx.db.delete('studentNotes', row._id)
    }
  }
}

async function upsertGrades(
  ctx: MutationCtx,
  studentId: string,
  updatedBy: string,
  now: number,
  rows: ReadonlyArray<{
    surahNumber: number
    grade: DemoGrade
    daysAgo: number
  }>,
) {
  for (const row of rows) {
    const existing = await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student_surah', (q) =>
        q.eq('studentId', studentId).eq('surahNumber', row.surahNumber),
      )
      .unique()
    const updatedAt = now - row.daysAgo * dayMs
    if (existing) {
      await ctx.db.patch('studentSurahGrades', existing._id, {
        grade: row.grade,
        updatedAt,
        updatedBy,
      })
    } else {
      await ctx.db.insert('studentSurahGrades', {
        studentId,
        surahNumber: row.surahNumber,
        grade: row.grade,
        updatedAt,
        updatedBy,
      })
    }
  }
}

async function ensureOpenReview(
  ctx: MutationCtx,
  input: {
    studentId: string
    surahNumber: number
    assignedBy: string
    assignedAt: number
    dueAt: number | null
  },
) {
  const existingOpen = await ctx.db
    .query('surahReviewAssignments')
    .withIndex('by_student_surah_status', (q) =>
      q
        .eq('studentId', input.studentId)
        .eq('surahNumber', input.surahNumber)
        .eq('status', 'open'),
    )
    .unique()
  if (existingOpen) {
    return
  }

  await ctx.db.insert('surahReviewAssignments', {
    studentId: input.studentId,
    surahNumber: input.surahNumber,
    status: 'open',
    dueAt: input.dueAt,
    assignedBy: input.assignedBy,
    assignedAt: input.assignedAt,
    closedBy: null,
    closedAt: null,
    closingGrade: null,
  })
}

async function ensureNotes(
  ctx: MutationCtx,
  studentId: string,
  notes: ReadonlyArray<{
    authorId: string
    body: string
    createdAt: number
    editedAt: number | null
  }>,
) {
  const existing = await ctx.db
    .query('studentNotes')
    .withIndex('by_student_created', (q) => q.eq('studentId', studentId))
    .take(1)
  if (existing.length > 0) {
    return
  }

  for (const note of notes) {
    await ctx.db.insert('studentNotes', {
      studentId,
      authorId: note.authorId,
      body: note.body,
      createdAt: note.createdAt,
      editedAt: note.editedAt,
    })
  }
}
