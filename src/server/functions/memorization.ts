import { createServerFn } from '@tanstack/react-start'
import { withRuntime } from '../runtime.server'
import * as service from '../services/memorization.server'
import {
  assessMemorizationInput,
  assignmentInput,
  memorizationInput,
  studentInput,
} from './validation'

export const listOpenForStudent = createServerFn({ method: 'GET' })
  .validator(studentInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) =>
      service.listMemorization(db, actor, data.studentId),
    ),
  )
export const assign = createServerFn({ method: 'POST' })
  .validator(memorizationInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.assignMemorization(db, actor, data)),
  )
export const assess = createServerFn({ method: 'POST' })
  .validator(assessMemorizationInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.finishMemorization(db, actor, data)),
  )
export const cancel = createServerFn({ method: 'POST' })
  .validator(assignmentInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.finishMemorization(db, actor, data)),
  )
