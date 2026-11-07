import { Box, Container, Group, Stack, Title } from '@mantine/core'
import { Link, createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { WorkQueue } from '~/components/staff/WorkQueue'
import {
  BottomNav,
  HomeTopBar,
  createHomeDashboardData,
} from '~/components/home'
import { currentUserQuery } from '~/lib/auth-queries'

export const Route = createFileRoute('/_protected/staff/work')({
  validateSearch: z.object({
    q: z.string().trim().max(100).catch(''),
    kind: z.enum(['all', 'review', 'memorization']).catch('all'),
    deadline: z
      .enum(['all', 'overdue', 'today', 'upcoming', 'undated'])
      .catch('overdue'),
  }),
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
