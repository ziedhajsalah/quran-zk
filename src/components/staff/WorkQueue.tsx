import {
  Alert,
  Button,
  Group,
  Loader,
  Select,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { WorkQueueList } from './WorkQueueList'
import type { WorkCursor, WorkFilters } from '~/lib/work-queue'
import { workQueueQuery } from '~/lib/queries'
import { formatArabicNumber } from '~/components/home/home-formatters'

export function WorkQueue({
  filters,
  onFilter,
}: {
  filters: WorkFilters
  onFilter: (filters: WorkFilters) => Promise<void>
}) {
  const [search, setSearch] = useState(filters.q)
  const [filtering, setFiltering] = useState(false)
  const [filterError, setFilterError] = useState(false)
  async function changeFilters(next: WorkFilters) {
    if (filtering) return
    setFiltering(true)
    setFilterError(false)
    try {
      await onFilter(next)
    } catch {
      setFilterError(true)
    } finally {
      setFiltering(false)
    }
  }
  const [cursors, setCursors] = useState<Array<WorkCursor | null>>([null])
  const start = useRef<HTMLDivElement>(null)
  const query = useQuery(workQueueQuery(filters, cursors[cursors.length - 1]))
  return (
    <Stack gap="lg" ref={start} style={{ scrollMarginTop: '7rem' }}>
      <Text c="dimmed">
        واجبات الطلاب النشطين المفتوحة، من أقدم موعد إلى الأحدث، ثم دون موعد.
        التواريخ حسب التوقيت العالمي (UTC).
      </Text>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void changeFilters({ ...filters, q: search.trim() })
        }}
      >
        <Group align="flex-end">
          <TextInput
            label="البحث عن طالب"
            placeholder="الاسم أو اسم المستخدم"
            value={search}
            maxLength={100}
            disabled={filtering}
            onChange={(event) => setSearch(event.currentTarget.value)}
            style={{ flex: '1 1 14rem' }}
          />
          <Button type="submit" loading={filtering}>
            بحث
          </Button>
        </Group>
      </form>
      <Group grow align="flex-start">
        <Select
          label="نوع الواجب"
          value={filters.kind}
          allowDeselect={false}
          disabled={filtering}
          data={[
            { value: 'all', label: 'كل الواجبات' },
            { value: 'review', label: 'مراجعة' },
            { value: 'memorization', label: 'حفظ جديد' },
          ]}
          onChange={(value) => {
            if (
              value === 'all' ||
              value === 'review' ||
              value === 'memorization'
            )
              void changeFilters({ ...filters, kind: value })
          }}
        />
        <Select
          label="موعد الاستحقاق"
          value={filters.deadline}
          allowDeselect={false}
          disabled={filtering}
          data={[
            { value: 'all', label: 'كل المواعيد' },
            { value: 'overdue', label: 'متأخرة' },
            { value: 'today', label: 'اليوم' },
            { value: 'upcoming', label: 'قادمة' },
            { value: 'undated', label: 'دون موعد' },
          ]}
          onChange={(value) => {
            if (
              value === 'all' ||
              value === 'overdue' ||
              value === 'today' ||
              value === 'upcoming' ||
              value === 'undated'
            )
              void changeFilters({ ...filters, deadline: value })
          }}
        />
      </Group>
      {filterError ? (
        <Alert color="red">تعذر تحديث البحث. حاول مرة أخرى.</Alert>
      ) : null}
      {query.isPending ? (
        <Group role="status">
          <Loader size="sm" />
          <Text>جارٍ تحميل الواجبات…</Text>
        </Group>
      ) : query.isError ? (
        <Alert color="red" title="تعذر تحميل الواجبات">
          <Stack>
            <Text>حاول مرة أخرى لتحميل قائمة الواجبات.</Text>
            <Button onClick={() => void query.refetch()}>إعادة المحاولة</Button>
          </Stack>
        </Alert>
      ) : (
        <WorkQueueList rows={query.data.rows} />
      )}
      <Group justify="space-between">
        <Button
          variant="light"
          disabled={filtering || cursors.length === 1 || query.isFetching}
          onClick={() => {
            setCursors((previous) => previous.slice(0, -1))
            start.current?.scrollIntoView({ block: 'start' })
          }}
        >
          السابق
        </Button>
        <Text aria-live="polite" size="sm">
          الصفحة {formatArabicNumber(cursors.length)}
        </Text>
        <Button
          variant="light"
          disabled={
            filtering ||
            !query.data?.nextCursor ||
            query.isFetching ||
            query.isError
          }
          onClick={() => {
            if (query.data?.nextCursor) {
              setCursors((previous) => [...previous, query.data.nextCursor])
              start.current?.scrollIntoView({ block: 'start' })
            }
          }}
        >
          التالي
        </Button>
      </Group>
    </Stack>
  )
}
