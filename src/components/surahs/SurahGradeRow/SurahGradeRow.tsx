import { Badge, Chip, Group, Stack, Text } from '@mantine/core'
import type { SurahGrade } from '~/data/grades'
import type { Surah } from '~/data/surahs'
import { GRADE_COLORS, GRADE_LABELS, GRADE_ORDER } from '~/data/grades'
import { formatArabicNumber } from '~/components/home/home-formatters'
import { formatArabicRelative } from '~/lib/arabic-time'

export interface SurahGradeRowProps {
  surah: Surah
  grade: SurahGrade
  updatedAt: number
  editable?: boolean
  onChange?: (grade: SurahGrade) => void
}

export function SurahGradeRow({
  surah,
  grade,
  updatedAt,
  editable = false,
  onChange,
}: SurahGradeRowProps) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text fw={700}>{surah.nameAr}</Text>
          <Text c="dimmed" size="sm">
            {`سورة رقم ${formatArabicNumber(surah.number)} • ${formatRelative(updatedAt)}`}
          </Text>
        </Stack>
        {!editable ? (
          <Badge color={GRADE_COLORS[grade]} radius="xl" variant="light">
            {GRADE_LABELS[grade]}
          </Badge>
        ) : null}
      </Group>

      {editable ? (
        <Chip.Group
          multiple={false}
          value={grade}
          onChange={(value) => {
            if (!value) return
            if (
              value === 'good' ||
              value === 'medium' ||
              value === 'forgotten'
            ) {
              onChange?.(value)
            }
          }}
        >
          <Group gap="xs">
            {GRADE_ORDER.map((g) => (
              <Chip key={g} value={g} color={GRADE_COLORS[g]} variant="light">
                {GRADE_LABELS[g]}
              </Chip>
            ))}
          </Group>
        </Chip.Group>
      ) : null}
    </Stack>
  )
}

function formatRelative(timestamp: number) {
  const relative = formatArabicRelative(timestamp, 'الآن')
  return relative === 'الآن' ? 'آخر تقييم الآن' : `آخر تقييم ${relative}`
}
