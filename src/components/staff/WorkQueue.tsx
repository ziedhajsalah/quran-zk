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
import { useHydrated } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { WorkQueueList } from './WorkQueueList'
import type { WorkCursor, WorkFilters } from '~/lib/work-queue'
import { useCursorPages } from '~/lib/use-cursor-pages'
import {
  workDeadlineOptions,
  workFilterSchema,
  workKindOptions,
} from '~/lib/work-queue'
import { workQueueQuery } from '~/lib/queries'
import { formatArabicNumber } from '~/components/home/home-formatters'

export function WorkQueue({
  filters,
  onFilter,
}: {
  filters: WorkFilters
  onFilter: (filters: WorkFilters) => Promise<void>
}) {
  const hydrated = useHydrated()
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
  const pages = useCursorPages<WorkCursor>()
  const query = useQuery(workQueueQuery(filters, pages.cursor))
  return (
    <Stack gap="lg" ref={pages.start} style={{ scrollMarginTop: '7rem' }}>
      <Text c="dimmed">
        واجبات الطلاب النشطين المفتوحة، من أقدم موعد إلى الأحدث، ثم دون موعد.
        التواريخ حسب التوقيت العالمي (UTC).
      </Text>
      <form
        action="/staff/work"
        method="get"
        onSubmit={(event) => {
          event.preventDefault()
          void changeFilters({ ...filters, q: search.trim() })
        }}
      >
        <input type="hidden" name="kind" value={filters.kind} />
        <input type="hidden" name="deadline" value={filters.deadline} />
        <Group align="flex-end">
          <TextInput
            name="q"
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
          disabled={filtering || !hydrated}
          data={workKindOptions}
          onChange={(value) => {
            const parsed = workFilterSchema.shape.kind.safeParse(value)
            if (parsed.success)
              void changeFilters({ ...filters, kind: parsed.data })
          }}
        />
        <Select
          label="موعد الاستحقاق"
          value={filters.deadline}
          allowDeselect={false}
          disabled={filtering || !hydrated}
          data={workDeadlineOptions}
          onChange={(value) => {
            const parsed = workFilterSchema.shape.deadline.safeParse(value)
            if (parsed.success)
              void changeFilters({ ...filters, deadline: parsed.data })
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
          disabled={
            !hydrated || filtering || !pages.hasPrevious || query.isFetching
          }
          onClick={() => {
            pages.previous()
          }}
        >
          السابق
        </Button>
        <Text aria-live="polite" size="sm">
          الصفحة {formatArabicNumber(pages.page)}
        </Text>
        <Button
          variant="light"
          disabled={
            !hydrated ||
            filtering ||
            !query.data?.nextCursor ||
            query.isFetching ||
            query.isError
          }
          onClick={() => {
            if (query.data?.nextCursor) {
              pages.next(query.data.nextCursor)
            }
          }}
        >
          التالي
        </Button>
      </Group>
    </Stack>
  )
}
