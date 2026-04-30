import { ActionIcon, Badge, Card, Group, Menu, Stack, Text } from '@mantine/core'
import { IconDots, IconPencil, IconTrash } from '@tabler/icons-react'
import { formatArabicRelative } from '~/lib/arabic-time'

export interface StudentNoteCardProps {
  authorDisplayName: string
  createdAt: number
  editedAt: number | null
  body: string
  isAuthor: boolean
  onEdit?: () => void
  onDelete?: () => void
}

export function StudentNoteCard({
  authorDisplayName,
  createdAt,
  editedAt,
  body,
  isAuthor,
  onEdit,
  onDelete,
}: StudentNoteCardProps) {
  return (
    <Card withBorder padding="md">
      <Group justify="space-between" align="flex-start" wrap="nowrap">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text fw={600}>{authorDisplayName}</Text>
          <Group gap="xs">
            <Text size="xs" c="dimmed">
              {formatArabicRelative(createdAt)}
            </Text>
            {editedAt !== null ? (
              <Badge size="xs" variant="light" color="gray">
                تم التعديل
              </Badge>
            ) : null}
          </Group>
        </Stack>

        {isAuthor ? (
          <Menu position="bottom-end" withinPortal>
            <Menu.Target>
              <ActionIcon variant="subtle" color="gray" aria-label="خيارات">
                <IconDots size={18} />
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item leftSection={<IconPencil size={16} />} onClick={onEdit}>
                تعديل
              </Menu.Item>
              <Menu.Item color="red" leftSection={<IconTrash size={16} />} onClick={onDelete}>
                حذف
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        ) : null}
      </Group>

      <Text style={{ whiteSpace: 'pre-wrap' }}>{body}</Text>
    </Card>
  )
}
