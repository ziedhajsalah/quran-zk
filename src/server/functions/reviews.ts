import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { rescheduleAssignment } from '../services/assignment-deadline.server'
import { withRuntime } from '../runtime.server'
import * as service from '../services/reviews.server'
import {
  assignmentDeadlineInput,
  assignmentInput,
  batchReviewInput,
  closeReviewInput,
  reviewHistoryInput,
  studentInput,
  surahInput,
} from './validation'

export const listOpenForStudent = createServerFn({ method: 'GET' })
  .validator(studentInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) =>
      service.listReviews(db, actor, data.studentId),
    ),
  )
export const listHistoryForStudent = createServerFn({ method: 'GET' })
  .validator(reviewHistoryInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.listReviewHistory(db, actor, data)),
  )
export const assign = createServerFn({ method: 'POST' })
  .validator(
    surahInput.extend({
      dueAt: z.number().int().min(0).max(8.64e15).optional(),
    }),
  )
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.assignReview(db, actor, data)),
  )
export const assignBatch = createServerFn({ method: 'POST' })
  .validator(batchReviewInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.assignReviews(db, actor, data)),
  )
export const close = createServerFn({ method: 'POST' })
  .validator(closeReviewInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.finishReview(db, actor, data)),
  )
export const cancel = createServerFn({ method: 'POST' })
  .validator(assignmentInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.finishReview(db, actor, data, true)),
  )

export const reschedule = createServerFn({ method: 'POST' })
  .validator(assignmentDeadlineInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) =>
      rescheduleAssignment(db, actor, 'review', data),
    ),
  )
