import { Box, Stack, Title } from '@mantine/core'
import { CourseCard } from '../CourseCard'
import type { CourseSummary } from '../home-dashboard.types'

interface CoursesSectionProps {
  title: string
  courses: Array<CourseSummary>
}

export function CoursesSection({ title, courses }: CoursesSectionProps) {
  return (
    <Box component="section">
      <Title c="primary.6" mb="lg" order={2}>
        {title}
      </Title>

      <Stack gap="md">
        {courses.map((course) => (
          <CourseCard key={course.id} course={course} />
        ))}
      </Stack>
    </Box>
  )
}
