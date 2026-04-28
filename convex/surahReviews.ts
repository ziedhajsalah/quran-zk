import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireSelfOrStaffAuthUser } from './auth/helpers'

export const listOpenForStudent = query({
  args: {
    studentId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSelfOrStaffAuthUser(ctx, args.studentId)
    const rows = await ctx.db
      .query('surahReviewAssignments')
      .withIndex('by_student_status', (q) =>
        q.eq('studentId', args.studentId).eq('status', 'open'),
      )
      .collect()
    return [...rows].sort((a, b) => {
      if (a.dueAt === null && b.dueAt === null) {
        return a.assignedAt - b.assignedAt
      }
      if (a.dueAt === null) return 1
      if (b.dueAt === null) return -1
      if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt
      return a.assignedAt - b.assignedAt
    })
  },
})
