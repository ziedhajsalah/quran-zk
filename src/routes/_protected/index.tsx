import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { HomeDashboard, createHomeDashboardData } from '~/components/home'
import { currentUserQuery } from '~/lib/auth-queries'

export const Route = createFileRoute('/_protected/')({
  component: Home,
})

function Home() {
  const { data: currentUser } = useSuspenseQuery(currentUserQuery)
  const homeDashboardData = useMemo(
    () => createHomeDashboardData(currentUser.displayName),
    [currentUser.displayName],
  )

  return <HomeDashboard data={homeDashboardData} />
}
