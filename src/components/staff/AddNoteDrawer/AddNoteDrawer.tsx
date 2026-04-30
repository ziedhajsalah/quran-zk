import { Button, Drawer, Group, Stack, Text, Textarea } from '@mantine/core'
import { useEffect, useState } from 'react'

// Must match MAX_BODY_LENGTH in convex/studentNotes.ts.
const MAX_BODY_LENGTH = 2000

export interface AddNoteDrawerProps {
  opened: boolean
  onClose: () => void
  initialBody?: string
  onSubmit: (body: string) => Promise<void> | void
}

export function AddNoteDrawer({
  opened,
  onClose,
  initialBody,
  onSubmit,
}: AddNoteDrawerProps) {
  const [body, setBody] = useState(initialBody ?? '')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (opened) setBody(initialBody ?? '')
  }, [opened, initialBody])

  function handleClose() {
    // The open-effect resets `body` next time the drawer reopens; we
    // only need to reset `submitting` so the next open isn't disabled.
    setSubmitting(false)
    onClose()
  }

  async function handleSubmit() {
    if (body.trim().length === 0 || submitting) return
    setSubmitting(true)
    try {
      await onSubmit(body)
      handleClose()
    } catch {
      setSubmitting(false)
    }
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      position="bottom"
      size="80%"
      title={initialBody !== undefined ? 'تعديل ملاحظة' : 'إضافة ملاحظة'}
      padding="lg"
    >
      <Stack gap="md">
        <Textarea
          autosize
          minRows={4}
          maxRows={12}
          maxLength={MAX_BODY_LENGTH}
          value={body}
          onChange={(event) => setBody(event.currentTarget.value)}
          placeholder="اكتب ملاحظة..."
        />
        <Text size="xs" c="dimmed" ta="end">
          {`${body.length} / ${MAX_BODY_LENGTH}`}
        </Text>
        <Group justify="flex-end" gap="sm">
          <Button variant="default" onClick={handleClose}>
            إلغاء
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={body.trim().length === 0 || submitting}
            loading={submitting}
          >
            حفظ
          </Button>
        </Group>
      </Stack>
    </Drawer>
  )
}
