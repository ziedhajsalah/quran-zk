import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { currentUserQuery } from '~/lib/auth-queries'

export const Route = createFileRoute('/_protected/admin')({
  beforeLoad: async ({ context }) => {
    const currentUser = await context.queryClient.ensureQueryData(currentUserQuery)
    if (!currentUser.isAdmin) {
      throw redirect({ to: '/' })
    }
  },
  component: Outlet,
})
