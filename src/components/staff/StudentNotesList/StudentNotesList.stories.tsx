import { StudentNotesList } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Staff/StudentNotesList',
  component: StudentNotesList,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof StudentNotesList>

export default meta
type Story = StoryObj<typeof meta>

const now = Date.now()
const minute = 60_000
const hour = 60 * minute
const day = 24 * hour

const currentUserId = 'teacher-1'

export const Empty: Story = {
  args: {
    rows: [],
    currentUserId,
    onAdd: () => console.log('add'),
    onEdit: (id) => console.log('edit', id),
    onDelete: (id) => console.log('delete', id),
  },
}

export const MixedAuthors: Story = {
  args: {
    rows: [
      {
        noteId: 'n1',
        authorDisplayName: 'الأستاذ أحمد',
        authorId: 'teacher-1',
        createdAt: now - 2 * hour,
        editedAt: null,
        body: 'يحفظ بسرعة بعد المغرب.',
      },
      {
        noteId: 'n2',
        authorDisplayName: 'الأستاذة فاطمة',
        authorId: 'teacher-2',
        createdAt: now - 1 * day,
        editedAt: null,
        body: 'يحتاج تشجيعا في السور الطويلة.',
      },
      {
        noteId: 'n3',
        authorDisplayName: 'الأستاذ أحمد',
        authorId: 'teacher-1',
        createdAt: now - 3 * day,
        editedAt: now - 2 * day,
        body: 'كان غائبا اليوم لظروف عائلية.',
      },
    ],
    currentUserId,
    onAdd: () => console.log('add'),
    onEdit: (id) => console.log('edit', id),
    onDelete: (id) => console.log('delete', id),
  },
}

export const OneEdited: Story = {
  args: {
    rows: [
      {
        noteId: 'n1',
        authorDisplayName: 'الأستاذ أحمد',
        authorId: 'teacher-1',
        createdAt: now - 5 * hour,
        editedAt: now - 1 * hour,
        body: 'تحسن كبير في المراجعة.',
      },
    ],
    currentUserId,
    onAdd: () => console.log('add'),
    onEdit: (id) => console.log('edit', id),
    onDelete: (id) => console.log('delete', id),
  },
}

const studentUserId = 'student-1'

export const ReadOnlyStudentView: Story = {
  args: {
    rows: [
      {
        noteId: 'n1',
        authorDisplayName: 'الأستاذ أحمد',
        authorId: 'teacher-1',
        createdAt: now - 2 * hour,
        editedAt: null,
        body: 'يحفظ بسرعة بعد المغرب.',
      },
      {
        noteId: 'n2',
        authorDisplayName: 'الأستاذة فاطمة',
        authorId: 'teacher-2',
        createdAt: now - 3 * day,
        editedAt: now - 2 * day,
        body: 'تحسن كبير في المراجعة.',
      },
    ],
    currentUserId: studentUserId,
    emptyMessage: 'لا توجد ملاحظات من معلمك بعد',
  },
}

export const ReadOnlyStudentEmpty: Story = {
  args: {
    rows: [],
    currentUserId: studentUserId,
    emptyMessage: 'لا توجد ملاحظات من معلمك بعد',
  },
}
