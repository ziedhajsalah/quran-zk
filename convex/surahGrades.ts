import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireSelfOrStaffAuthUser } from './auth/helpers'

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
