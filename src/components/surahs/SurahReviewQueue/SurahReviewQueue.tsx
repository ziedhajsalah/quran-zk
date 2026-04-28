import { Card, Stack, Text } from '@mantine/core'
import { SurahReviewRow } from '../SurahReviewRow'
import { getSurah } from '~/data/surahs'

export interface SurahReviewQueueItem {
  assignmentId: string
  surahNumber: number
  assignedAt: number
  dueAt: number | null
}

export interface SurahReviewQueueProps {
  rows: ReadonlyArray<SurahReviewQueueItem>
  editable?: boolean
  onClose?: (assignmentId: string) => void
  onCancel?: (assignmentId: string) => void
}

export function SurahReviewQueue({
  rows,
  editable = false,
  onClose,
  onCancel,
}: SurahReviewQueueProps) {
  if (rows.length === 0) {
    return null
  }

  return (
    <Stack gap="sm">
      <Text c="primary.7" fw={700} size="sm">
        للمراجعة
      </Text>
      {rows.map((row) => (
        <Card key={row.assignmentId} withBorder radius="lg" p="md">
          <SurahReviewRow
            surah={getSurah(row.surahNumber)}
            assignedAt={row.assignedAt}
            dueAt={row.dueAt}
            editable={editable}
            onClose={() => onClose?.(row.assignmentId)}
            onCancel={() => onCancel?.(row.assignmentId)}
          />
        </Card>
      ))}
    </Stack>
  )
}
