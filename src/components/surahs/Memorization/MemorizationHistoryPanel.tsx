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
import { useState } from 'react'
import { MemorizationHistoryList } from './MemorizationHistoryList'
import type {
  MemorizationHistoryCursor,
  MemorizationHistoryStatus,
} from '~/lib/memorization'
import { useCursorPages } from '~/lib/use-cursor-pages'
import { memorizationHistoryQuery } from '~/lib/queries'
import { formatArabicNumber } from '~/components/home/home-formatters'

export function MemorizationHistoryPanel({ studentId }: { studentId: string }) {
  const pages = useCursorPages<MemorizationHistoryCursor>()
  const [status, setStatus] = useState<MemorizationHistoryStatus>('all')
  const query = useQuery(
    memorizationHistoryQuery(studentId, status, pages.cursor),
  )
  return (
    <Stack ref={pages.start} gap="md" style={{ scrollMarginTop: '7rem' }}>
      <Title order={2}>سجل الحفظ الجديد</Title>
      <Text size="sm" c="dimmed">
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
            pages.reset()
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
          disabled={!pages.hasPrevious || query.isFetching}
          onClick={() => {
            pages.previous()
          }}
        >
          الأحدث
        </Button>
        <Text size="sm" c="dimmed" aria-live="polite">
          الصفحة {formatArabicNumber(pages.page)}
        </Text>
        <Button
          variant="light"
          disabled={
            !query.data?.nextCursor || query.isFetching || query.isError
          }
          onClick={() => {
            const next = query.data?.nextCursor
            if (next) {
              pages.next(next)
            }
          }}
        >
          الأقدم
        </Button>
      </Group>
    </Stack>
  )
}
