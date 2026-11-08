import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { Link } from '@tanstack/react-router'
import type { WorkAction } from './WorkQueueActionDialog'
import type { WorkRow } from '~/lib/work-queue'
import { GRADE_LABELS } from '~/data/grades'
import { getSurah } from '~/data/surahs'

const date = new Intl.DateTimeFormat('ar', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

export function WorkQueueList({
  rows,
  busy = true,
  emptyMessage,
  onAction,
}: {
  rows: ReadonlyArray<WorkRow>
  busy?: boolean
  emptyMessage?: string
  onAction?: (row: WorkRow, action: WorkAction) => void
}) {
  return (
    <Stack gap="md" aria-label="قائمة الواجبات">
      {!rows.length ? (
        <Text role="status">
          {emptyMessage ?? 'لا توجد واجبات تطابق البحث والفلاتر.'}
        </Text>
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
              <Text dir="ltr" size="sm" c="dimmed">
                @{row.username}
              </Text>
              <Text fw={700}>{getSurah(row.surahNumber).nameAr}</Text>
              <Text size="sm">
                {row.dueAt === null
                  ? 'دون موعد محدد'
                  : `الاستحقاق: ${date.format(row.dueAt)}`}
              </Text>
              <Text size="sm" c="dimmed">
                التقييم الحالي:{' '}
                {row.currentGrade === null
                  ? 'غير مسجّل'
                  : GRADE_LABELS[row.currentGrade]}
              </Text>
              {onAction ? (
                <Group gap="xs">
                  <Button
                    disabled={busy}
                    onClick={() => onAction(row, 'assess')}
                  >
                    {row.kind === 'review' ? 'إتمام المراجعة' : 'تقييم الحفظ'}
                  </Button>
                  <Button
                    variant="light"
                    disabled={busy}
                    onClick={() => onAction(row, 'reschedule')}
                  >
                    تعديل الموعد
                  </Button>
                  <Button
                    variant="subtle"
                    color="red"
                    disabled={busy}
                    onClick={() => onAction(row, 'cancel')}
                  >
                    إلغاء الواجب
                  </Button>
                </Group>
              ) : null}
              <Link
                to="/staff/students/$studentId"
                params={{ studentId: row.studentId }}
                search={{
                  tab: row.kind === 'review' ? 'reviews' : 'memorization',
                }}
                style={{ color: 'var(--app-accent-text)' }}
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
