import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { auth } from '@clerk/tanstack-react-start/server'
import { ConvexHttpClient } from 'convex/browser'
import { api } from '../../convex/_generated/api'

function getConvexUrl() {
  const url = process.env.VITE_CONVEX_URL ?? process.env.CONVEX_URL
  if (!url) {
    throw new Error('Missing VITE_CONVEX_URL environment variable.')
  }
  return url
}

async function getConvexToken(authState: Awaited<ReturnType<typeof auth>>) {
  if (!authState.userId) {
    return null
  }

  if (authState.sessionClaims.aud === 'convex') {
    return await authState.getToken()
  }

  return await authState.getToken({ template: 'convex' })
}

export const fetchClerkSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const authState = await auth()
    const token = await getConvexToken(authState)

    return {
      userId: authState.userId ?? null,
      token,
    }
  },
)

export const fetchAppSession = createServerFn({ method: 'GET' }).handler(
  async () => {
    const authState = await auth()

    if (!authState.userId) {
      return {
        userId: null,
        token: null,
        currentUser: null,
      }
    }

    const token = await getConvexToken(authState)
    if (!token) {
      return {
        userId: authState.userId,
        token: null,
        currentUser: null,
      }
    }

    const client = new ConvexHttpClient(getConvexUrl(), {
      auth: token,
      logger: false,
    })

    try {
      const currentUser = await client.mutation(api.auth.users.syncSessionUser, {})
      return {
        userId: authState.userId,
        token,
        currentUser,
      }
    } catch {
      return {
        userId: authState.userId,
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
