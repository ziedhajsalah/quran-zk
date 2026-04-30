import { createFileRoute } from '@tanstack/react-router'
import {
  Box,
  Container,
  Stack,
  Tabs,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import { currentUserQuery } from '~/lib/auth-queries'
import {
  BottomNav,
  HomeTopBar,
  createHomeDashboardData,
} from '~/components/home'
import { SurahGradeList } from '~/components/surahs/SurahGradeList'
import { SurahReviewQueue } from '~/components/surahs/SurahReviewQueue'
import { StudentNotesList } from '~/components/staff/StudentNotesList'

export const Route = createFileRoute('/_protected/surahs')({
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(currentUserQuery)
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.surahGrades.listForStudent, { studentId: me.id }),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.surahReviews.listOpenForStudent, {
          studentId: me.id,
        }),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.studentNotes.listForStudent, { studentId: me.id }),
      ),
    ])
  },
  component: StudentSurahsPage,
})

function StudentSurahsPage() {
  const theme = useMantineTheme()
  const { data: me } = useSuspenseQuery(currentUserQuery)
  const { data: rows } = useSuspenseQuery(
    convexQuery(api.surahGrades.listForStudent, { studentId: me.id }),
  )
  const { data: openAssignments } = useSuspenseQuery(
    convexQuery(api.surahReviews.listOpenForStudent, { studentId: me.id }),
  )
  const { data: notes } = useSuspenseQuery(
    convexQuery(api.studentNotes.listForStudent, { studentId: me.id }),
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
              حفظي
            </Text>
            <Title order={1}>السور التي حفظتها</Title>
            <Text c="dimmed">
              قائمة السور التي درستها مع آخر تقييم سجّله معلمك.
            </Text>
          </Stack>

          <Tabs defaultValue="reviews">
            <Tabs.List>
              <Tabs.Tab value="reviews">المراجعات</Tabs.Tab>
              <Tabs.Tab value="grades">السور</Tabs.Tab>
              <Tabs.Tab value="notes">الملاحظات</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="reviews" pt="md">
              <SurahReviewQueue
                rows={openAssignments.map((a) => ({
                  assignmentId: String(a._id),
                  surahNumber: a.surahNumber,
                  assignedAt: a.assignedAt,
                  dueAt: a.dueAt,
                }))}
              />
            </Tabs.Panel>

            <Tabs.Panel value="grades" pt="md">
              <SurahGradeList
                rows={rows.map((row) => ({
                  surahNumber: row.surahNumber,
                  grade: row.grade,
                  updatedAt: row.updatedAt,
                }))}
                emptyMessage="لم تبدأ في حفظ أي سورة بعد. تواصل مع معلمك."
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
                emptyMessage="لا توجد ملاحظات من معلمك بعد"
              />
            </Tabs.Panel>
          </Tabs>
        </Stack>
      </Container>

      <BottomNav
        activeItemId="surahs"
        items={homeDashboardData.bottomNavItems}
      />
    </Box>
  )
}
