import { ActionIcon, Badge, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconCheck, IconX } from '@tabler/icons-react'
import type { Surah } from '~/data/surahs'
import { formatArabicNumber } from '~/components/home/home-formatters'
import { formatArabicRelative } from '~/lib/arabic-time'

export interface SurahReviewRowProps {
  surah: Surah
  assignedAt: number
  dueAt: number | null
  editable?: boolean
  onClose?: () => void
  onCancel?: () => void
}

export function SurahReviewRow({
  surah,
  assignedAt,
  dueAt,
  editable = false,
  onClose,
  onCancel,
}: SurahReviewRowProps) {
  const isOverdue = dueAt !== null && dueAt < startOfTodayMs()

  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Text fw={700}>{surah.nameAr}</Text>
        <Text c="dimmed" size="sm">
          {`سورة رقم ${formatArabicNumber(surah.number)} • ${formatAssignedAt(assignedAt)}`}
        </Text>
        {dueAt !== null ? (
          <Badge
            color={isOverdue ? 'orange' : 'primary'}
            radius="xl"
            variant="light"
            mt={4}
          >
            {`${isOverdue ? 'تأخر — ' : ''}${formatDueDate(dueAt)}`}
          </Badge>
        ) : null}
      </Stack>

      {editable ? (
        <Group gap="xs" wrap="nowrap">
          <Tooltip label="إغلاق">
            <ActionIcon
              variant="light"
              color="teal"
              size="lg"
              radius="xl"
              onClick={onClose}
              aria-label="إغلاق"
            >
              <IconCheck size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="إلغاء">
            <ActionIcon
              variant="light"
              color="gray"
              size="lg"
              radius="xl"
              onClick={onCancel}
              aria-label="إلغاء"
            >
              <IconX size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ) : null}
    </Group>
  )
}

function startOfTodayMs() {
  const now = new Date()
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
}

const dateFormatter = new Intl.DateTimeFormat('ar', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatDueDate(ms: number) {
  return `الاستحقاق: ${dateFormatter.format(new Date(ms))}`
}

function formatAssignedAt(timestamp: number) {
  const relative = formatArabicRelative(timestamp, 'الآن')
  return relative === 'الآن' ? 'أُسند الآن' : `أُسند ${relative}`
}
