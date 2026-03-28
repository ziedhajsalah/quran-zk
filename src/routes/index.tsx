import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'
import { HomeDashboard, createHomeDashboardData } from '~/components/home'
import { requireProtectedAppUser } from '~/lib/auth'

export const Route = createFileRoute('/')({
  beforeLoad: async ({ location }) => {
    await requireProtectedAppUser(location.href)
  },
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(convexQuery(api.auth.users.current, {}))
  },
  component: Home,
})

function Home() {
  const { data: currentUser } = useSuspenseQuery(convexQuery(api.auth.users.current, {}))
  const homeDashboardData = createHomeDashboardData(currentUser.displayName)

  return <HomeDashboard data={homeDashboardData} />
}
