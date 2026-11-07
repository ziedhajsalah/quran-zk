import { Box, Container, Group, Stack, Title } from '@mantine/core'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { WorkQueue } from '~/components/staff/WorkQueue'
import {
  BottomNav,
  HomeTopBar,
  createHomeDashboardData,
} from '~/components/home'
import { parseWorkFilters } from '~/lib/work-queue'
import { workQueueQuery } from '~/lib/queries'
import { currentUserQuery } from '~/lib/auth-queries'

export const Route = createFileRoute('/_protected/staff/work')({
  validateSearch: parseWorkFilters,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.prefetchQuery(workQueueQuery(deps, null)),
  component: StaffWorkPage,
})

function StaffWorkPage() {
  const filters = Route.useSearch()
  const navigate = Route.useNavigate()
  const { data: me } = useSuspenseQuery(currentUserQuery)
  const chrome = createHomeDashboardData(me.displayName)
  return (
    <Box bg="var(--mantine-color-body)" mih="100vh">
      <HomeTopBar
        brandName={chrome.brandName}
        brandMarkText={chrome.brandMarkText}
        notificationLabel={chrome.notificationLabel}
      />
      <Container
        component="main"
        size="md"
        px={{ base: 'lg', sm: 'xl' }}
        py="xl"
        pb="9rem"
      >
        <Stack gap="xl">
          <Group justify="space-between">
            <Title order={1}>قائمة الواجبات</Title>
            <Link to="/" style={{ color: 'var(--app-accent-text)' }}>
              العودة للرئيسية
            </Link>
          </Group>
          <WorkQueue
            key={JSON.stringify(filters)}
            filters={filters}
            onFilter={(search) => navigate({ search })}
          />
        </Stack>
      </Container>
      <BottomNav activeItemId="home" items={chrome.bottomNavItems} />
    </Box>
  )
}
