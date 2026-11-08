import { Alert, Button, Group, Modal, Radio, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { AssignmentDeadlineChange } from '~/lib/assignment-deadline'
import type { WorkRow } from '~/lib/work-queue'
import type { SurahGrade } from '~/data/grades'
import { AssignmentDeadlineDialog } from '~/components/surahs/AssignmentDeadlineDialog'
import { GRADE_LABELS, GRADE_ORDER } from '~/data/grades'
import { getSurah } from '~/data/surahs'
import { extractActionErrorMessage } from '~/lib/action-errors'

export type WorkAction = 'assess' | 'reschedule' | 'cancel'
export type WorkActionInput =
  | { action: 'assess'; grade?: SurahGrade; next: boolean }
  | { action: 'reschedule'; change: AssignmentDeadlineChange }
  | { action: 'cancel' }

export function WorkQueueActionDialog({
  row,
  action,
  hasNext,
  onClose,
  onSubmit,
}: {
  row: WorkRow
  action: WorkAction
  hasNext: boolean
  onClose: () => void
  onSubmit: (input: WorkActionInput) => Promise<unknown>
}) {
  const [selection, setSelection] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const studentLabel = `${row.displayName} (@${row.username})`
  if (action === 'reschedule')
    return (
      <AssignmentDeadlineDialog
        assignment={{
          assignmentId: row.id,
          surahNumber: row.surahNumber,
          dueAt: row.dueAt,
        }}
        studentLabel={studentLabel}
        onClose={onClose}
        onSubmit={(change) => onSubmit({ action, change })}
      />
    )
  const cancelling = action === 'cancel'
  const title = cancelling
    ? 'إلغاء الواجب'
    : row.kind === 'review'
      ? 'إتمام المراجعة'
      : 'تقييم واجب الحفظ'
  const grade = GRADE_ORDER.find((value) => value === selection)
  const canSave = cancelling || grade !== undefined || selection === 'keep'
  async function submit(next: boolean) {
    if (pending || !canSave) return
    setPending(true)
    setError(null)
    try {
      await onSubmit(
        cancelling ? { action: 'cancel' } : { action: 'assess', grade, next },
      )
    } catch (cause) {
      setError(
        extractActionErrorMessage(
          cause,
          'تعذر حفظ العملية. تحقق من الاتصال وحاول مرة أخرى. يمكنك إغلاق النافذة وتحديث القائمة إذا تغيّر الواجب.',
        ),
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <Modal
      opened
      title={title}
      centered
      onClose={() => {
        if (!pending) onClose()
      }}
      withCloseButton={!pending}
      closeOnEscape={!pending}
      closeOnClickOutside={!pending}
      closeButtonProps={{ 'aria-label': 'إغلاق نافذة الواجب' }}
    >
      <Stack gap="md">
        <Text style={{ overflowWrap: 'anywhere' }}>{studentLabel}</Text>
        <Text fw={700}>{getSurah(row.surahNumber).nameAr}</Text>
        <Text size="sm" c="dimmed">
          التقييم الحالي:{' '}
          {row.currentGrade === null
            ? 'غير مسجّل'
            : GRADE_LABELS[row.currentGrade]}
        </Text>
        {error ? (
          <Alert color="red" title="تعذر حفظ العملية">
            {error}
          </Alert>
        ) : null}
        {cancelling ? (
          <Text>هل تريد إلغاء هذا الواجب؟ لن يُسجّل تقييم لهذه العملية.</Text>
        ) : (
          <>
            <Text size="sm">
              {row.kind === 'review'
                ? 'أتمم المراجعة مع الإبقاء على التقييم الحالي أو اختيار تقييم جديد. يُحفظ أي تغيير في سجل التقدّم.'
                : 'اختر تقييماً لإتمام واجب الحفظ وإضافته إلى السور وسجل التقدّم.'}
            </Text>
            <Radio.Group
              label="تقييم الحفظ"
              value={selection}
              onChange={setSelection}
            >
              <Stack gap="sm" mt="sm">
                {row.kind === 'review' ? (
                  <Radio
                    value="keep"
                    label="الإبقاء على التقييم الحالي"
                    disabled={pending}
                  />
                ) : null}
                {GRADE_ORDER.map((value) => (
                  <Radio
                    key={value}
                    value={value}
                    label={GRADE_LABELS[value]}
                    disabled={pending}
                  />
                ))}
              </Stack>
            </Radio.Group>
          </>
        )}
        <Group justify="space-between">
          <Button variant="subtle" disabled={pending} onClick={onClose}>
            رجوع
          </Button>
          <Button
            color={cancelling ? 'red' : undefined}
            loading={pending}
            disabled={!canSave}
            onClick={() => void submit(false)}
          >
            {cancelling ? 'تأكيد إلغاء الواجب' : 'حفظ التقييم'}
          </Button>
          {!cancelling && hasNext ? (
            <Button
              variant="light"
              disabled={pending || !canSave}
              onClick={() => void submit(true)}
            >
              حفظ والتالي
            </Button>
          ) : null}
        </Group>
      </Stack>
    </Modal>
  )
}
