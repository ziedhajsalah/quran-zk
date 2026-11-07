import {
  Alert,
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  Title,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { MemorizationHistoryList } from './MemorizationHistoryList'
import type {
  MemorizationHistoryCursor,
  MemorizationHistoryStatus,
} from '~/lib/memorization'
import { memorizationHistoryQuery } from '~/lib/queries'
import { formatArabicNumber } from '~/components/home/home-formatters'

export function MemorizationHistoryPanel({ studentId }: { studentId: string }) {
  const start = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<MemorizationHistoryStatus>('all')
  const [cursors, setCursors] = useState<
    Array<MemorizationHistoryCursor | null>
  >([null])
  const query = useQuery(
    memorizationHistoryQuery(studentId, status, cursors[cursors.length - 1]),
  )
  return (
    <Stack ref={start} gap="md" style={{ scrollMarginTop: '7rem' }}>
      <Title order={2}>سجل الحفظ الجديد</Title>
      <Text size="sm" c="gray.7">
        واجبات الحفظ المكتملة والملغاة، مع التقييم المسجّل عند الإنجاز. التواريخ
        حسب التوقيت العالمي (UTC).
      </Text>
      <Select
        label="حالة واجب الحفظ"
        value={status}
        allowDeselect={false}
        data={[
          { value: 'all', label: 'الكل' },
          { value: 'closed', label: 'مكتملة' },
          { value: 'cancelled', label: 'ملغاة' },
        ]}
        onChange={(value) => {
          if (value === 'all' || value === 'closed' || value === 'cancelled') {
            setStatus(value)
            setCursors([null])
          }
        }}
      />
      {query.isPending ? (
        <Group role="status">
          <Loader size="sm" />
          <Text>جارٍ تحميل السجل…</Text>
        </Group>
      ) : query.isError ? (
        <Alert color="red" title="تعذر تحميل السجل">
          <Stack gap="sm">
            <Text>حاول مرة أخرى لتحميل سجل الحفظ الجديد.</Text>
            <Button variant="light" onClick={() => void query.refetch()}>
              إعادة المحاولة
            </Button>
          </Stack>
        </Alert>
      ) : (
        <MemorizationHistoryList rows={query.data.rows} />
      )}
      <Group justify="space-between" wrap="wrap">
        <Button
          variant="light"
          disabled={cursors.length === 1 || query.isFetching}
          onClick={() => {
            setCursors((previous) => previous.slice(0, -1))
            start.current?.scrollIntoView({ block: 'start' })
          }}
        >
          الأحدث
        </Button>
        <Text size="sm" c="gray.7" aria-live="polite">
          الصفحة {formatArabicNumber(cursors.length)}
        </Text>
        <Button
          variant="light"
          disabled={
            !query.data?.nextCursor || query.isFetching || query.isError
          }
          onClick={() => {
            const next = query.data?.nextCursor
            if (next) {
              setCursors((previous) => [...previous, next])
              start.current?.scrollIntoView({ block: 'start' })
            }
          }}
        >
          الأقدم
        </Button>
      </Group>
    </Stack>
  )
}
