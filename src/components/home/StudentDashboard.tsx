import {
  Badge,
  Box,
  Card,
  Container,
  Grid,
  Group,
  Progress,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { ReadinessBadge } from '../surahs/AssignmentReadiness'
import { BottomNav } from './BottomNav'
import { HomeHero } from './HomeHero'
import { HomeTopBar } from './HomeTopBar'
import { createHomeDashboardData } from './home-dashboard.fixtures'
import { formatArabicNumber as number } from './home-formatters'
import type { MemorizationRow } from '~/lib/memorization'
import type { StudentDashboardSummary } from './student-dashboard'
import { GRADE_COLORS, GRADE_LABELS, GRADE_ORDER } from '~/data/grades'
import { getSurah } from '~/data/surahs'

const date = new Intl.DateTimeFormat('ar', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

export function StudentDashboard({
  studentName,
  summary,
  memorization = [],
}: {
  studentName: string
  memorization?: ReadonlyArray<MemorizationRow>
  summary: StudentDashboardSummary
}) {
  const theme = useMantineTheme()
  const chrome = createHomeDashboardData(studentName)
  return (
    <Box
      style={{
        backgroundColor: theme.other.semanticColors.background,
        minHeight: '100vh',
      }}
    >
      <HomeTopBar
        brandMarkText={chrome.brandMarkText}
        brandName={chrome.brandName}
        notificationLabel={chrome.notificationLabel}
      />
      <Container
        component="main"
        size="xl"
        px={{ base: 'lg', sm: 'xl' }}
        py="xl"
        pb="9rem"
      >
        <Stack gap="xl">
          <HomeHero
            eyebrow={chrome.heroEyebrow}
            greeting={chrome.heroGreeting}
            quote={chrome.heroQuote}
            studentName={studentName}
          />
          <Grid gutter="lg">
            <Grid.Col span={{ base: 12, md: 4 }}>
              <Card withBorder radius="lg" p="lg">
                <Stack gap="md">
                  <Title order={2}>تقدم الحفظ</Title>
                  <Text size="xl" fw={700}>
                    {number(summary.counts.good)} من{' '}
                    {number(summary.totalSurahs)} سورة متقنة
                  </Text>
                  <Progress
                    value={summary.masteryPercent}
                    aria-label="نسبة السور المتقنة"
                  />
                  <Text size="sm" c="dimmed">
                    النسبة حسب عدد السور المتقنة، وليست حسب الصفحات أو الآيات.
                  </Text>
                  {summary.recorded === 0 ? (
                    <Text>
                      لم يسجّل معلمك تقييماً بعد. تواصل معه لبدء رحلتك.
                    </Text>
                  ) : (
                    <>
                      <Text>سور مسجّلة: {number(summary.recorded)}</Text>
                      {GRADE_ORDER.map((grade) => (
                        <Group key={grade} justify="space-between">
                          <Text>{GRADE_LABELS[grade]}</Text>
                          <Badge color={GRADE_COLORS[grade]}>
                            {number(summary.counts[grade])}
                          </Badge>
                        </Group>
                      ))}
                    </>
                  )}
                  <Link to="/surahs" search={{ tab: 'grades' }}>
                    عرض تقييمات السور
                  </Link>
                </Stack>
              </Card>
            </Grid.Col>
            <Grid.Col span={{ base: 12, md: 8 }}>
              <Stack gap="lg">
                <Card withBorder radius="lg" p="lg">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={2}>ماذا أحفظ؟</Title>
                      <Badge>
                        {number(memorization.length)} واجبات حفظ مفتوحة
                      </Badge>
                    </Group>
                    {memorization.length === 0 ? (
                      <Text c="dimmed">لا توجد واجبات حفظ جديدة حالياً.</Text>
                    ) : (
                      memorization.slice(0, 5).map((assignment) => (
                        <Box key={assignment._id}>
                          <Link
                            to="/surahs"
                            search={{ tab: 'memorization' }}
                            hash={`memorization-${assignment._id}`}
                          >
                            {getSurah(assignment.surahNumber).nameAr}
                          </Link>
                          <ReadinessBadge readyAt={assignment.readyAt} />
                          <Text size="sm" c="dimmed">
                            {assignment.dueAt === null
                              ? 'دون موعد محدد'
                              : `الاستحقاق: ${date.format(assignment.dueAt)}`}
                          </Text>
                        </Box>
                      ))
                    )}
                    <Link to="/surahs" search={{ tab: 'memorization' }}>
                      عرض كل واجبات الحفظ
                    </Link>
                  </Stack>
                </Card>
                <Card withBorder radius="lg" p="lg">
                  <Stack gap="md">
                    <Group justify="space-between">
                      <Title order={2}>ماذا أراجع اليوم؟</Title>
                      <Badge>
                        {number(summary.reviewCount)} مراجعات مفتوحة
                      </Badge>
                    </Group>
                    {summary.reviewCount === 0 ? (
                      <Text c="dimmed">
                        لا توجد مراجعات مسندة إليك حالياً. يمكنك مراجعة السور
                        التي تحتاج إلى تثبيت مع معلمك.
                      </Text>
                    ) : (
                      <>
                        <Text>
                          متأخرة: {number(summary.overdue)} · مستحقة اليوم:{' '}
                          {number(summary.dueToday)}
                        </Text>
                        {summary.reviews.map((review) => (
                          <Box key={review._id}>
                            <Link
                              style={{
                                color: 'var(--app-accent-text)',
                                textUnderlineOffset: '0.2em',
                              }}
                              to="/surahs"
                              search={{ tab: 'reviews' }}
                              hash={`review-${review._id}`}
                            >
                              {getSurah(review.surahNumber).nameAr}
                            </Link>
                            <ReadinessBadge readyAt={review.readyAt} />
                            <Text size="sm" c="dimmed">
                              {review.dueAt === null
                                ? 'دون موعد محدد'
                                : `الاستحقاق: ${date.format(review.dueAt)}`}
                            </Text>
                          </Box>
                        ))}
                      </>
                    )}
                    <Link to="/surahs" search={{ tab: 'reviews' }}>
                      عرض كل المراجعات
                    </Link>
                  </Stack>
                </Card>
                <Card withBorder radius="lg" p="lg">
                  <Stack gap="md">
                    <Title order={2}>آخر ملاحظات المعلم</Title>
                    {summary.notes.length === 0 ? (
                      <Text c="dimmed">لا توجد ملاحظات من معلمك بعد.</Text>
                    ) : (
                      summary.notes.map((note) => (
                        <Box
                          key={note._id}
                          style={{ overflowWrap: 'anywhere' }}
                        >
                          <Text fw={700}>{note.authorDisplayName}</Text>
                          <Text size="sm" c="dimmed">
                            {date.format(note.createdAt)}
                            {note.editedAt !== null ? ' · تم التعديل' : ''}
                          </Text>
                          <Text
                            lineClamp={3}
                            style={{ whiteSpace: 'pre-wrap' }}
                          >
                            {note.body}
                          </Text>
                        </Box>
                      ))
                    )}
                    <Link to="/surahs" search={{ tab: 'notes' }}>
                      عرض كل الملاحظات
                    </Link>
                  </Stack>
                </Card>
              </Stack>
            </Grid.Col>
          </Grid>
        </Stack>
      </Container>
      <BottomNav activeItemId="home" items={chrome.bottomNavItems} />
    </Box>
  )
}
