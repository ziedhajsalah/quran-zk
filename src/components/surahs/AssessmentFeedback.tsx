import { Stack, Text, Textarea } from '@mantine/core'
import { ASSESSMENT_FEEDBACK_LIMIT } from '~/lib/assessment-feedback'

export function AssessmentFeedbackField({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  disabled: boolean
}) {
  return (
    <Textarea
      label="ملاحظات التقييم (اختياري)"
      description="يراها الطالب في سجل الواجب. اذكر ما أتقنه وما يحتاج إلى تحسين (حتى ٢٠٠٠ حرف)."
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      disabled={disabled}
      maxLength={ASSESSMENT_FEEDBACK_LIMIT}
      minRows={3}
      autosize
    />
  )
}

export function AssessmentFeedbackText({
  feedback,
}: {
  feedback?: string | null
}) {
  if (!feedback) return null
  return (
    <Stack gap={4}>
      <Text size="sm" fw={600}>
        ملاحظات المعلم
      </Text>
      <Text
        size="sm"
        style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
      >
        {feedback}
      </Text>
    </Stack>
  )
}
