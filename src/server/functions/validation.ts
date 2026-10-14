import { z } from 'zod'

export const studentInput = z.object({ studentId: z.string().min(1).max(128) })
export const surahInput = studentInput.extend({
  surahNumber: z.number().int().min(1).max(114),
})
export const gradeSchema = z.enum(['good', 'medium', 'forgotten'])
export const noteIdInput = z.object({ noteId: z.string().min(1).max(128) })
export const assignmentInput = z.object({
  assignmentId: z.string().min(1).max(128),
})
export const bodySchema = z.string().trim().min(1).max(2000)
