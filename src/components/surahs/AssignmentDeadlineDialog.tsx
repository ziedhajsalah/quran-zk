import { Alert, Button, Group, Modal, Stack, Text } from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import 'dayjs/locale/ar'
import { useState } from 'react'
import type {
  AssignmentDeadline,
  AssignmentDeadlineChange,
} from '~/lib/assignment-deadline'
import { extractActionErrorMessage } from '~/lib/action-errors'
import { getSurah } from '~/data/surahs'

// Mount with a key for the selected assignment so unsaved values never cross targets.
export function AssignmentDeadlineDialog({
  assignment,
  onClose,
  onSubmit,
}: {
  assignment: AssignmentDeadline
  onClose: () => void
  onSubmit: (change: AssignmentDeadlineChange) => Promise<unknown>
}) {
  const [date, setDate] = useState<string | null>(
    assignment.dueAt === null
      ? null
      : new Date(assignment.dueAt).toISOString().slice(0, 10),
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const dueAt = date === null ? null : Date.parse(`${date}T00:00:00.000Z`)
  async function submit() {
    if (pending || dueAt === assignment.dueAt) return
    setPending(true)
    setError(null)
    try {
      await onSubmit({ dueAt, expectedDueAt: assignment.dueAt })
      onClose()
    } catch (cause) {
      setError(
        extractActionErrorMessage(cause, 'تعذر تعديل الموعد. حاول مرة أخرى.'),
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <Modal
      opened
      onClose={() => {
        if (!pending) onClose()
      }}
      title="تعديل موعد الواجب"
      centered
      withCloseButton={!pending}
      closeOnEscape={!pending}
      closeOnClickOutside={!pending}
      closeButtonProps={{ 'aria-label': 'إغلاق تعديل الموعد' }}
    >
      <Stack gap="md">
        <Text fw={700}>{getSurah(assignment.surahNumber).nameAr}</Text>
        <Text size="sm">
          عدّل تاريخ الاستحقاق أو امسحه لإبقاء الواجب دون موعد محدد. التواريخ
          حسب التوقيت العالمي (UTC).
        </Text>
        {error ? (
          <Alert color="red" title="تعذر تعديل الموعد">
            {error}
          </Alert>
        ) : null}
        <DatePickerInput
          locale="ar"
          valueFormat="D MMMM YYYY"
          label="تاريخ استحقاق الواجب"
          placeholder="دون موعد محدد"
          value={date}
          onChange={setDate}
          clearable
          disabled={pending}
          dropdownType="modal"
          modalProps={{ title: 'اختيار تاريخ الاستحقاق', centered: true }}
          clearButtonProps={{
            'aria-label': 'مسح موعد الواجب',
            'aria-hidden': false,
            tabIndex: 0,
          }}
          ariaLabels={{
            nextMonth: 'الشهر التالي',
            previousMonth: 'الشهر السابق',
          }}
        />
        <Group justify="space-between">
          <Button variant="subtle" disabled={pending} onClick={onClose}>
            رجوع
          </Button>
          <Button
            loading={pending}
            disabled={dueAt === assignment.dueAt}
            onClick={() => void submit()}
          >
            حفظ الموعد
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
