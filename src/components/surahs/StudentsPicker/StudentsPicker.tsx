import { Avatar, Card, Group, Stack, Text, UnstyledButton } from '@mantine/core'
import { getInitials } from '~/utils/getInitials'

export interface StudentSummary {
  id: string
  displayName: string
  username: string
}

export interface StudentsPickerProps {
  students: ReadonlyArray<StudentSummary>
  emptyMessage: string
  onSelect: (studentId: string) => void
}

export function StudentsPicker({ students, emptyMessage, onSelect }: StudentsPickerProps) {
  if (students.length === 0) {
    return (
      <Card withBorder radius="lg" p="xl">
        <Text c="dimmed" ta="center">
          {emptyMessage}
        </Text>
      </Card>
    )
  }

  return (
    <Stack gap="sm">
      {students.map((student) => (
        <UnstyledButton key={student.id} onClick={() => onSelect(student.id)} w="100%">
          <Card
            withBorder
            radius="lg"
            p="md"
            styles={(theme) => ({
              root: {
                transition: 'border-color 120ms ease, background-color 120ms ease',
                '&:hover': {
                  borderColor: theme.colors.primary[4],
                  backgroundColor: theme.colors.primary[0],
                },
              },
            })}
          >
            <Group wrap="nowrap">
              <Avatar color="primary" radius="xl">
                {getInitials(student.displayName)}
              </Avatar>
              <Stack gap={2} style={{ minWidth: 0 }}>
                <Text fw={700} lineClamp={1}>
                  {student.displayName || 'بدون اسم'}
                </Text>
                <Text c="dimmed" size="sm">
                  {student.username ? `@${student.username}` : 'بدون اسم مستخدم'}
                </Text>
              </Stack>
            </Group>
          </Card>
        </UnstyledButton>
      ))}
    </Stack>
  )
}

