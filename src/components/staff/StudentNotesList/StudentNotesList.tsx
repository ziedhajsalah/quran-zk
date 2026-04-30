import { Button, Group, Stack, Text, Title } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { StudentNoteCard } from '../StudentNoteCard'

export interface StudentNoteRow {
  noteId: string
  authorDisplayName: string
  authorId: string
  createdAt: number
  editedAt: number | null
  body: string
}

export interface StudentNotesListProps {
  rows: ReadonlyArray<StudentNoteRow>
  currentUserId: string
  onAdd?: () => void
  onEdit?: (noteId: string) => void
  onDelete?: (noteId: string) => void
  emptyMessage?: string
}

const DEFAULT_EMPTY_MESSAGE = 'لا توجد ملاحظات بعد'

export function StudentNotesList({
  rows,
  currentUserId,
  onAdd,
  onEdit,
  onDelete,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
}: StudentNotesListProps) {
  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={3}>الملاحظات</Title>
        {onAdd ? (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={onAdd}
            variant="light"
          >
            إضافة ملاحظة
          </Button>
        ) : null}
      </Group>

      {rows.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          {emptyMessage}
        </Text>
      ) : (
        <Stack gap="md">
          {rows.map((row) => {
            const isAuthor = row.authorId === currentUserId
            return (
              <StudentNoteCard
                key={row.noteId}
                authorDisplayName={row.authorDisplayName}
                createdAt={row.createdAt}
                editedAt={row.editedAt}
                body={row.body}
                isAuthor={isAuthor}
                onEdit={isAuthor && onEdit ? () => onEdit(row.noteId) : undefined}
                onDelete={
                  isAuthor && onDelete ? () => onDelete(row.noteId) : undefined
                }
              />
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}
