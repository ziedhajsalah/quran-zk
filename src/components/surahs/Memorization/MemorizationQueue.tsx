import { Badge, Button, Card, Group, Stack, Text, Title } from '@mantine/core'
import type { MemorizationRow } from '~/lib/memorization'
import { getSurah } from '~/data/surahs'

const date = new Intl.DateTimeFormat('ar', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})
export function MemorizationQueue({
  rows,
  editable = false,
  busy = false,
  onAssess,
  onCancel,
}: {
  rows: ReadonlyArray<MemorizationRow>
  editable?: boolean
  busy?: boolean
  onAssess?: (row: MemorizationRow) => void
  onCancel?: (row: MemorizationRow) => void
}) {
  if (!rows.length)
    return (
      <Card withBorder radius="lg" p="lg">
        <Text c="gray.7">لا توجد واجبات حفظ جديدة حالياً.</Text>
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
            <Text size="sm" c="gray.7">
              {row.dueAt === null
                ? 'دون موعد محدد'
                : `الاستحقاق: ${date.format(row.dueAt)}`}
            </Text>
            <Text size="sm" c="gray.7">
              أُسند في: {date.format(row.assignedAt)}
            </Text>
            {editable ? (
              <Group wrap="wrap">
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
