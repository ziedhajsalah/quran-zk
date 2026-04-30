import { Button, Drawer, Group, Stack, Text, Textarea } from '@mantine/core'
import { useEffect, useState } from 'react'

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
    setBody(initialBody ?? '')
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
          maxLength={2000}
          value={body}
          onChange={(event) => setBody(event.currentTarget.value)}
          placeholder="اكتب ملاحظة..."
        />
        <Group justify="flex-end">
          <Text size="xs" c="dimmed">{`${body.length} / 2000`}</Text>
        </Group>
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
