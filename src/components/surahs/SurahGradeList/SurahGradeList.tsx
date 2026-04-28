import { Button, Card, Group, Stack, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
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
  editable?: boolean
  onChangeGrade?: (surahNumber: number, grade: SurahGrade) => void
  onAddSurah?: () => void
}

export function SurahGradeList({
  rows,
  emptyMessage,
  editable = false,
  onChangeGrade,
  onAddSurah,
}: SurahGradeListProps) {
  const sorted = [...rows].sort((a, b) => a.surahNumber - b.surahNumber)
  const showAdd = editable && onAddSurah

  return (
    <Stack gap="md">
      {showAdd ? (
        <Group justify="flex-end">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={onAddSurah}
            variant="light"
          >
            إضافة سورة
          </Button>
        </Group>
      ) : null}

      {sorted.length === 0 ? (
        <Card withBorder radius="lg" p="xl">
          <Text c="dimmed" ta="center">
            {emptyMessage}
          </Text>
        </Card>
      ) : (
        sorted.map((row) => (
          <Card key={row.surahNumber} withBorder radius="lg" p="md">
            <SurahGradeRow
              surah={getSurah(row.surahNumber)}
              grade={row.grade}
              updatedAt={row.updatedAt}
              editable={editable}
              onChange={(grade) => onChangeGrade?.(row.surahNumber, grade)}
            />
          </Card>
        ))
      )}
    </Stack>
  )
}
