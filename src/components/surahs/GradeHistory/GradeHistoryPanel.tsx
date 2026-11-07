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
import { GradeHistoryList } from './GradeHistoryList'
import { gradeHistoryQuery } from '~/lib/queries'
import { SURAHS } from '~/data/surahs'
import { formatArabicNumber } from '~/components/home/home-formatters'

export function GradeHistoryPanel({ studentId }: { studentId: string }) {
  const start = useRef<HTMLDivElement>(null)
  const [surah, setSurah] = useState<string | null>(null)
  const [cursors, setCursors] = useState<Array<number | null>>([null])
  const query = useQuery(
    gradeHistoryQuery(
      studentId,
      surah === null ? undefined : Number(surah),
      cursors[cursors.length - 1],
    ),
  )
  return (
    <Stack ref={start} gap="md" style={{ scrollMarginTop: '7rem' }}>
      <Title order={2}>سجل التقدّم</Title>
      <Text size="sm" c="dimmed">
        تغييرات تقييم الحفظ منذ بدء تسجيل السجل. لا يشمل تغييرات سابقة. التواريخ
        حسب التوقيت العالمي (UTC).
      </Text>
      <Select
        label="تصفية حسب السورة"
        placeholder="كل السور"
        searchable
        clearable
        clearButtonProps={{
          'aria-label': 'عرض كل السور',
          'aria-hidden': false,
          tabIndex: 0,
        }}
        value={surah}
        data={SURAHS.map((item) => ({
          value: String(item.number),
          label: item.nameAr,
        }))}
        onChange={(value) => {
          setSurah(value)
          setCursors([null])
        }}
      />
      {query.isPending ? (
        <Group role="status">
          <Loader size="sm" />
          <Text>جارٍ تحميل سجل التقدّم…</Text>
        </Group>
      ) : query.isError ? (
        <Alert color="red" title="تعذر تحميل سجل التقدّم">
          <Stack gap="sm">
            <Text>حاول مرة أخرى لتحميل تغييرات التقييم.</Text>
            <Button variant="light" onClick={() => void query.refetch()}>
              إعادة المحاولة
            </Button>
          </Stack>
        </Alert>
      ) : (
        <GradeHistoryList rows={query.data.rows} />
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
        <Text size="sm" c="dimmed" aria-live="polite">
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
