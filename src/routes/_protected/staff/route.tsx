import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { currentUserQuery } from '~/lib/auth-queries'

export const Route = createFileRoute('/_protected/staff')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(currentUserQuery)
    if (!me.isAdmin && !me.isTeacher) {
      throw redirect({ to: '/' })
    }
  },
  component: Outlet,
})
