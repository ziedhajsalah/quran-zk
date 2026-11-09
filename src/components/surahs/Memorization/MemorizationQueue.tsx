import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import { AssignmentReadiness, ReadinessBadge } from '../AssignmentReadiness'
import type { MemorizationRow } from '~/lib/memorization'
import { getSurah } from '~/data/surahs'

const date = new Intl.DateTimeFormat('ar', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})
export function MemorizationQueue({
  rows,
  editable = false,
  onReadinessChange,
  onReadinessRefresh,
  busy = false,
  onReschedule,
  onAssess,
  onCancel,
}: {
  rows: ReadonlyArray<MemorizationRow>
  editable?: boolean
  onReadinessChange?: (assignmentId: string, ready: boolean) => Promise<void>
  onReadinessRefresh?: () => Promise<unknown>
  busy?: boolean
  onReschedule?: (row: MemorizationRow) => void
  onAssess?: (row: MemorizationRow) => void
  onCancel?: (row: MemorizationRow) => void
}) {
  if (!rows.length)
    return (
      <Card withBorder radius="lg" p="lg">
        <Text c="dimmed">لا توجد واجبات حفظ جديدة حالياً.</Text>
      </Card>
    )
  return (
    <Stack gap="md">
      {rows.map((row) => (
        <Card
          key={row._id}
          id={`memorization-${row._id}`}
          component="article"
          withBorder
          radius="lg"
          p="lg"
          style={{ scrollMarginTop: '7rem' }}
        >
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Title order={3}>{getSurah(row.surahNumber).nameAr}</Title>
              <Badge variant="light">حفظ جديد</Badge>
            </Group>
            <ReadinessBadge readyAt={row.readyAt} />
            <Text size="sm" c="dimmed">
              {row.dueAt === null
                ? 'دون موعد محدد'
                : `الاستحقاق: ${date.format(row.dueAt)}`}
            </Text>
            <Text size="sm" c="dimmed">
              أُسند في: {date.format(row.assignedAt)}
            </Text>
            {onReadinessChange && onReadinessRefresh ? (
              <AssignmentReadiness
                onSubmit={(ready) => onReadinessChange(row._id, ready)}
                onRefresh={onReadinessRefresh}
                readyAt={row.readyAt}
              />
            ) : null}
            {editable ? (
              <Group wrap="wrap">
                {onReschedule ? (
                  <Button
                    variant="light"
                    disabled={busy}
                    onClick={() => onReschedule(row)}
                  >
                    تعديل الموعد
                  </Button>
                ) : null}
                <Button
                  variant="light"
                  disabled={busy}
                  onClick={() => onAssess?.(row)}
                >
                  تقييم الحفظ
                </Button>
                <Button
                  variant="subtle"
                  color="gray"
                  disabled={busy}
                  onClick={() => onCancel?.(row)}
                >
                  إلغاء الواجب
                </Button>
              </Group>
            ) : (
              <Text size="sm">
                تدرّب على حفظ السورة ثم راجعها مع معلمك لتسجيل التقييم.
              </Text>
            )}
          </Stack>
        </Card>
      ))}
    </Stack>
  )
}
