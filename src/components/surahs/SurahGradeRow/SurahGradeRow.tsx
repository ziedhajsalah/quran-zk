import { Badge, Group, Stack, Text } from '@mantine/core'
import type { Surah } from '~/data/surahs'
import type { SurahGrade } from '~/data/grades'
import { GRADE_COLORS, GRADE_LABELS } from '~/data/grades'

export interface SurahGradeRowProps {
  surah: Surah
  grade: SurahGrade
  updatedAt: number
}

export function SurahGradeRow({ surah, grade, updatedAt }: SurahGradeRowProps) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Text fw={700}>{surah.nameAr}</Text>
        <Text c="dimmed" size="sm">
          {`سورة رقم ${surah.number} • ${formatRelative(updatedAt)}`}
        </Text>
      </Stack>
      <Badge color={GRADE_COLORS[grade]} radius="xl" variant="light">
        {GRADE_LABELS[grade]}
      </Badge>
    </Group>
  )
}

function formatRelative(timestamp: number) {
  const formatter = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' })
  const diffMs = timestamp - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (Math.abs(diffDays) >= 1) {
    return `آخر تقييم ${formatter.format(diffDays, 'day')}`
  }
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  if (Math.abs(diffHours) >= 1) {
    return `آخر تقييم ${formatter.format(diffHours, 'hour')}`
  }
  return 'آخر تقييم الآن'
}
