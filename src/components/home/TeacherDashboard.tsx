import {
  Badge,
  Box,
  Card,
  Container,
  Grid,
  Group,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { Link } from '@tanstack/react-router'
import { BottomNav } from './BottomNav'
import { HomeTopBar } from './HomeTopBar'
import { createHomeDashboardData } from './home-dashboard.fixtures'
import { formatArabicNumber as number } from './home-formatters'
import type { TeacherDashboardData } from '~/lib/teacher-dashboard'
import { defaultWorkFilters } from '~/lib/work-queue'

const date = new Intl.DateTimeFormat('ar', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

export function TeacherDashboard({
  displayName,
  data,
}: {
  displayName: string
  data: TeacherDashboardData
}) {
  const theme = useMantineTheme()
  const chrome = createHomeDashboardData(displayName)
  const linkStyle = {
    color: 'var(--app-accent-text)',
    textUnderlineOffset: '0.2em',
  }
  const stats = [
    { label: 'الطلاب النشطون', value: data.totalStudents },
    { label: 'طلاب يحتاجون إلى متابعة', value: data.attentionStudents },
    { label: 'المراجعات المتأخرة', value: data.overdueReviews },
    { label: 'واجبات الحفظ المتأخرة', value: data.overdueMemorization },
    { label: 'طلاب لديهم سور تحتاج مراجعة', value: data.studentsNeedingReview },
  ]
  return (
    <Box
      style={{
        backgroundColor: theme.other.semanticColors.background,
        minHeight: '100vh',
      }}
    >
      <HomeTopBar
        brandName={chrome.brandName}
        brandMarkText={chrome.brandMarkText}
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
          <Stack gap="xs">
            <Text c="var(--app-accent-text)" fw={700}>
              أهلاً بك، {displayName}
            </Text>
            <Title order={1}>متابعة الطلاب</Title>
            <Text c="dimmed">
              نظرة على جميع الطلاب النشطين في المدرسة، لمساعدتك على تحديد من
              يحتاج إلى دعم اليوم.
            </Text>
            <Group gap="lg">
              <Link
                to="/staff/work"
                search={defaultWorkFilters}
                style={linkStyle}
              >
                قائمة الواجبات
              </Link>
              <Link to="/staff/students" style={linkStyle}>
                عرض جميع الطلاب
              </Link>
            </Group>
          </Stack>
          <Grid gutter="md">
            {stats.map((stat) => (
              <Grid.Col key={stat.label} span={{ base: 6, md: 4 }}>
                <Card withBorder radius="lg" p="lg" h="100%">
                  <Text fw={700} size="xl">
                    {number(stat.value)}
                  </Text>
                  <Text size="sm" c="dimmed">
                    {stat.label}
                  </Text>
                </Card>
              </Grid.Col>
            ))}
          </Grid>
          <Stack gap="md">
            <Title order={2}>الأولوية للمتابعة</Title>
            <Text size="sm" c="dimmed">
              الأقدم في المراجعات أو واجبات الحفظ المتأخرة أولاً، ثم الأكثر
              سوراً بتقييم «يحتاج مراجعة». الواجبات المستحقة اليوم ليست متأخرة.
            </Text>
            {data.totalStudents === 0 ? (
              <Card withBorder radius="lg" p="xl">
                <Text>
                  لا يوجد طلاب نشطون بعد. أضف طالباً من قائمة الطلاب لبدء
                  المتابعة.
                </Text>
              </Card>
            ) : data.attentionStudents === 0 ? (
              <Card withBorder radius="lg" p="xl">
                <Text>
                  لا توجد مراجعات أو واجبات حفظ متأخرة أو سور بتقييم «يحتاج
                  مراجعة» حالياً.
                </Text>
              </Card>
            ) : (
              <>
                <Text size="sm" c="dimmed">
                  عرض {number(data.students.length)} من{' '}
                  {number(data.attentionStudents)} طالب يحتاج إلى متابعة.
                </Text>
                {data.students.map((student) => (
                  <Card
                    key={student.studentId}
                    component="article"
                    withBorder
                    radius="lg"
                    p="lg"
                    style={{ overflowWrap: 'anywhere' }}
                  >
                    <Stack gap="md">
                      <Group justify="space-between" align="flex-start">
                        <Stack gap={2}>
                          <Title order={3}>{student.displayName}</Title>
                          <Text size="sm" c="dimmed" dir="ltr">
                            @{student.username}
                          </Text>
                        </Stack>
                        <Group gap="xs">
                          {student.overdueCount > 0 ? (
                            <Badge color="orange" variant="light">
                              {number(student.overdueCount)} مراجعات متأخرة
                            </Badge>
                          ) : null}
                          {student.overdueMemorizationCount > 0 ? (
                            <Badge color="red" variant="light">
                              {number(student.overdueMemorizationCount)} واجبات
                              حفظ متأخرة
                            </Badge>
                          ) : null}
                          {student.forgottenCount > 0 ? (
                            <Badge color="yellow" variant="light">
                              {number(student.forgottenCount)} سور تحتاج مراجعة
                            </Badge>
                          ) : null}
                        </Group>
                      </Group>
                      {student.oldestDueAt !== null ? (
                        <Text size="sm" c="dimmed">
                          أقدم موعد متأخر: {date.format(student.oldestDueAt)}
                        </Text>
                      ) : null}
                      <Group gap="lg">
                        <Link
                          to="/staff/students/$studentId"
                          params={{ studentId: student.studentId }}
                          search={{ tab: 'memorization' }}
                          style={linkStyle}
                        >
                          واجبات حفظ الطالب
                        </Link>
                        <Link
                          to="/staff/students/$studentId"
                          params={{ studentId: student.studentId }}
                          search={{ tab: 'reviews' }}
                          style={linkStyle}
                        >
                          مراجعات الطالب
                        </Link>
                        <Link
                          to="/staff/students/$studentId"
                          params={{ studentId: student.studentId }}
                          search={{ tab: 'grades' }}
                          style={linkStyle}
                        >
                          تقييمات السور
                        </Link>
                        <Link
                          to="/staff/students/$studentId"
                          params={{ studentId: student.studentId }}
                          search={{ tab: 'notes' }}
                          style={linkStyle}
                        >
                          ملاحظات الطالب
                        </Link>
                      </Group>
                    </Stack>
                  </Card>
                ))}
                {data.attentionStudents > data.students.length ? (
                  <Link to="/staff/students" style={linkStyle}>
                    ابحث عن بقية الطلاب في القائمة الكاملة
                  </Link>
                ) : null}
              </>
            )}
          </Stack>
        </Stack>
      </Container>
      <BottomNav activeItemId="home" items={chrome.bottomNavItems} />
    </Box>
  )
}
