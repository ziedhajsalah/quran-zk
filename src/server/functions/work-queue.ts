import { createServerFn } from '@tanstack/react-start'
import { withRuntime } from '../runtime.server'
import { listWorkQueue } from '../services/work-queue.server'
import { workQueueInput } from './validation'

export const list = createServerFn({ method: 'GET' })
  .validator(workQueueInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => listWorkQueue(db, actor, data)),
  )
