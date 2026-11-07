import { Alert, Button, Drawer, Select, Stack, Text } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { useState } from 'react'
import 'dayjs/locale/ar'
import type { MemorizationInput } from '~/lib/memorization'
import { SURAHS } from '~/data/surahs'
import { extractActionErrorMessage } from '~/lib/action-errors'

export function AssignMemorizationDrawer({
  opened,
  onClose,
  excludeSurahNumbers,
  onSubmit,
}: {
  opened: boolean
  onClose: () => void
  excludeSurahNumbers: ReadonlyArray<number>
  onSubmit: (input: MemorizationInput) => Promise<unknown>
}) {
  const [surah, setSurah] = useState<string | null>(null)
  const [dueDate, setDueDate] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const eligible = SURAHS.filter(
    (item) => !excludeSurahNumbers.includes(item.number),
  )
  const available =
    surah !== null && eligible.some((item) => item.number === Number(surah))
  function resetAndClose() {
    setSurah(null)
    setDueDate(null)
    setError(null)
    onClose()
  }
  async function submit() {
    if (pending || !available) return
    setPending(true)
    setError(null)
    try {
      await onSubmit({
        surahNumber: Number(surah),
        dueAt:
          dueDate === null ? undefined : Date.parse(`${dueDate}T00:00:00.000Z`),
      })
      resetAndClose()
    } catch (cause) {
      setError(
        extractActionErrorMessage(
          cause,
          'تعذر إسناد واجب الحفظ. حاول مرة أخرى.',
        ),
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <Drawer
      opened={opened}
      onClose={() => {
        if (!pending) resetAndClose()
      }}
      position="bottom"
      size="70%"
      title="إسناد حفظ جديد"
      padding="lg"
      withCloseButton={!pending}
      closeOnEscape={!pending}
      closeOnClickOutside={!pending}
      closeButtonProps={{ 'aria-label': 'إغلاق محدد الحفظ' }}
    >
      <Stack gap="md">
        <Text size="sm" c="gray.7">
          اختر سورة كاملة لم يُسجّل لها تقييم بعد. السور المسندة للحفظ حالياً
          مستبعدة.
        </Text>
        {error ? (
          <Alert color="red" title="تعذر إسناد واجب الحفظ">
            {error}
          </Alert>
        ) : null}
        {eligible.length === 0 ? (
          <Text>لا توجد سور جديدة متاحة للإسناد.</Text>
        ) : null}
        <Select
          label="السورة الجديدة"
          placeholder="ابحث عن سورة"
          searchable
          allowDeselect={false}
          value={surah}
          onChange={setSurah}
          disabled={pending}
          nothingFoundMessage="لا توجد سورة مطابقة"
          data={eligible.map((item) => ({
            value: String(item.number),
            label: item.nameAr,
          }))}
        />
        <DatePickerInput
          locale="ar"
          valueFormat="D MMMM YYYY"
          label="تاريخ الاستحقاق (اختياري)"
          placeholder="اختر تاريخًا"
          value={dueDate}
          onChange={setDueDate}
          minDate={new Date().toISOString().slice(0, 10)}
          clearable
          disabled={pending}
          popoverProps={{ withinPortal: false }}
          clearButtonProps={{
            'aria-label': 'مسح موعد الحفظ',
            'aria-hidden': false,
            tabIndex: 0,
          }}
          ariaLabels={{
            nextMonth: 'الشهر التالي',
            previousMonth: 'الشهر السابق',
          }}
        />
        <Text size="sm" c="gray.7">
          الموعد حسب التوقيت العالمي (UTC). اتركه فارغاً للإسناد دون موعد محدد.
        </Text>
        <Button
          loading={pending}
          disabled={!available}
          onClick={() => void submit()}
        >
          إسناد الحفظ
        </Button>
      </Stack>
    </Drawer>
  )
}
