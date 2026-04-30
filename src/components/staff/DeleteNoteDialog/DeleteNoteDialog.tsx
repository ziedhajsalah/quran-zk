import { Button, Group, Modal, Text } from '@mantine/core'

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
  async function handleConfirm() {
    await onConfirm()
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="حذف ملاحظة"
      centered
      size="sm"
    >
      <Text>هل تريد حذف هذه الملاحظة؟</Text>
      <Group justify="flex-end" gap="sm" mt="md">
        <Button variant="default" onClick={onClose}>
          إلغاء
        </Button>
        <Button color="red" onClick={handleConfirm}>
          حذف
        </Button>
      </Group>
    </Modal>
  )
}
