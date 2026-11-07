import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import type { WorkRow } from '~/lib/work-queue'
import { getSurah } from '~/data/surahs'

const date = new Intl.DateTimeFormat('ar', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

export function WorkQueueList({ rows }: { rows: ReadonlyArray<WorkRow> }) {
  return (
    <Stack gap="md" aria-label="قائمة الواجبات">
      {!rows.length ? (
        <Text role="status">لا توجد واجبات تطابق البحث والفلاتر.</Text>
      ) : (
        rows.map((row) => (
          <Card
            key={`${row.kind}-${row.id}`}
            component="article"
            withBorder
            radius="lg"
            p="lg"
            style={{ overflowWrap: 'anywhere' }}
          >
            <Stack gap="sm">
              <Group justify="space-between">
                <Title order={2} size="h3">
                  {row.displayName}
                </Title>
                <Badge
                  variant="light"
                  color={row.kind === 'review' ? 'orange' : 'blue'}
                >
                  {row.kind === 'review' ? 'مراجعة' : 'حفظ جديد'}
                </Badge>
              </Group>
              <Text dir="ltr" size="sm" c="gray.7">
                @{row.username}
              </Text>
              <Text fw={700}>{getSurah(row.surahNumber).nameAr}</Text>
              <Text size="sm">
                {row.dueAt === null
                  ? 'دون موعد محدد'
                  : `الاستحقاق: ${date.format(row.dueAt)}`}
              </Text>
              <Link
                to="/staff/students/$studentId"
                params={{ studentId: row.studentId }}
                search={{
                  tab: row.kind === 'review' ? 'reviews' : 'memorization',
                }}
                hash={`${row.kind === 'review' ? 'review' : 'memorization'}-${row.id}`}
              >
                فتح الواجب
              </Link>
            </Stack>
          </Card>
        ))
      )}
    </Stack>
  )
}
