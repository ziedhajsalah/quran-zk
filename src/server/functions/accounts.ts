import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { withRuntime } from '../runtime.server'
import { requireAdmin } from '../auth-guards.server'
import {
  accountInput,
  passwordSchema,
  roleSchema,
  usernameSchema,
} from '../accounts'
import * as service from '../services/accounts.server'

export const staffCreateStudent = createServerFn({ method: 'POST' })
  .inputValidator(accountInput)
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.staffCreateStudent(db, actor, data)),
  )
export const adminCreate = createServerFn({ method: 'POST' })
  .inputValidator(
    accountInput.extend({ roles: z.array(roleSchema).min(1).max(3) }),
  )
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.adminCreate(db, actor, data)),
  )
export const listUsers = createServerFn({ method: 'GET' }).handler(() =>
  withRuntime(({ db, actor }) => service.adminList(db, actor)),
)
export const adminUpdate = createServerFn({ method: 'POST' })
  .inputValidator(
    accountInput.omit({ password: true }).extend({
      userId: z.string().min(1),
      roles: z.array(roleSchema).min(1).max(3),
    }),
  )
  .handler(({ data }) =>
    withRuntime(({ db, actor }) =>
      service.updateAccount(db, actor, {
        ...data,
        username: usernameSchema.parse(data.username),
      }),
    ),
  )
export const adminSetStatus = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({
      userId: z.string().min(1),
      status: z.enum(['active', 'disabled']),
    }),
  )
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => service.updateAccount(db, actor, data)),
  )
export const adminRemove = createServerFn({ method: 'POST' })
  .inputValidator(z.object({ userId: z.string().min(1) }))
  .handler(({ data }) =>
    withRuntime(({ db, actor }) =>
      service.updateAccount(db, actor, { ...data, remove: true }),
    ),
  )
export const adminResetPassword = createServerFn({ method: 'POST' })
  .inputValidator(
    z.object({ userId: z.string().min(1), password: passwordSchema }),
  )
  .handler(({ data }) =>
    withRuntime(({ db, actor }) => {
      requireAdmin(actor)
      return service.setPassword(db, data.userId, data.password)
    }),
  )
