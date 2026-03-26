import { ActionIcon, Box, Group, Paper, Stack, Text, useMantineTheme } from '@mantine/core'
import { IconArrowLeft, IconBook2, IconClockHour4, IconUsersGroup } from '@tabler/icons-react'
import { formatArabicNumber } from '../home-formatters'
import { getHomeThemeTokens } from '../home-theme'
import type { CourseSummary } from '../home-dashboard.types'

interface CourseCardProps {
  course: CourseSummary
}

export function CourseCard({ course }: CourseCardProps) {
  const theme = useMantineTheme()
  const homeTokens = getHomeThemeTokens(theme)
  const artworkGradient =
    course.artworkTone === 'primary'
      ? `linear-gradient(145deg, ${theme.colors.primary[2]}, ${theme.colors.primary[6]})`
      : `linear-gradient(145deg, ${theme.colors.tertiary[1]}, ${theme.colors.tertiary[5]})`
  const artworkForeground =
    course.artworkTone === 'primary' ? theme.white : theme.colors.tertiary[8]

  return (
    <Paper
      p={{ base: 'lg', sm: 'xl' }}
      style={{
        borderRadius: homeTokens.cardRadius,
        backgroundColor: theme.colors.gray[2],
      }}
    >
      <Stack gap="lg">
        <Group align="flex-start" gap="lg" wrap="nowrap">
          <Box
            aria-label={course.artworkLabel}
            role="img"
            style={{
              display: 'grid',
              placeItems: 'center',
              width: 80,
              height: 80,
              borderRadius: '1.25rem',
              background: artworkGradient,
              boxShadow: theme.shadows.sm,
              color: artworkForeground,
              flexShrink: 0,
            }}
          >
            <IconBook2 size={34} />
          </Box>

          <Stack gap={10} style={{ flex: 1, minWidth: 0 }}>
            <Text fw={800} size="xl" style={{ lineHeight: 1.4 }}>
              {course.title}
            </Text>

            <Group c="gray.8" gap="md">
              <Group gap={4} wrap="nowrap">
                <IconUsersGroup size={16} />
                <Text size="sm">
                  {formatArabicNumber(course.studentCount)} طالب
                </Text>
              </Group>

              <Group gap={4} wrap="nowrap">
                <IconClockHour4 size={16} />
                <Text size="sm">
                  {formatArabicNumber(course.durationWeeks)} أسابيع
                </Text>
              </Group>
            </Group>
          </Stack>
        </Group>

        <Group justify="space-between" wrap="nowrap">
          <Box>
            <Text c="gray.8" size="xs" mb={4}>
              المعلم
            </Text>
            <Text c="primary.6" fw={800}>
              {course.teacherName}
            </Text>
          </Box>

          <ActionIcon
            aria-label={course.actionLabel}
            color="primary"
            radius={homeTokens.iconRadius}
            size={48}
            variant="filled"
          >
            <IconArrowLeft size={22} />
          </ActionIcon>
        </Group>
      </Stack>
    </Paper>
  )
}
