import { createServerFn } from '@tanstack/react-start'
import { withRuntime } from '../runtime.server'
import { requireActor } from '../auth-guards.server'

export const fetchAppSession = createServerFn({ method: 'GET' }).handler(() =>
  withRuntime(({ actor }) => ({
    userId: actor?.id ?? null,
    currentUser: actor,
  })),
)
export const currentUser = createServerFn({ method: 'GET' }).handler(() =>
  withRuntime(({ actor }) => requireActor(actor)),
)
