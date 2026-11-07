import {
  Alert,
  Button,
  Card,
  Checkbox,
  Drawer,
  Group,
  Stack,
  Text,
  TextInput,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconSearch } from '@tabler/icons-react'
import { useEffect, useMemo, useState } from 'react'
import 'dayjs/locale/ar'
import type {
  BatchReviewInput,
  BatchReviewResult,
} from '~/lib/review-assignment'
import { formatArabicNumber } from '~/components/home/home-formatters'
import { SURAHS } from '~/data/surahs'
import { extractActionErrorMessage } from '~/lib/action-errors'

export interface AssignReviewDrawerProps {
  opened: boolean
  onClose: () => void
  memorizedSurahNumbers: ReadonlyArray<number>
  excludeSurahNumbers: ReadonlyArray<number>
  onSubmit: (input: BatchReviewInput) => Promise<BatchReviewResult>
}

export function AssignReviewDrawer({
  opened,
  onClose,
  memorizedSurahNumbers,
  excludeSurahNumbers,
  onSubmit,
}: AssignReviewDrawerProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Array<number>>([])
  const [confirming, setConfirming] = useState(false)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eligible = useMemo(() => {
    const recorded = new Set(memorizedSurahNumbers)
    const excluded = new Set(excludeSurahNumbers)
    return SURAHS.filter(
      (surah) => recorded.has(surah.number) && !excluded.has(surah.number),
    )
  }, [memorizedSurahNumbers, excludeSurahNumbers])
  useEffect(() => {
    const available = new Set(eligible.map((surah) => surah.number))
    setSelected((current) => {
      const next = current.filter((number) => available.has(number))
      return next.length === current.length ? current : next
    })
  }, [eligible])
  const candidates = eligible.filter((surah) => {
    const term = search.trim().toLowerCase()
    return (
      !term ||
      surah.nameAr.includes(term) ||
      surah.nameEn.toLowerCase().includes(term) ||
      String(surah.number) === term
    )
  })
  const selectedSurahs = eligible.filter((surah) =>
    selected.includes(surah.number),
  )

  function resetAndClose() {
    setSearch('')
    setSelected([])
    setConfirming(false)
    setDueDate(null)
    setError(null)
    onClose()
  }
  function handleClose() {
    if (!submitting) resetAndClose()
  }
  async function handleSubmit() {
    if (submitting || selectedSurahs.length === 0) return
    setSubmitting(true)
    setError(null)
    try {
      const dueAt =
        dueDate === null ? undefined : Date.parse(`${dueDate}T00:00:00.000Z`)
      await onSubmit({
        surahNumbers: selectedSurahs.map((surah) => surah.number),
        dueAt,
      })
      resetAndClose()
    } catch (cause) {
      setError(
        extractActionErrorMessage(
          cause,
          'تعذر إسناد المراجعات. حاول مرة أخرى.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }
  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      position="bottom"
      size="80%"
      title="إسناد مراجعات"
      padding="lg"
      closeOnEscape={!submitting}
      closeOnClickOutside={!submitting}
      withCloseButton={!submitting}
      closeButtonProps={{ 'aria-label': 'إغلاق محدد المراجعات' }}
    >
      <Stack gap="md">
        <Text size="sm" c="gray.7">
          اختر سوراً مسجّلة للطالب. السور ذات المراجعات المفتوحة مستبعدة من
          القائمة.
        </Text>
        {error ? (
          <Alert color="red" title="تعذر إسناد المراجعات">
            {error}
          </Alert>
        ) : null}
        {!confirming ? (
          <>
            <TextInput
              label="البحث في السور"
              placeholder="ابحث بالاسم أو الرقم"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
            />
            <Group justify="space-between">
              <Button
                variant="subtle"
                disabled={candidates.length === 0}
                onClick={() =>
                  setSelected((current) => [
                    ...new Set([
                      ...current,
                      ...candidates.map((surah) => surah.number),
                    ]),
                  ])
                }
              >
                تحديد النتائج المعروضة
              </Button>
              <Button
                variant="subtle"
                disabled={selected.length === 0}
                onClick={() => setSelected([])}
              >
                إلغاء التحديد
              </Button>
            </Group>
            <Stack gap="xs" style={{ maxHeight: '40vh', overflowY: 'auto' }}>
              {candidates.length === 0 ? (
                <Text c="gray.7" ta="center" py="lg">
                  {eligible.length === 0
                    ? 'لا توجد سور متاحة للإسناد. أضف سورة أو أغلق مراجعتها المفتوحة أولاً.'
                    : 'لا توجد سور تطابق البحث.'}
                </Text>
              ) : (
                candidates.map((surah) => (
                  <Card key={surah.number} withBorder radius="md" p="sm">
                    <Checkbox
                      checked={selected.includes(surah.number)}
                      onChange={(event) => {
                        const checked = event.currentTarget.checked
                        setSelected((current) =>
                          checked
                            ? [...current, surah.number]
                            : current.filter(
                                (number) => number !== surah.number,
                              ),
                        )
                      }}
                      label={
                        <Stack gap={2}>
                          <Text fw={600}>{surah.nameAr}</Text>
                          <Text c="gray.7" size="sm">
                            {formatArabicNumber(surah.number)} · {surah.nameEn}
                          </Text>
                        </Stack>
                      }
                    />
                  </Card>
                ))
              )}
            </Stack>
            <Group justify="space-between">
              <Text aria-live="polite">
                السور المحددة: {formatArabicNumber(selectedSurahs.length)}
              </Text>
              <Button
                disabled={selectedSurahs.length === 0}
                onClick={() => {
                  setError(null)
                  setConfirming(true)
                }}
              >
                متابعة
              </Button>
            </Group>
          </>
        ) : (
          <>
            <Text fw={700}>
              السور المختارة ({formatArabicNumber(selectedSurahs.length)})
            </Text>
            <Stack gap="xs" style={{ maxHeight: '30vh', overflowY: 'auto' }}>
              {selectedSurahs.map((surah) => (
                <Text key={surah.number}>{surah.nameAr}</Text>
              ))}
            </Stack>
            <DatePickerInput
              locale="ar"
              valueFormat="D MMMM YYYY"
              label="تاريخ الاستحقاق (اختياري)"
              placeholder="اختر تاريخًا"
              value={dueDate}
              onChange={setDueDate}
              minDate={new Date().toISOString().slice(0, 10)}
              clearable
              clearButtonProps={{
                'aria-label': 'مسح موعد المراجعة',
                'aria-hidden': false,
                tabIndex: 0,
              }}
              popoverProps={{ withinPortal: false }}
              ariaLabels={{
                nextMonth: 'الشهر التالي',
                previousMonth: 'الشهر السابق',
              }}
              disabled={submitting}
            />
            <Text size="sm" c="gray.7">
              يُطبّق الموعد نفسه على جميع السور المختارة. دون تاريخ، تُسند
              المراجعات بلا موعد محدد.
            </Text>
            <Group justify="space-between">
              <Button
                variant="subtle"
                disabled={submitting}
                onClick={() => {
                  setError(null)
                  setConfirming(false)
                }}
              >
                تعديل الاختيار
              </Button>
              <Button
                loading={submitting}
                disabled={selectedSurahs.length === 0}
                onClick={() => void handleSubmit()}
              >
                إسناد
              </Button>
            </Group>
          </>
        )}
      </Stack>
    </Drawer>
  )
}
