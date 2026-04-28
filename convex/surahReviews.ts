import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  requireSelfOrStaffAuthUser,
  requireStaffAuthUser,
} from './auth/helpers'

function assertSurahNumber(surahNumber: number) {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    throw new ConvexError('Invalid surah number.')
  }
}

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

export const assign = mutation({
  args: {
    studentId: v.string(),
    surahNumber: v.number(),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    assertSurahNumber(args.surahNumber)

    const grade = await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student_surah', (q) =>
        q.eq('studentId', args.studentId).eq('surahNumber', args.surahNumber),
      )
      .unique()
    if (!grade) {
      throw new ConvexError('Student has not memorized this surah yet.')
    }

    const existingOpen = await ctx.db
      .query('surahReviewAssignments')
      .withIndex('by_student_surah_status', (q) =>
        q
          .eq('studentId', args.studentId)
          .eq('surahNumber', args.surahNumber)
          .eq('status', 'open'),
      )
      .unique()
    if (existingOpen) {
      throw new ConvexError(
        'An open review assignment already exists for this surah.',
      )
    }

    await ctx.db.insert('surahReviewAssignments', {
      studentId: args.studentId,
      surahNumber: args.surahNumber,
      status: 'open',
      dueAt: args.dueAt ?? null,
      assignedBy: String(staff._id),
      assignedAt: Date.now(),
      closedBy: null,
      closedAt: null,
      closingGrade: null,
    })
  },
})

const gradeValidator = v.union(
  v.literal('good'),
  v.literal('medium'),
  v.literal('forgotten'),
)

export const close = mutation({
  args: {
    assignmentId: v.id('surahReviewAssignments'),
    newGrade: v.optional(gradeValidator),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    const assignment = await ctx.db.get(
      'surahReviewAssignments',
      args.assignmentId,
    )
    if (!assignment) {
      throw new ConvexError('Assignment not found.')
    }
    if (assignment.status !== 'open') {
      throw new ConvexError('Assignment is not open.')
    }

    const existingGrade = await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student_surah', (q) =>
        q
          .eq('studentId', assignment.studentId)
          .eq('surahNumber', assignment.surahNumber),
      )
      .unique()

    const now = Date.now()
    let closingGrade: 'good' | 'medium' | 'forgotten' | null

    if (args.newGrade !== undefined) {
      if (existingGrade) {
        await ctx.db.patch('studentSurahGrades', existingGrade._id, {
          grade: args.newGrade,
          updatedAt: now,
          updatedBy: String(staff._id),
        })
      } else {
        await ctx.db.insert('studentSurahGrades', {
          studentId: assignment.studentId,
          surahNumber: assignment.surahNumber,
          grade: args.newGrade,
          updatedAt: now,
          updatedBy: String(staff._id),
        })
      }
      closingGrade = args.newGrade
    } else {
      closingGrade = existingGrade?.grade ?? null
    }

    await ctx.db.patch('surahReviewAssignments', args.assignmentId, {
      status: 'closed',
      closedBy: String(staff._id),
      closedAt: now,
      closingGrade,
    })
  },
})
