import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { api } from '../../convex/_generated/api'
import { fetchAuthQuery, getToken } from '~/lib/auth-server'

export const fetchAuthToken = createServerFn({ method: 'GET' }).handler(async () => {
  return await getToken()
})

export const fetchAppSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const token = await getToken()
    if (!token) {
      return {
        userId: null,
        token: null,
        currentUser: null,
      }
    }

    try {
      const currentUser = await fetchAuthQuery(api.auth.users.current, {})
      return {
        userId: currentUser.id,
        token,
        currentUser,
      }
    } catch {
      return {
        userId: '__session__',
        token,
        currentUser: null,
      }
    }
  },
)

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
