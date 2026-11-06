import { Alert, Button, Modal, Radio, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { MemorizationRow } from '~/lib/memorization'
import type { SurahGrade } from '~/data/grades'
import { GRADE_LABELS, GRADE_ORDER } from '~/data/grades'
import { getSurah } from '~/data/surahs'
import { extractActionErrorMessage } from '~/lib/action-errors'

export function AssessMemorizationDialog({
  assignment,
  onClose,
  onSubmit,
}: {
  assignment: MemorizationRow
  onClose: () => void
  onSubmit: (grade: SurahGrade) => Promise<unknown>
}) {
  const [grade, setGrade] = useState<SurahGrade | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit() {
    if (pending || grade === null) return
    setPending(true)
    setError(null)
    try {
      await onSubmit(grade)
      onClose()
    } catch (cause) {
      setError(
        extractActionErrorMessage(
          cause,
          'تعذر حفظ تقييم الحفظ. حاول مرة أخرى.',
        ),
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
      title="تقييم واجب الحفظ"
      centered
      radius="lg"
      withCloseButton={!pending}
      closeOnEscape={!pending}
      closeOnClickOutside={!pending}
    >
      <Stack gap="md">
        <Text fw={700}>{getSurah(assignment.surahNumber).nameAr}</Text>
        <Text size="sm" c="gray.7">
          يُسجّل التقييم في قائمة السور وسجل التقدّم، ويُغلق واجب الحفظ.
        </Text>
        {error ? (
          <Alert color="red" title="تعذر حفظ التقييم">
            {error}
          </Alert>
        ) : null}
        <Radio.Group
          label="تقييم الحفظ"
          value={grade ?? ''}
          onChange={(value) => {
            if (value === 'good' || value === 'medium' || value === 'forgotten')
              setGrade(value)
          }}
        >
          <Stack gap="sm" mt="sm">
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
        <Button
          loading={pending}
          disabled={grade === null}
          onClick={() => void submit()}
        >
          حفظ تقييم الحفظ
        </Button>
      </Stack>
    </Modal>
  )
}
