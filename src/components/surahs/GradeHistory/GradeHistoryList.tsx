import { Badge, Card, Group, Stack, Text, Title } from '@mantine/core'
import type { GradeHistoryRow } from '~/lib/grade-history'
import { GRADE_COLORS, GRADE_LABELS } from '~/data/grades'
import { getSurah } from '~/data/surahs'

const date = new Intl.DateTimeFormat('ar', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'UTC',
})

export function GradeHistoryList({
  rows,
}: {
  rows: ReadonlyArray<GradeHistoryRow>
}) {
  if (!rows.length)
    return (
      <Card withBorder radius="lg" p="xl">
        <Text c="dimmed">لا توجد تغييرات مسجّلة لهذا الاختيار بعد.</Text>
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
                variant="light"
                color={row.newGrade === null ? 'gray' : 'teal'}
              >
                {row.newGrade === null
                  ? 'إزالة السورة'
                  : row.previousGrade === null
                    ? 'إضافة سورة'
                    : 'تغيير التقييم'}
              </Badge>
            </Group>
            <Group gap="xs" wrap="wrap">
              <Text size="sm">من:</Text>
              {row.previousGrade === null ? (
                <Text size="sm" c="dimmed">
                  غير مسجّلة
                </Text>
              ) : (
                <Badge color={GRADE_COLORS[row.previousGrade]}>
                  {GRADE_LABELS[row.previousGrade]}
                </Badge>
              )}
              <Text size="sm">إلى:</Text>
              {row.newGrade === null ? (
                <Text size="sm" c="dimmed">
                  غير مسجّلة
                </Text>
              ) : (
                <Badge color={GRADE_COLORS[row.newGrade]}>
                  {GRADE_LABELS[row.newGrade]}
                </Badge>
              )}
            </Group>
            <Text size="sm">
              بواسطة: {row.actorDisplayName ?? 'حساب محذوف'}
            </Text>
            <Text size="sm" c="dimmed">
              التاريخ: {date.format(row.changedAt)} (UTC)
            </Text>
            <Text size="sm" c="dimmed">
              {row.source === 'review' ? 'عند إغلاق مراجعة' : 'تحديث سجل الحفظ'}
            </Text>
          </Stack>
        </Card>
      ))}
    </Stack>
  )
}
