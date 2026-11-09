import { Alert, Button, Modal, Radio, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import { NextReviewField } from '../NextReviewField'
import type { AssessmentFeedbackInput } from '~/lib/assessment-feedback'
import type { FollowUpReview } from '~/lib/follow-up-review'
import type { MemorizationRow } from '~/lib/memorization'
import type { SurahGrade } from '~/data/grades'
import { AssessmentFeedbackField } from '~/components/surahs/AssessmentFeedback'
import { followUpReviewInput } from '~/lib/follow-up-review'
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
  onSubmit: (
    grade: SurahGrade,
    followUp: FollowUpReview & AssessmentFeedbackInput,
  ) => Promise<unknown>
}) {
  const [grade, setGrade] = useState<SurahGrade | null>(null)
  const [feedback, setFeedback] = useState('')
  const [nextReview, setNextReview] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function submit() {
    if (pending || grade === null || nextReview === '') return
    setPending(true)
    setError(null)
    try {
      await onSubmit(grade, { ...followUpReviewInput(nextReview), feedback })
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
        <Text size="sm" c="dimmed">
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
        <AssessmentFeedbackField
          value={feedback}
          onChange={setFeedback}
          disabled={pending}
        />
        <NextReviewField
          value={nextReview}
          onChange={setNextReview}
          disabled={pending}
        />
        <Button
          loading={pending}
          disabled={grade === null || nextReview === ''}
          onClick={() => void submit()}
        >
          حفظ تقييم الحفظ
        </Button>
      </Stack>
    </Modal>
  )
}
