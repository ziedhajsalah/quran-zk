import { SurahReviewQueue } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Surahs/SurahReviewQueue',
  component: SurahReviewQueue,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SurahReviewQueue>

export default meta
type Story = StoryObj<typeof meta>

const now = Date.now()
const oneDay = 1000 * 60 * 60 * 24

export const Empty: Story = {
  args: {
    rows: [],
  },
}

export const ReadOnly: Story = {
  args: {
    rows: [
      {
        assignmentId: 'a1',
        surahNumber: 2,
        assignedAt: now - oneDay * 2,
        dueAt: now - oneDay,
      },
      {
        assignmentId: 'a2',
        surahNumber: 18,
        assignedAt: now - oneDay,
        dueAt: now + oneDay * 4,
      },
      {
        assignmentId: 'a3',
        surahNumber: 36,
        assignedAt: now - oneDay * 3,
        dueAt: null,
      },
    ],
  },
}

export const Editable: Story = {
  args: {
    rows: [
      {
        assignmentId: 'a1',
        surahNumber: 67,
        assignedAt: now - oneDay,
        dueAt: now + oneDay * 2,
      },
    ],
    editable: true,
    onClose: (id) => console.log('close', id),
    onCancel: (id) => console.log('cancel', id),
  },
}
