import { Group, Paper, Progress, Stack, Text, ThemeIcon, useMantineTheme } from '@mantine/core'
import { IconBook2, IconMicrophone2 } from '@tabler/icons-react'
import { formatArabicPercent } from '../home-formatters'
import { getHomeThemeTokens } from '../home-theme'
import type { LessonSummary } from '../home-dashboard.types'

interface LessonCardProps {
  lesson: LessonSummary
}

export function LessonCard({ lesson }: LessonCardProps) {
  const theme = useMantineTheme()
  const homeTokens = getHomeThemeTokens(theme)
  const LessonIcon = lesson.kind === 'reading' ? IconBook2 : IconMicrophone2

  return (
    <Paper
      p="lg"
      style={{
        borderRadius: '1.5rem',
        backgroundColor: theme.white,
        borderInlineStart: `4px solid ${theme.colors.primary[6]}`,
        boxShadow: theme.shadows.sm,
      }}
    >
      <Group align="center" gap="md" wrap="nowrap">
        <ThemeIcon
          color="primary"
          radius={homeTokens.iconRadius}
          size={64}
          variant="light"
        >
          <LessonIcon size={28} />
        </ThemeIcon>

        <Stack gap={8} style={{ flex: 1 }}>
          <Text fw={800} size="lg">
            {lesson.title}
          </Text>

          <Group gap="xs" wrap="nowrap">
            <Progress
              aria-label={lesson.title}
              color="primary"
              radius="xl"
              size="sm"
              style={{ flex: 1 }}
              value={lesson.progressPercent}
            />
            <Text c="gray.8" fw={700} size="xs">
              {formatArabicPercent(lesson.progressPercent)}
            </Text>
          </Group>

          <Text c="gray.8" size="xs">
            {lesson.lastActivityLabel}
          </Text>
        </Stack>
      </Group>
    </Paper>
  )
}
