import { Box, Group, SimpleGrid, Text, Title, UnstyledButton } from '@mantine/core'
import { LessonCard } from '../LessonCard'
import type { LessonSummary } from '../home-dashboard.types'

interface RecentLessonsSectionProps {
  title: string
  actionLabel: string
  lessons: Array<LessonSummary>
}

export function RecentLessonsSection({
  title,
  actionLabel,
  lessons,
}: RecentLessonsSectionProps) {
  return (
    <Box component="section">
      <Group align="flex-end" justify="space-between" mb="lg" wrap="nowrap">
        <Title order={2} c="primary.6">
          {title}
        </Title>

        <UnstyledButton>
          <Text c="primary.6" fw={700} size="sm">
            {actionLabel}
          </Text>
        </UnstyledButton>
      </Group>

      <SimpleGrid cols={{ base: 1, sm: 2 }} spacing="md">
        {lessons.map((lesson) => (
          <LessonCard key={lesson.id} lesson={lesson} />
        ))}
      </SimpleGrid>
    </Box>
  )
}
