// src/routes/_protected/staff/students/$studentId.tsx
import { createFileRoute } from '@tanstack/react-router'
import {
  Avatar,
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
import { IconClipboardPlus } from '@tabler/icons-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { currentUserQuery } from '~/lib/auth-queries'
import { extractActionErrorMessage } from '~/lib/convex-errors'
import {
  BottomNav,
  HomeTopBar,
  createHomeDashboardData,
} from '~/components/home'
import { SurahGradeList } from '~/components/surahs/SurahGradeList'
import { AddSurahDrawer } from '~/components/surahs/AddSurahDrawer'
import { SurahReviewQueue } from '~/components/surahs/SurahReviewQueue'
import { AssignReviewDrawer } from '~/components/surahs/AssignReviewDrawer'
import { CloseAssignmentDialog } from '~/components/surahs/CloseAssignmentDialog'
import { getSurah } from '~/data/surahs'

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
      context.queryClient.ensureQueryData(
        convexQuery(api.surahReviews.listOpenForStudent, {
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
  const { data: openAssignments } = useSuspenseQuery(
    convexQuery(api.surahReviews.listOpenForStudent, { studentId }),
  )

  const setGrade = useMutation(api.surahGrades.setGrade)
  const assignReview = useMutation(api.surahReviews.assign)
  const closeReview = useMutation(api.surahReviews.close)
  const cancelReview = useMutation(api.surahReviews.cancel)

  const [addSurahOpen, setAddSurahOpen] = useState(false)
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false)
  const [closingAssignmentId, setClosingAssignmentId] =
    useState<Id<'surahReviewAssignments'> | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const homeDashboardData = useMemo(
    () => createHomeDashboardData(me.displayName),
    [me.displayName],
  )

  const student = students.find((s) => s.id === studentId)

  const closingAssignment = useMemo(
    () =>
      closingAssignmentId
        ? openAssignments.find((a) => a._id === closingAssignmentId) ?? null
        : null,
    [closingAssignmentId, openAssignments],
  )
  const closingSurah = closingAssignment
    ? getSurah(closingAssignment.surahNumber)
    : null
  const closingCurrentGrade = closingAssignment
    ? rows.find((r) => r.surahNumber === closingAssignment.surahNumber)?.grade ??
      null
    : null

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

  async function handleAssignReview(input: {
    surahNumber: number
    dueAt?: number
  }) {
    setErrorMessage(null)
    try {
      await assignReview({ studentId, ...input })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر إسناد المراجعة.'))
    }
  }

  async function handleCloseAssignment(input: {
    newGrade?: 'good' | 'medium' | 'forgotten'
  }) {
    if (!closingAssignmentId) return
    setErrorMessage(null)
    try {
      await closeReview({
        assignmentId: closingAssignmentId,
        ...(input.newGrade !== undefined ? { newGrade: input.newGrade } : {}),
      })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر إغلاق المراجعة.'))
    }
  }

  async function handleCancelAssignment(assignmentId: string) {
    if (!window.confirm('هل تريد إلغاء هذه المراجعة؟')) return
    setErrorMessage(null)
    try {
      await cancelReview({
        assignmentId: assignmentId as Id<'surahReviewAssignments'>,
      })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر إلغاء المراجعة.'))
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

          <Group justify="flex-end">
            <Button
              leftSection={<IconClipboardPlus size={16} />}
              onClick={() => setAssignDrawerOpen(true)}
              variant="light"
            >
              إسناد مراجعة
            </Button>
          </Group>

          <SurahReviewQueue
            rows={openAssignments.map((a) => ({
              assignmentId: String(a._id),
              surahNumber: a.surahNumber,
              assignedAt: a.assignedAt,
              dueAt: a.dueAt,
            }))}
            editable
            onClose={(assignmentId) =>
              setClosingAssignmentId(
                assignmentId as Id<'surahReviewAssignments'>,
              )
            }
            onCancel={handleCancelAssignment}
          />

          <SurahGradeList
            rows={rows.map((r) => ({
              surahNumber: r.surahNumber,
              grade: r.grade,
              updatedAt: r.updatedAt,
            }))}
            emptyMessage="لم يبدأ هذا الطالب الحفظ بعد. أضف أول سورة."
            editable
            onChangeGrade={handleChangeGrade}
            onAddSurah={() => setAddSurahOpen(true)}
          />
        </Stack>
      </Container>

      <AddSurahDrawer
        opened={addSurahOpen}
        onClose={() => setAddSurahOpen(false)}
        excludeSurahNumbers={rows.map((r) => r.surahNumber)}
        onSubmit={handleAddSurah}
      />

      <AssignReviewDrawer
        opened={assignDrawerOpen}
        onClose={() => setAssignDrawerOpen(false)}
        memorizedSurahNumbers={rows.map((r) => r.surahNumber)}
        excludeSurahNumbers={openAssignments.map((a) => a.surahNumber)}
        onSubmit={handleAssignReview}
      />

      <CloseAssignmentDialog
        opened={closingAssignmentId !== null}
        onClose={() => setClosingAssignmentId(null)}
        surah={closingSurah}
        currentGrade={closingCurrentGrade}
        onSubmit={handleCloseAssignment}
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
