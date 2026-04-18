import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { currentUserQuery } from '~/lib/auth-queries'

function loginRedirectTarget(location: {
  pathname: string
  searchStr: string
  hash: string
}) {
  // `location.href` includes the origin in the browser; login search only
  // accepts paths starting with `/`. Use the path + query + hash form instead.
  const hash = location.hash ? `#${location.hash}` : ''
  return `${location.pathname}${location.searchStr}${hash}`
}

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ context, location }) => {
    const redirectTarget = loginRedirectTarget(location)

    if (!context.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: redirectTarget,
          reason: 'auth',
        },
      })
    }

    try {
      await context.queryClient.ensureQueryData(currentUserQuery)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const isAuthFailure =
        message === 'Not authenticated' ||
        message === 'Account disabled' ||
        message === 'Unauthorized'
      if (!isAuthFailure) {
        throw error
      }
      throw redirect({
        to: '/login',
        search: {
          redirect: redirectTarget,
          reason: 'unauthorized',
        },
      })
    }
  },
  component: Outlet,
})
