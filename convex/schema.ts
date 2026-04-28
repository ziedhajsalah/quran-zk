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
})
