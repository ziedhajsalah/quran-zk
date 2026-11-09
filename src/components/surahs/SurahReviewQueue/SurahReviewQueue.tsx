import { Card, Stack, Text } from '@mantine/core'
import { SurahReviewRow } from '../SurahReviewRow'
import { AssignmentReadiness, ReadinessBadge } from '../AssignmentReadiness'
import { getSurah } from '~/data/surahs'

export interface SurahReviewQueueItem {
  assignmentId: string
  surahNumber: number
  assignedAt: number
  dueAt: number | null
  readyAt?: number | null
}

export interface SurahReviewQueueProps {
  rows: ReadonlyArray<SurahReviewQueueItem>
  editable?: boolean
  onReadinessChange?: (assignmentId: string, ready: boolean) => Promise<void>
  onReadinessRefresh?: () => Promise<unknown>
  onReschedule?: (assignmentId: string) => void
  onClose?: (assignmentId: string) => void
  onCancel?: (assignmentId: string) => void
}

export function SurahReviewQueue({
  rows,
  editable = false,
  onReadinessChange,
  onReadinessRefresh,
  onReschedule,
  onClose,
  onCancel,
}: SurahReviewQueueProps) {
  if (rows.length === 0) {
    return null
  }

  return (
    <Stack gap="sm">
      <Text c="var(--app-accent-text)" fw={700} size="sm">
        للمراجعة
      </Text>
      {rows.map((row) => (
        <Card
          id={`review-${row.assignmentId}`}
          key={row.assignmentId}
          withBorder
          radius="lg"
          p="md"
        >
          <Stack gap="sm">
            <ReadinessBadge readyAt={row.readyAt} />
            <SurahReviewRow
              surah={getSurah(row.surahNumber)}
              assignedAt={row.assignedAt}
              dueAt={row.dueAt}
              editable={editable}
              onReschedule={
                onReschedule
                  ? () => onReschedule(row.assignmentId)
                  : undefined
              }
              onClose={() => onClose?.(row.assignmentId)}
              onCancel={() => onCancel?.(row.assignmentId)}
            />
            {onReadinessChange && onReadinessRefresh ? (
              <AssignmentReadiness
                onSubmit={(ready) =>
                  onReadinessChange(row.assignmentId, ready)
                }
                onRefresh={onReadinessRefresh}
                readyAt={row.readyAt}
              />
            ) : null}
          </Stack>
        </Card>
      ))}
    </Stack>
  )
}
