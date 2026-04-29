import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  passwordResetCodes: defineTable({
    userId: v.string(),
    codeHash: v.string(),
    betterAuthToken: v.union(v.null(), v.string()),
    expiresAt: v.number(),
    usedAt: v.union(v.null(), v.number()),
    attempts: v.number(),
    issuedByAdminId: v.string(),
  })
    .index('by_code_hash', ['codeHash'])
    .index('by_user', ['userId']),
  studentSurahGrades: defineTable({
    studentId: v.string(),
    surahNumber: v.number(),
    grade: v.union(
      v.literal('good'),
      v.literal('medium'),
      v.literal('forgotten'),
    ),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index('by_student', ['studentId'])
    .index('by_student_surah', ['studentId', 'surahNumber']),
  surahReviewAssignments: defineTable({
    studentId: v.string(),
    surahNumber: v.number(),
    status: v.union(
      v.literal('open'),
      v.literal('closed'),
      v.literal('cancelled'),
    ),
    dueAt: v.union(v.null(), v.number()),
    assignedBy: v.string(),
    assignedAt: v.number(),
    closedBy: v.union(v.null(), v.string()),
    closedAt: v.union(v.null(), v.number()),
    closingGrade: v.union(
      v.null(),
      v.literal('good'),
      v.literal('medium'),
      v.literal('forgotten'),
    ),
  })
    .index('by_student_status', ['studentId', 'status'])
    .index('by_student_surah_status', ['studentId', 'surahNumber', 'status']),
  studentNotes: defineTable({
    studentId: v.string(),
    authorId: v.string(),
    body: v.string(),
    createdAt: v.number(),
    editedAt: v.union(v.null(), v.number()),
  })
    .index('by_student', ['studentId'])
    .index('by_student_created', ['studentId', 'createdAt']),
})
