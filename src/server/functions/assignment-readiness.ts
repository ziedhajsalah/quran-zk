import { createServerFn } from '@tanstack/react-start'
import { withRuntime } from '../runtime.server'
import { setAssignmentReadiness } from '../services/assignment-readiness.server'
import { assignmentReadinessInput } from './validation'

export const setReady = createServerFn({ method: 'POST' })
  .validator(assignmentReadinessInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => setAssignmentReadiness(db, actor, data)),
  )
