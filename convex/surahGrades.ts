import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { authComponent, createAuth } from './auth'
import {
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
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

    const all: Array<Awaited<ReturnType<typeof auth.api.getUser>>> = []
    let offset = 0
    let total = 0
    do {
      const result = await auth.api.listUsers({
        query: { limit: 100, offset },
        headers,
      })
      all.push(...result.users)
      total = result.total
      offset += result.users.length
    } while (offset < total)

    return all
      .filter((u) => parseStoredRoles(u.role).includes('student'))
      .filter((u) => !u.banned)
      .map(serializeAuthUser)
      .sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'ar'),
      )
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
