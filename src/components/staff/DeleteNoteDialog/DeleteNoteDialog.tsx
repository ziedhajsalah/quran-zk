import { Button, Group, Modal, Text } from '@mantine/core'
import { useState } from 'react'

export interface DeleteNoteDialogProps {
  opened: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
}

export function DeleteNoteDialog({
  opened,
  onClose,
  onConfirm,
}: DeleteNoteDialogProps) {
  const [submitting, setSubmitting] = useState(false)

  async function handleConfirm() {
    if (submitting) return
    setSubmitting(true)
    try {
      await onConfirm()
      onClose()
    } finally {
      setSubmitting(false)
    }
  }

  function handleCancel() {
    if (submitting) return
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={handleCancel}
      title="حذف ملاحظة"
      centered
      size="sm"
    >
      <Text>هل تريد حذف هذه الملاحظة؟</Text>
      <Group justify="flex-end" gap="sm" mt="md">
        <Button
          variant="default"
          onClick={handleCancel}
          disabled={submitting}
        >
          إلغاء
        </Button>
        <Button color="red" onClick={handleConfirm} loading={submitting}>
          حذف
        </Button>
      </Group>
    </Modal>
  )
}
