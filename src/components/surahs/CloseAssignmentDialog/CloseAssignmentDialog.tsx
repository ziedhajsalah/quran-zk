import {
  Alert,
  Badge,
  Button,
  Chip,
  Group,
  Modal,
  Stack,
  Text,
} from '@mantine/core'
import { useEffect, useState } from 'react'
import { NextReviewField } from '../NextReviewField'
import type { AssessmentFeedbackInput } from '~/lib/assessment-feedback'
import type { FollowUpReview } from '~/lib/follow-up-review'
import type { SurahGrade } from '~/data/grades'
import type { Surah } from '~/data/surahs'
import { AssessmentFeedbackField } from '~/components/surahs/AssessmentFeedback'
import { extractActionErrorMessage } from '~/lib/action-errors'
import { followUpReviewInput } from '~/lib/follow-up-review'
import { GRADE_COLORS, GRADE_LABELS, GRADE_ORDER } from '~/data/grades'
import { formatArabicNumber } from '~/components/home/home-formatters'

export interface CloseAssignmentDialogProps {
  opened: boolean
  onClose: () => void
  surah: Surah | null
  currentGrade: SurahGrade | null
  onSubmit: (
    input: { newGrade?: SurahGrade } & FollowUpReview & AssessmentFeedbackInput,
  ) => Promise<unknown> | void
}

type Selection = { kind: 'keep' } | { kind: 'change'; grade: SurahGrade }

export function CloseAssignmentDialog({
  opened,
  onClose,
  surah,
  currentGrade,
  onSubmit,
}: CloseAssignmentDialogProps) {
  const [selection, setSelection] = useState<Selection>({ kind: 'keep' })

  const [feedback, setFeedback] = useState('')
  const [nextReview, setNextReview] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (opened) {
      setSelection({ kind: 'keep' })
      setNextReview(null)
      setFeedback('')
      setError(null)
    }
  }, [opened])

  async function handleSubmit() {
    if (pending || nextReview === '') return
    setPending(true)
    setError(null)
    try {
      await onSubmit({
        ...(selection.kind === 'change' ? { newGrade: selection.grade } : {}),
        ...followUpReviewInput(nextReview),
        feedback,
      })
      onClose()
    } catch (cause) {
      setError(
        extractActionErrorMessage(cause, 'تعذر إغلاق المراجعة. حاول مرة أخرى.'),
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Modal
      opened={opened}
      onClose={() => {
        if (!pending) onClose()
      }}
      withCloseButton={!pending}
      closeOnEscape={!pending}
      closeOnClickOutside={!pending}
      title="إغلاق المراجعة"
      centered
      radius="lg"
    >
      <Stack gap="md">
        {error ? (
          <Alert color="red" title="تعذر إغلاق المراجعة">
            {error}
          </Alert>
        ) : null}
        {surah ? (
          <Stack gap={2}>
            <Text c="dimmed" size="sm">
              السورة
            </Text>
            <Text fw={700} size="lg">
              {`${surah.nameAr} • ${formatArabicNumber(surah.number)}`}
            </Text>
          </Stack>
        ) : null}

        <Stack gap={4}>
          <Text c="dimmed" size="sm">
            التقييم الحالي
          </Text>
          {currentGrade ? (
            <Badge
              color={GRADE_COLORS[currentGrade]}
              radius="xl"
              variant="light"
              w="fit-content"
            >
              {GRADE_LABELS[currentGrade]}
            </Badge>
          ) : (
            <Text c="dimmed" size="sm">
              لا يوجد تقييم بعد.
            </Text>
          )}
        </Stack>

        <Stack gap="xs">
          <Text c="dimmed" size="sm">
            عند الإغلاق
          </Text>
          <Chip
            disabled={pending}
            checked={selection.kind === 'keep'}
            onChange={() => setSelection({ kind: 'keep' })}
            variant="light"
            color="primary"
          >
            إبقاء التقييم الحالي
          </Chip>
          <Chip.Group
            multiple={false}
            value={selection.kind === 'change' ? selection.grade : null}
            onChange={(value) => {
              if (
                value === 'good' ||
                value === 'medium' ||
                value === 'forgotten'
              ) {
                setSelection({ kind: 'change', grade: value })
              }
            }}
          >
            <Group gap="xs">
              {GRADE_ORDER.map((g) => (
                <Chip
                  disabled={pending}
                  key={g}
                  value={g}
                  color={GRADE_COLORS[g]}
                  variant="light"
                >
                  {GRADE_LABELS[g]}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Stack>

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
        <Group justify="space-between">
          <Button variant="subtle" disabled={pending} onClick={onClose}>
            إلغاء
          </Button>
          <Button
            loading={pending}
            disabled={nextReview === ''}
            onClick={() => void handleSubmit()}
          >
            تأكيد الإغلاق
          </Button>
        </Group>
      </Stack>
    </Modal>
  )
}
