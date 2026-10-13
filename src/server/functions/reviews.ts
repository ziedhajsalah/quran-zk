import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { withRuntime } from '../runtime.server'
import * as service from '../services/reviews.server'
import {
  assignmentInput,
  gradeSchema,
  studentInput,
  surahInput,
} from './validation'

export const listOpenForStudent = createServerFn({ method: 'GET' })
  .inputValidator(studentInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) =>
      service.listReviews(db, actor, data.studentId),
    ),
  )
export const assign = createServerFn({ method: 'POST' })
  .inputValidator(
    surahInput.extend({
      dueAt: z.number().int().min(0).max(8.64e15).optional(),
    }),
  )
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.assignReview(db, actor, data)),
  )
export const close = createServerFn({ method: 'POST' })
  .inputValidator(assignmentInput.extend({ newGrade: gradeSchema.optional() }))
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.finishReview(db, actor, data)),
  )
export const cancel = createServerFn({ method: 'POST' })
  .inputValidator(assignmentInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.finishReview(db, actor, data, true)),
  )
