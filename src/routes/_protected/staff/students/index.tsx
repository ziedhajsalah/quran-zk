// src/routes/_protected/staff/students/index.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Box, Container, Stack, Text, Title, useMantineTheme } from '@mantine/core'
import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { api } from '../../../../../convex/_generated/api'
import { currentUserQuery } from '~/lib/auth-queries'
import { BottomNav, HomeTopBar, createHomeDashboardData } from '~/components/home'
import { StudentsPicker } from '~/components/surahs/StudentsPicker'

export const Route = createFileRoute('/_protected/staff/students/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.surahGrades.listAllStudents, {}),
    )
  },
  component: StaffStudentsPage,
})

function StaffStudentsPage() {
  const theme = useMantineTheme()
  const navigate = useNavigate()
  const { data: me } = useSuspenseQuery(currentUserQuery)
  const { data: students } = useSuspenseQuery(
    convexQuery(api.surahGrades.listAllStudents, {}),
  )
  const homeDashboardData = useMemo(
    () => createHomeDashboardData(me.displayName),
    [me.displayName],
  )

  return (
    <Box
      style={{
        backgroundColor: theme.other.semanticColors.background,
        minHeight: '100vh',
      }}
    >
      <HomeTopBar
        brandMarkText={homeDashboardData.brandMarkText}
        brandName={homeDashboardData.brandName}
        notificationLabel={homeDashboardData.notificationLabel}
      />

      <Container
        size="xl"
        px={{ base: 'lg', sm: 'xl' }}
        py={{ base: 'lg', sm: 'xl' }}
        style={{ paddingBottom: '9rem' }}
      >
        <Stack gap="xl">
          <Stack gap="xs">
            <Text c="primary.6" fw={700} size="sm">
              إدارة الطلاب
            </Text>
            <Title order={1}>طلابك</Title>
            <Text c="dimmed">
              اختر طالبًا لعرض السور التي حفظها وتقييمه.
            </Text>
          </Stack>

          <StudentsPicker
            students={students.map((s) => ({
              id: s.id,
              displayName: s.displayName,
              username: s.username,
            }))}
            emptyMessage="لا يوجد طلاب مسجّلون بعد."
            onSelect={(studentId) =>
              navigate({
                to: '/staff/students/$studentId',
                params: { studentId },
              })
            }
          />
        </Stack>
      </Container>

      <BottomNav
        activeItemId="home"
        items={homeDashboardData.bottomNavItems}
      />
    </Box>
  )
}
