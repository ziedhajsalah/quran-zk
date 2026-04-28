// src/routes/_protected/staff/students/index.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import {
  Box,
  Button,
  Container,
  Group,
  Notification,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { convexQuery } from '@convex-dev/react-query'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useAction } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../../../../convex/_generated/api'
import { currentUserQuery } from '~/lib/auth-queries'
import { extractActionErrorMessage } from '~/lib/convex-errors'
import { BottomNav, HomeTopBar, createHomeDashboardData } from '~/components/home'
import { StudentsPicker } from '~/components/surahs/StudentsPicker'
import { CreateStudentDrawer } from '~/components/staff/CreateStudentDrawer'

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
  const createStudent = useAction(api.auth.admin.staffCreateStudent)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const homeDashboardData = useMemo(
    () => createHomeDashboardData(me.displayName),
    [me.displayName],
  )

  async function handleCreateStudent(input: {
    username: string
    displayName: string
    email: string | null
    password: string
  }) {
    setErrorMessage(null)
    try {
      await createStudent(input)
    } catch (error) {
      const message = extractActionErrorMessage(error, 'تعذر إنشاء الحساب.')
      setErrorMessage(message)
      throw error
    }
  }

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
          <Group justify="space-between" align="flex-end" wrap="nowrap">
            <Stack gap="xs" style={{ minWidth: 0 }}>
              <Text c="primary.6" fw={700} size="sm">
                إدارة الطلاب
              </Text>
              <Title order={1}>طلابك</Title>
              <Text c="dimmed">
                اختر طالبًا لعرض السور التي حفظها وتقييمه.
              </Text>
            </Stack>
            <Button
              leftSection={<IconPlus size={16} />}
              onClick={() => setDrawerOpen(true)}
            >
              طالب جديد
            </Button>
          </Group>

          {errorMessage ? (
            <Notification
              color="red"
              title="حدث خطأ"
              onClose={() => setErrorMessage(null)}
            >
              {errorMessage}
            </Notification>
          ) : null}

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

      <CreateStudentDrawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleCreateStudent}
      />

      <BottomNav
        activeItemId="home"
        items={homeDashboardData.bottomNavItems}
      />
    </Box>
  )
}
