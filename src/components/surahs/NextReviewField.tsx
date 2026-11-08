import { Checkbox, Stack, Text } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import 'dayjs/locale/ar'

export function NextReviewField({
  value,
  onChange,
  disabled,
}: {
  value: string | null
  onChange: (value: string | null) => void
  disabled: boolean
}) {
  return (
    <Stack gap="sm">
      <Checkbox
        label="إسناد المراجعة التالية"
        checked={value !== null}
        onChange={(event) => onChange(event.currentTarget.checked ? '' : null)}
        disabled={disabled}
      />
      {value !== null ? (
        <>
          <DatePickerInput
            label="موعد المراجعة التالية"
            placeholder="اختر تاريخاً"
            locale="ar"
            valueFormat="D MMMM YYYY"
            value={value || null}
            onChange={(date) => onChange(date ?? '')}
            minDate={new Date().toISOString().slice(0, 10)}
            disabled={disabled}
            required
            clearable
            dropdownType="modal"
            modalProps={{
              title: 'اختيار موعد المراجعة التالية',
              centered: true,
            }}
            ariaLabels={{
              nextMonth: 'الشهر التالي',
              previousMonth: 'الشهر السابق',
            }}
            clearButtonProps={{
              'aria-label': 'مسح موعد المراجعة التالية',
              'aria-hidden': false,
              tabIndex: 0,
            }}
          />
          <Text size="sm" c="dimmed">
            اختر اليوم أو تاريخاً لاحقاً حسب توقيت UTC. يُحفظ التقييم والمراجعة
            التالية معاً.
          </Text>
        </>
      ) : null}
    </Stack>
  )
}
