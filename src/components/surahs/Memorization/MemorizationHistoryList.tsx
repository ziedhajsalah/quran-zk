import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core'
import type { MemorizationHistoryRow } from '~/lib/memorization'
import { GRADE_COLORS, GRADE_LABELS } from '~/data/grades'
import { getSurah } from '~/data/surahs'

const date = new Intl.DateTimeFormat('ar', {
  dateStyle: 'medium',
  timeZone: 'UTC',
})

export function MemorizationHistoryList({
  rows,
}: {
  rows: ReadonlyArray<MemorizationHistoryRow>
}) {
  if (!rows.length)
    return (
      <Card withBorder radius="lg" p="xl">
        <Text c="gray.7">
          لا توجد واجبات حفظ مكتملة أو ملغاة لهذا الاختيار.
        </Text>
      </Card>
    )
  return (
    <Stack gap="md">
      {rows.map((row) => (
        <Card key={row.id} component="article" withBorder radius="lg" p="lg">
          <Stack gap="sm">
            <Group justify="space-between" align="flex-start">
              <Title order={3}>{getSurah(row.surahNumber).nameAr}</Title>
              <Badge
                color={row.status === 'closed' ? 'teal' : 'gray'}
                variant="light"
              >
                {row.status === 'closed' ? 'مكتملة' : 'ملغاة'}
              </Badge>
            </Group>
            <Text size="sm" c="gray.7">
              {`${row.status === 'closed' ? 'أُنجزت في' : 'أُلغيت في'}: ${date.format(row.closedAt)}`}
            </Text>
            <Text size="sm" c="gray.7">
              تاريخ الإسناد: {date.format(row.assignedAt)}
            </Text>
            {row.dueAt === null ? (
              <Text size="sm" c="gray.7">
                دون موعد محدد
              </Text>
            ) : (
              <Text size="sm" c="gray.7">
                الاستحقاق: {date.format(row.dueAt)}
              </Text>
            )}
            {row.status === 'closed' ? (
              <Group gap="sm">
                <Text size="sm">التقييم عند الإنجاز:</Text>
                {row.closingGrade === null ? (
                  <Text size="sm" c="gray.7">
                    التقييم غير مسجّل
                  </Text>
                ) : (
                  <Badge color={GRADE_COLORS[row.closingGrade]}>
                    {GRADE_LABELS[row.closingGrade]}
                  </Badge>
                )}
              </Group>
            ) : null}
          </Stack>
        </Card>
      ))}
    </Stack>
  )
}
