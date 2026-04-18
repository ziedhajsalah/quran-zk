import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { currentUserQuery } from '~/lib/auth-queries'

export const Route = createFileRoute('/_protected')({
  beforeLoad: async ({ context, location }) => {
    if (!context.isAuthenticated) {
      throw redirect({
        to: '/login',
        search: {
          redirect: location.href,
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
          redirect: location.href,
          reason: 'unauthorized',
        },
      })
    }
  },
  component: Outlet,
})
