import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { withRuntime } from '../runtime.server'
import { passwordSchema } from '../accounts'
import * as service from '../services/reset-codes.server'

const identifier = z.string().trim().min(1).max(320)
export const adminIssue = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ identifier }))
  .handler(({ data }) =>
    withRuntime(({ db, actor, config }) =>
      service.issueCode(db, actor, config.BETTER_AUTH_SECRET, data.identifier),
    ),
  )
export const redeem = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      identifier,
      code: z.string().max(64),
      newPassword: passwordSchema,
    }),
  )
  .handler(({ data }) =>
    withRuntime(({ db, config }) =>
      service.redeemCode(db, config.BETTER_AUTH_SECRET, data),
    ),
  )
