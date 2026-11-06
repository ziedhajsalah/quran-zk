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

export const reviewHistoryInput = studentInput.extend({
  status: z.enum(['all', 'closed', 'cancelled']).default('all'),
  cursor: z
    .object({
      closedAt: z.number().int().min(0).max(8.64e15).nullable(),
      id: z.string().min(1).max(128),
    })
    .nullable()
    .default(null),
})

export const batchReviewInput = studentInput.extend({
  surahNumbers: z
    .array(z.number().int().min(1).max(114))
    .min(1)
    .max(114)
    .refine(
      (numbers) => new Set(numbers).size === numbers.length,
      'لا يمكن تكرار السورة في الدفعة نفسها.',
    ),
  dueAt: z
    .number()
    .int()
    .min(0)
    .max(8.64e15)
    .refine(
      (value) => value % 86_400_000 === 0,
      'يجب أن يكون الموعد تاريخاً بتوقيت UTC.',
    )
    .optional(),
})

export const gradeHistoryInput = studentInput.extend({
  surahNumber: z.number().int().min(1).max(114).optional(),
  cursor: z
    .number()
    .int()
    .positive()
    .max(Number.MAX_SAFE_INTEGER)
    .nullable()
    .default(null),
})
