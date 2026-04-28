import { Card, Stack, Text } from '@mantine/core'
import { SurahGradeRow } from '../SurahGradeRow'
import type { SurahGrade } from '~/data/grades'
import { getSurah } from '~/data/surahs'

export interface SurahGradeListItem {
  surahNumber: number
  grade: SurahGrade
  updatedAt: number
}

export interface SurahGradeListProps {
  rows: ReadonlyArray<SurahGradeListItem>
  emptyMessage: string
}

export function SurahGradeList({ rows, emptyMessage }: SurahGradeListProps) {
  if (rows.length === 0) {
    return (
      <Card withBorder radius="lg" p="xl">
        <Text c="dimmed" ta="center">
          {emptyMessage}
        </Text>
      </Card>
    )
  }

  const sorted = [...rows].sort((a, b) => a.surahNumber - b.surahNumber)

  return (
    <Stack gap="md">
      {sorted.map((row) => (
        <Card key={row.surahNumber} withBorder radius="lg" p="md">
          <SurahGradeRow
            surah={getSurah(row.surahNumber)}
            grade={row.grade}
            updatedAt={row.updatedAt}
          />
        </Card>
      ))}
    </Stack>
  )
}
