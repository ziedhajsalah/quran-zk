import { redirect } from '@tanstack/react-router'
import { fetchAppSession } from '~/server/functions/session'

export { fetchAppSession }

export async function requireProtectedAppUser(redirectTarget: string) {
  const session = await fetchAppSession()

  if (!session.userId) {
    throw redirect({
      to: '/login',
      search: {
        redirect: redirectTarget,
        reason: 'auth',
      },
    })
  }

  if (!session.currentUser) {
    throw redirect({
      to: '/login',
      search: {
        redirect: redirectTarget,
        reason: 'unauthorized',
      },
    })
  }

  return session
}
