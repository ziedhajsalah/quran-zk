import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { components } from './_generated/api'
import {
  requireAdminAuthUser,
  requireSelfOrStaffAuthUser,
  requireStaffAuthUser,
  serializeAuthUser,
} from './auth/helpers'
import { parseStoredRoles } from './auth/utils'

const gradeValidator = v.union(
  v.literal('good'),
  v.literal('medium'),
  v.literal('forgotten'),
)

function assertSurahNumber(surahNumber: number) {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    throw new ConvexError('Invalid surah number.')
  }
}

export const listForStudent = query({
  args: {
    studentId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSelfOrStaffAuthUser(ctx, args.studentId)
    return await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student', (q) => q.eq('studentId', args.studentId))
      .collect()
  },
})

export const listAllStudents = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffAuthUser(ctx)

    // Better Auth's `listUsers` admin API is admin-only. Teachers are staff
    // for this product, so read users through the component adapter instead.
    const all: Array<Record<string, unknown>> = []
    let cursor: string | null = null
    let isDone = false
    do {
      const result: {
        page: Array<Record<string, unknown>>
        isDone: boolean
        continueCursor: string
      } = await ctx.runQuery(components.betterAuth.adapter.findMany, {
        model: 'user',
        paginationOpts: { numItems: 100, cursor },
      })
      all.push(...result.page)
      isDone = result.isDone
      cursor = result.continueCursor
    } while (!isDone)

    return all
      .filter((user) =>
        parseStoredRoles(
          typeof user.role === 'string' ? user.role : null,
        ).includes('student'),
      )
      .filter((user) => user.banned !== true)
      .map((user) =>
        serializeAuthUser({
          _id: typeof user._id === 'string' ? user._id : null,
          name: typeof user.name === 'string' ? user.name : '',
          email: typeof user.email === 'string' ? user.email : null,
          username: typeof user.username === 'string' ? user.username : null,
          role: typeof user.role === 'string' ? user.role : null,
          banned: user.banned === true,
        }),
      )
      .sort((a, b) => a.displayName.localeCompare(b.displayName, 'ar'))
  },
})

export const setGrade = mutation({
  args: {
    studentId: v.string(),
    surahNumber: v.number(),
    grade: gradeValidator,
  },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    assertSurahNumber(args.surahNumber)

    const existing = await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student_surah', (q) =>
        q.eq('studentId', args.studentId).eq('surahNumber', args.surahNumber),
      )
      .unique()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch('studentSurahGrades', existing._id, {
        grade: args.grade,
        updatedAt: now,
        updatedBy: String(staff._id),
      })
    } else {
      await ctx.db.insert('studentSurahGrades', {
        studentId: args.studentId,
        surahNumber: args.surahNumber,
        grade: args.grade,
        updatedAt: now,
        updatedBy: String(staff._id),
      })
    }
  },
})

export const removeFromList = mutation({
  args: {
    studentId: v.string(),
    surahNumber: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminAuthUser(ctx)
    assertSurahNumber(args.surahNumber)

    const existing = await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student_surah', (q) =>
        q.eq('studentId', args.studentId).eq('surahNumber', args.surahNumber),
      )
      .unique()

    if (existing) {
      await ctx.db.delete('studentSurahGrades', existing._id)
    }
  },
})
