import { createFileRoute } from '@tanstack/react-router'
import {
  Avatar,
  Box,
  Button,
  Container,
  Group,
  Notification,
  Stack,
  Tabs,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { IconClipboardPlus } from '@tabler/icons-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import type {
  BatchReviewInput,
  BatchReviewResult,
} from '~/lib/review-assignment'
import { MemorizationPanel } from '~/components/surahs/Memorization/MemorizationPanel'
import { GradeHistoryPanel } from '~/components/surahs/GradeHistory/GradeHistoryPanel'
import { ReviewHistoryPanel } from '~/components/surahs/ReviewHistory/ReviewHistoryPanel'
import { extractActionErrorMessage } from '~/lib/action-errors'
import {
  gradesQuery,
  notesQuery,
  reviewsQuery,
  studentsQuery,
  useAppMutation,
} from '~/lib/queries'
import * as noteFunctions from '~/server/functions/notes'
import * as grades from '~/server/functions/grades'
import * as reviews from '~/server/functions/reviews'
// src/routes/_protected/staff/students/$studentId.tsx
import { currentUserQuery } from '~/lib/auth-queries'
import {
  BottomNav,
  HomeTopBar,
  createHomeDashboardData,
} from '~/components/home'
import { SurahGradeList } from '~/components/surahs/SurahGradeList'
import { AddSurahDrawer } from '~/components/surahs/AddSurahDrawer'
import { EditableReviewQueue } from '~/components/surahs/EditableReviewQueue'
import { AssignReviewDrawer } from '~/components/surahs/AssignReviewDrawer'
import { CloseAssignmentDialog } from '~/components/surahs/CloseAssignmentDialog'
import { StudentNotesList } from '~/components/staff/StudentNotesList'
import { AddNoteDrawer } from '~/components/staff/AddNoteDrawer'
import { DeleteNoteDialog } from '~/components/staff/DeleteNoteDialog'
import { getSurah } from '~/data/surahs'
import { formatArabicNumber } from '~/components/home/home-formatters'

export const Route = createFileRoute('/_protected/staff/students/$studentId')({
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    tab?:
      'reviews' | 'grades' | 'notes' | 'history' | 'progress' | 'memorization'
  } => ({
    tab:
      search.tab === 'grades' ||
      search.tab === 'notes' ||
      search.tab === 'history' ||
      search.tab === 'progress' ||
      search.tab === 'memorization'
        ? search.tab
        : 'reviews',
  }),
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(studentsQuery()),
      context.queryClient.ensureQueryData(gradesQuery(params.studentId)),
      context.queryClient.ensureQueryData(reviewsQuery(params.studentId)),
      context.queryClient.ensureQueryData(notesQuery(params.studentId)),
    ])
  },
  component: StaffStudentGradingPage,
})

function StaffStudentGradingPage() {
  const theme = useMantineTheme()
  const { tab } = Route.useSearch()
  const navigate = Route.useNavigate()
  const { studentId } = Route.useParams()
  const { data: me } = useSuspenseQuery(currentUserQuery)
  const { data: students } = useSuspenseQuery(studentsQuery())
  const { data: rows } = useSuspenseQuery(gradesQuery(studentId))
  const { data: openAssignments } = useSuspenseQuery(reviewsQuery(studentId))
  const { data: notes } = useSuspenseQuery(notesQuery(studentId))

  const setGrade = useAppMutation(grades.setGrade, ['grades'])
  const assignReview = useAppMutation(reviews.assignBatch, ['reviews'])
  const closeReview = useAppMutation(reviews.close, ['grades', 'reviews'])
  const cancelReview = useAppMutation(reviews.cancel, ['reviews'])
  const addNote = useAppMutation(noteFunctions.add, ['notes'])
  const editNote = useAppMutation(noteFunctions.edit, ['notes'])
  const removeNote = useAppMutation(noteFunctions.remove, ['notes'])

  const [addSurahOpen, setAddSurahOpen] = useState(false)
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false)
  const [assignmentResult, setAssignmentResult] =
    useState<BatchReviewResult | null>(null)
  const [closingAssignment, setClosingAssignment] = useState<{
    id: string
    surahNumber: number
    currentGrade: (typeof rows)[number]['grade'] | null
  } | null>(null)
  const closingAssignmentId = closingAssignment?.id ?? null
  const [noteDrawerOpen, setNoteDrawerOpen] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const homeDashboardData = useMemo(
    () => createHomeDashboardData(me.displayName),
    [me.displayName],
  )

  const student = students.find((s) => s.id === studentId)

  const closingSurah = closingAssignment
    ? getSurah(closingAssignment.surahNumber)
    : null
  const closingCurrentGrade = closingAssignment?.currentGrade ?? null

  const editingNote = useMemo(
    () =>
      editingNoteId
        ? (notes.find((n) => n._id === editingNoteId) ?? null)
        : null,
    [editingNoteId, notes],
  )

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

  async function handleAssignReview(input: BatchReviewInput) {
    setErrorMessage(null)
    setAssignmentResult(null)
    const result = await assignReview({ studentId, ...input })
    setAssignmentResult(result)
    return result
  }

  async function handleCloseAssignment(input: {
    newGrade?: 'good' | 'medium' | 'forgotten'
    nextReviewDueAt?: number
    feedback?: string
  }) {
    if (!closingAssignmentId)
      throw new Error('حدّث القائمة وأعد اختيار المراجعة.')
    await closeReview({ assignmentId: closingAssignmentId, ...input })
  }

  async function handleCancelAssignment(assignmentId: string) {
    if (!window.confirm('هل تريد إلغاء هذه المراجعة؟')) return
    setErrorMessage(null)
    try {
      await cancelReview({
        assignmentId: assignmentId,
      })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر إلغاء المراجعة.'))
    }
  }

  async function handleSubmitNote(body: string) {
    setErrorMessage(null)
    try {
      if (editingNoteId) {
        await editNote({ noteId: editingNoteId, body })
      } else {
        await addNote({ studentId, body })
      }
    } catch (error) {
      setErrorMessage(
        extractActionErrorMessage(
          error,
          editingNoteId ? 'تعذر تعديل الملاحظة.' : 'تعذر إضافة الملاحظة.',
        ),
      )
      throw error
    }
  }

  async function handleDeleteNote() {
    if (!deletingNoteId) return
    setErrorMessage(null)
    try {
      await removeNote({ noteId: deletingNoteId })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر حذف الملاحظة.'))
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
        pb="9rem"
      >
        <Stack gap="xl">
          <Group wrap="nowrap" align="flex-start">
            <Avatar color="primary" radius="xl" size={56}>
              {getInitials(student?.displayName ?? '')}
            </Avatar>
            <Stack gap={4} style={{ minWidth: 0 }}>
              <Text c="var(--app-accent-text)" fw={700} size="sm">
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

          {assignmentResult ? (
            <Notification
              color={
                assignmentResult.assignedSurahNumbers.length > 0
                  ? 'teal'
                  : 'orange'
              }
              title={
                assignmentResult.assignedSurahNumbers.length > 0
                  ? 'تم إسناد المراجعات'
                  : 'لم تُضف مراجعات جديدة'
              }
              onClose={() => setAssignmentResult(null)}
            >
              أُسندت{' '}
              {formatArabicNumber(assignmentResult.assignedSurahNumbers.length)}{' '}
              مراجعات.
              {assignmentResult.skippedSurahNumbers.length > 0
                ? ` تم تجاوز ${formatArabicNumber(assignmentResult.skippedSurahNumbers.length)} سور لديها مراجعات مفتوحة بالفعل.`
                : ''}
            </Notification>
          ) : null}

          <Tabs
            value={tab}
            keepMounted={false}
            onChange={(value) => {
              if (
                value === 'reviews' ||
                value === 'grades' ||
                value === 'notes' ||
                value === 'history' ||
                value === 'progress' ||
                value === 'memorization'
              )
                void navigate({
                  search: { tab: value },
                  hash: '',
                  replace: true,
                })
            }}
          >
            <Tabs.List>
              <Tabs.Tab value="memorization">حفظ جديد</Tabs.Tab>
              <Tabs.Tab value="reviews">المراجعات</Tabs.Tab>
              <Tabs.Tab value="grades">السور</Tabs.Tab>
              <Tabs.Tab value="notes">الملاحظات</Tabs.Tab>
              <Tabs.Tab value="history">السجل</Tabs.Tab>
              <Tabs.Tab value="progress">التقدّم</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="reviews" pt="md">
              <Stack gap="md">
                <Group justify="flex-end">
                  <Button
                    leftSection={<IconClipboardPlus size={16} />}
                    onClick={() => {
                      setAssignmentResult(null)
                      setAssignDrawerOpen(true)
                    }}
                    variant="light"
                  >
                    إسناد مراجعة
                  </Button>
                </Group>
                <EditableReviewQueue
                  key={studentId}
                  rows={openAssignments.map((a) => ({
                    assignmentId: String(a._id),
                    surahNumber: a.surahNumber,
                    assignedAt: a.assignedAt,
                    dueAt: a.dueAt,
                    readyAt: a.readyAt,
                  }))}
                  onClose={(assignmentId) => {
                    const assignment = openAssignments.find(
                      (row) => row._id === assignmentId,
                    )
                    if (assignment)
                      setClosingAssignment({
                        id: assignmentId,
                        surahNumber: assignment.surahNumber,
                        currentGrade:
                          rows.find(
                            (row) => row.surahNumber === assignment.surahNumber,
                          )?.grade ?? null,
                      })
                  }}
                  onCancel={handleCancelAssignment}
                />
              </Stack>
            </Tabs.Panel>

            <Tabs.Panel value="grades" pt="md">
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
            </Tabs.Panel>

            <Tabs.Panel value="notes" pt="md">
              <StudentNotesList
                rows={notes.map((n) => ({
                  noteId: String(n._id),
                  authorDisplayName: n.authorDisplayName,
                  authorId: n.authorId,
                  createdAt: n.createdAt,
                  editedAt: n.editedAt,
                  body: n.body,
                }))}
                currentUserId={String(me.id)}
                onAdd={() => {
                  setEditingNoteId(null)
                  setNoteDrawerOpen(true)
                }}
                onEdit={(noteId) => {
                  setEditingNoteId(noteId)
                  setNoteDrawerOpen(true)
                }}
                onDelete={(noteId) => setDeletingNoteId(noteId)}
              />
            </Tabs.Panel>
            <Tabs.Panel value="memorization" pt="md">
              <MemorizationPanel
                key={studentId}
                studentId={studentId}
                recordedSurahNumbers={rows.map((row) => row.surahNumber)}
                editable
              />
            </Tabs.Panel>
            <Tabs.Panel value="progress" pt="md">
              <GradeHistoryPanel key={studentId} studentId={studentId} />
            </Tabs.Panel>
            <Tabs.Panel value="history" pt="md">
              <ReviewHistoryPanel key={studentId} studentId={studentId} />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Container>

      <AddSurahDrawer
        opened={addSurahOpen}
        onClose={() => setAddSurahOpen(false)}
        excludeSurahNumbers={rows.map((r) => r.surahNumber)}
        onSubmit={handleAddSurah}
      />

      <AssignReviewDrawer
        key={studentId}
        opened={assignDrawerOpen}
        onClose={() => setAssignDrawerOpen(false)}
        memorizedSurahNumbers={rows.map((r) => r.surahNumber)}
        excludeSurahNumbers={openAssignments.map((a) => a.surahNumber)}
        onSubmit={handleAssignReview}
      />

      <CloseAssignmentDialog
        key={closingAssignmentId ?? 'closed'}
        opened={closingAssignmentId !== null}
        onClose={() => setClosingAssignment(null)}
        surah={closingSurah}
        currentGrade={closingCurrentGrade}
        onSubmit={handleCloseAssignment}
      />

      <AddNoteDrawer
        opened={noteDrawerOpen}
        onClose={() => {
          setNoteDrawerOpen(false)
          setEditingNoteId(null)
        }}
        initialBody={editingNote?.body}
        onSubmit={handleSubmitNote}
      />

      <DeleteNoteDialog
        opened={deletingNoteId !== null}
        onClose={() => setDeletingNoteId(null)}
        onConfirm={handleDeleteNote}
      />

      <BottomNav activeItemId="home" items={homeDashboardData.bottomNavItems} />
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
