import { Alert, Badge, Button, Stack, Text } from '@mantine/core'
import { useHydrated } from '@tanstack/react-router'
import { useState } from 'react'
import { extractActionErrorMessage } from '~/lib/action-errors'

export function ReadinessBadge({ readyAt }: { readyAt?: number | null }) {
  return readyAt != null ? (
    <Badge color="teal" variant="light">
      جاهز للتقييم
    </Badge>
  ) : null
}

export function AssignmentReadiness({
  readyAt,
  onSubmit,
  onRefresh,
}: {
  readyAt?: number | null
  onSubmit: (ready: boolean) => Promise<void>
  onRefresh: () => Promise<unknown>
}) {
  const hydrated = useHydrated()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const ready = readyAt != null
  async function change() {
    if (pending || !hydrated) return
    setPending(true)
    setError(null)
    try {
      await onSubmit(!ready)
    } catch (cause) {
      setError(
        extractActionErrorMessage(
          cause,
          'تعذر حفظ الجاهزية. حاول مرة أخرى أو حدّث القائمة.',
        ),
      )
    } finally {
      setPending(false)
    }
  }
  return (
    <Stack gap="xs" mt="sm" align="flex-start">
      <Text size="sm" aria-live="polite">
        {ready
          ? 'أعلنت جاهزيتك. انتظر تقييم معلمك؛ الواجب ما زال مفتوحاً.'
          : 'عندما تنتهي من التدريب، أخبر معلمك أنك جاهز للتقييم.'}
      </Text>
      <Button
        variant="light"
        disabled={!hydrated || pending}
        loading={pending}
        onClick={() => void change()}
      >
        {ready ? 'التراجع عن الجاهزية' : 'أنا جاهز للتقييم'}
      </Button>
      {error ? (
        <Alert color="red" title="تعذر حفظ الجاهزية" role="alert">
          <Stack gap="xs">
            <Text>{error}</Text>
            <Button
              variant="subtle"
              disabled={pending}
              onClick={() => void onRefresh()}
            >
              تحديث القائمة
            </Button>
          </Stack>
        </Alert>
      ) : null}
    </Stack>
  )
}
