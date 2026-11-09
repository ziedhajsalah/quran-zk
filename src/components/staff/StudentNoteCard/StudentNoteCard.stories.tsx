import { StudentNoteCard } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Staff/StudentNoteCard',
  component: StudentNoteCard,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof StudentNoteCard>

export default meta
type Story = StoryObj<typeof meta>

const now = Date.now()
const minute = 60_000
const hour = 60 * minute
const day = 24 * hour

export const Default: Story = {
  args: {
    authorDisplayName: 'الأستاذ أحمد',
    createdAt: now - 3 * hour,
    editedAt: null,
    body: 'يحفظ بسرعة بعد المغرب.',
    isAuthor: false,
  },
}

export const Edited: Story = {
  args: {
    authorDisplayName: 'الأستاذ أحمد',
    createdAt: now - 3 * hour,
    editedAt: now - 30 * minute,
    body: 'يحفظ بسرعة بعد المغرب.',
    isAuthor: false,
  },
}

export const LongBody: Story = {
  args: {
    authorDisplayName: 'الأستاذ أحمد',
    createdAt: now - 3 * hour,
    editedAt: null,
    body: 'يحفظ بسرعة بعد المغرب. ينصح بالاستراحة. '.repeat(60),
    isAuthor: false,
  },
}

export const IsAuthor: Story = {
  args: {
    authorDisplayName: 'الأستاذ أحمد',
    createdAt: now - 2 * day,
    editedAt: null,
    body: 'يحفظ بسرعة بعد المغرب.',
    isAuthor: true,
    onEdit: () => console.log('edit'),
    onDelete: () => console.log('delete'),
  },
}

export const MultilineBody: Story = {
  args: {
    authorDisplayName: 'الأستاذ أحمد',
    createdAt: now - 3 * hour,
    editedAt: null,
    body: 'السطر الأول\n\nالسطر الثاني بعد فراغ.\nالسطر الثالث.',
    isAuthor: false,
  },
}
