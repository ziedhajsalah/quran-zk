// src/routes/_protected/staff/students/$studentId.tsx
import { createFileRoute } from '@tanstack/react-router'
import {
  Avatar,
  Box,
  Container,
  Group,
  Notification,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../../../../convex/_generated/api'
import { currentUserQuery } from '~/lib/auth-queries'
import { extractActionErrorMessage } from '~/lib/convex-errors'
import {
  BottomNav,
  HomeTopBar,
  createHomeDashboardData,
} from '~/components/home'
import { SurahGradeList } from '~/components/surahs/SurahGradeList'
import { AddSurahDrawer } from '~/components/surahs/AddSurahDrawer'

export const Route = createFileRoute('/_protected/staff/students/$studentId')({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.surahGrades.listAllStudents, {}),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.surahGrades.listForStudent, {
          studentId: params.studentId,
        }),
      ),
    ])
  },
  component: StaffStudentGradingPage,
})

function StaffStudentGradingPage() {
  const theme = useMantineTheme()
  const { studentId } = Route.useParams()
  const { data: me } = useSuspenseQuery(currentUserQuery)
  const { data: students } = useSuspenseQuery(
    convexQuery(api.surahGrades.listAllStudents, {}),
  )
  const { data: rows } = useSuspenseQuery(
    convexQuery(api.surahGrades.listForStudent, { studentId }),
  )
  const setGrade = useMutation(api.surahGrades.setGrade)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const homeDashboardData = useMemo(
    () => createHomeDashboardData(me.displayName),
    [me.displayName],
  )

  const student = students.find((s) => s.id === studentId)

  async function handleChangeGrade(
    surahNumber: number,
    grade: 'good' | 'medium' | 'forgotten',
  ) {
    setErrorMessage(null)
    try {
      await setGrade({ studentId, surahNumber, grade })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر حفظ التقييم.'))
    }
  }

  async function handleAddSurah(input: {
    surahNumber: number
    grade: 'good' | 'medium' | 'forgotten'
  }) {
    setErrorMessage(null)
    try {
      await setGrade({ studentId, ...input })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر إضافة السورة.'))
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
          <Group wrap="nowrap" align="flex-start">
            <Avatar color="primary" radius="xl" size={56}>
              {getInitials(student?.displayName ?? '')}
            </Avatar>
            <Stack gap={4} style={{ minWidth: 0 }}>
              <Text c="primary.6" fw={700} size="sm">
                تقييم الطالب
              </Text>
              <Title order={1} lineClamp={1}>
                {student?.displayName ?? 'طالب غير معروف'}
              </Title>
              <Text c="dimmed" size="sm">
                {student?.username ? `@${student.username}` : ''}
              </Text>
            </Stack>
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

          <SurahGradeList
            rows={rows.map((r) => ({
              surahNumber: r.surahNumber,
              grade: r.grade,
              updatedAt: r.updatedAt,
            }))}
            emptyMessage="لم يبدأ هذا الطالب الحفظ بعد. أضف أول سورة."
            editable
            onChangeGrade={handleChangeGrade}
            onAddSurah={() => setDrawerOpen(true)}
          />
        </Stack>
      </Container>

      <AddSurahDrawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        excludeSurahNumbers={rows.map((r) => r.surahNumber)}
        onSubmit={handleAddSurah}
      />

      <BottomNav
        activeItemId="home"
        items={homeDashboardData.bottomNavItems}
      />
    </Box>
  )
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
  return initials || '؟'
}
