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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { WorkQueueList } from './WorkQueueList'
import { WorkQueueActionDialog } from './WorkQueueActionDialog'
import type { WorkAction, WorkActionInput } from './WorkQueueActionDialog'
import type { WorkCursor, WorkFilters, WorkRow } from '~/lib/work-queue'
import { useCursorPages } from '~/lib/use-cursor-pages'
import {
  workDeadlineOptions,
  workFilterSchema,
  workKindOptions,
} from '~/lib/work-queue'
import * as reviews from '~/server/functions/reviews'
import * as memorization from '~/server/functions/memorization'
import { useAppMutation, workQueueQuery } from '~/lib/queries'
import { formatArabicNumber } from '~/components/home/home-formatters'

export function WorkQueue({
  filters,
  onFilter,
}: {
  filters: WorkFilters
  onFilter: (filters: WorkFilters) => Promise<void>
}) {
  const hydrated = useHydrated()
  const client = useQueryClient()
  const [selected, setSelected] = useState<{
    row: WorkRow
    action: WorkAction
  } | null>(null)
  const [acting, setActing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const closeReview = useAppMutation(reviews.close, ['reviews', 'grades'])
  const assessMemorization = useAppMutation(memorization.assess, [
    'memorization',
    'grades',
    'reviews',
  ])
  const cancelReview = useAppMutation(reviews.cancel, ['reviews'])
  const cancelMemorization = useAppMutation(memorization.cancel, [
    'memorization',
  ])
  const rescheduleReview = useAppMutation(reviews.reschedule, ['reviews'])
  const rescheduleMemorization = useAppMutation(memorization.reschedule, [
    'memorization',
  ])
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
  const busy =
    !hydrated || filtering || acting || selected !== null || query.isFetching
  async function act(input: WorkActionInput) {
    if (!selected || acting) return
    const { row } = selected
    const index =
      query.data?.rows.findIndex(
        (item) => item.kind === row.kind && item.id === row.id,
      ) ?? -1
    setActing(true)
    try {
      const assignmentId = row.id
      if (input.action === 'assess') {
        if (row.kind === 'review')
          await closeReview({
            assignmentId,
            newGrade: input.grade,
            nextReviewDueAt: input.nextReviewDueAt,
          })
        else {
          if (!input.grade) throw new Error('اختر تقييماً للحفظ قبل الحفظ.')
          await assessMemorization({
            assignmentId,
            grade: input.grade,
            nextReviewDueAt: input.nextReviewDueAt,
          })
        }
      } else if (input.action === 'cancel') {
        await (row.kind === 'review' ? cancelReview : cancelMemorization)({
          assignmentId,
        })
      } else {
        await (
          row.kind === 'review' ? rescheduleReview : rescheduleMemorization
        )({ assignmentId, ...input.change })
      }
      setNotice(
        input.action === 'cancel'
          ? 'تم إلغاء الواجب.'
          : input.action === 'reschedule'
            ? 'تم تعديل الموعد. قد ينتقل الواجب بحسب الفلاتر والترتيب.'
            : input.nextReviewDueAt !== undefined
              ? 'تم حفظ التقييم وإسناد المراجعة التالية.'
              : 'تم حفظ التقييم وإتمام الواجب.',
      )
      const key = workQueueQuery(filters, pages.cursor).queryKey
      const refreshed = client.getQueryData(key)
      const state = client.getQueryState(key)
      const next =
        index >= 0 && state?.status === 'success' && !state.isInvalidated
          ? refreshed?.rows.filter(
              (item) => item.kind !== row.kind || item.id !== row.id,
            )[index]
          : undefined
      setSelected(
        input.action === 'assess' && input.next && next
          ? { row: next, action: 'assess' }
          : null,
      )
    } finally {
      setActing(false)
    }
  }
  return (
    <Stack gap="lg" ref={pages.start} style={{ scrollMarginTop: '7rem' }}>
      <Text c="dimmed">
        واجبات الطلاب النشطين المفتوحة، من أقدم موعد إلى الأحدث، ثم دون موعد.
        التواريخ حسب التوقيت العالمي (UTC).
      </Text>
      <Button
        variant="subtle"
        disabled={busy}
        onClick={() =>
          void client.invalidateQueries({ queryKey: ['work-queue', filters] })
        }
        style={{ alignSelf: 'flex-start' }}
      >
        تحديث القائمة
      </Button>
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
            disabled={filtering || selected !== null || acting}
            onChange={(event) => setSearch(event.currentTarget.value)}
            style={{ flex: '1 1 14rem' }}
          />
          <Button
            type="submit"
            loading={filtering}
            disabled={selected !== null || acting}
          >
            بحث
          </Button>
        </Group>
      </form>
      <Group grow align="flex-start">
        <Select
          label="نوع الواجب"
          value={filters.kind}
          allowDeselect={false}
          disabled={busy}
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
          disabled={busy}
          data={workDeadlineOptions}
          onChange={(value) => {
            const parsed = workFilterSchema.shape.deadline.safeParse(value)
            if (parsed.success)
              void changeFilters({ ...filters, deadline: parsed.data })
          }}
        />
      </Group>
      {notice ? (
        <Alert color="teal" role="status">
          {notice}
        </Alert>
      ) : null}
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
        <WorkQueueList
          rows={query.data.rows}
          busy={busy}
          emptyMessage={
            pages.hasPrevious
              ? 'لا توجد واجبات في هذه الصفحة. استخدم السابق للاطلاع على الصفحة السابقة.'
              : undefined
          }
          onAction={(row, action) => {
            setNotice(null)
            setSelected({ row, action })
          }}
        />
      )}
      <Group justify="space-between">
        <Button
          variant="light"
          disabled={busy || !pages.hasPrevious}
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
            busy || !query.data?.nextCursor || query.isFetching || query.isError
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
      {selected ? (
        <WorkQueueActionDialog
          key={`${selected.row.kind}-${selected.row.id}-${selected.action}`}
          row={selected.row}
          action={selected.action}
          hasNext={
            (query.data?.rows.findIndex(
              (row) =>
                row.kind === selected.row.kind && row.id === selected.row.id,
            ) ?? -1) <
              (query.data?.rows.length ?? 0) - 1 ||
            Boolean(query.data?.nextCursor)
          }
          onClose={() => setSelected(null)}
          onSubmit={act}
        />
      ) : null}
    </Stack>
  )
}
