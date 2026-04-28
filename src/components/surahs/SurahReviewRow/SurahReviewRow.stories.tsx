import { SurahReviewRow } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { getSurah } from '~/data/surahs'

const meta = {
  title: 'Surahs/SurahReviewRow',
  component: SurahReviewRow,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SurahReviewRow>

export default meta
type Story = StoryObj<typeof meta>

const now = Date.now()
const oneDay = 1000 * 60 * 60 * 24

export const NoDueDate: Story = {
  args: {
    surah: getSurah(18),
    assignedAt: now - oneDay,
    dueAt: null,
  },
}

export const WithDueDate: Story = {
  args: {
    surah: getSurah(36),
    assignedAt: now - oneDay * 2,
    dueAt: now + oneDay * 5,
  },
}

export const Overdue: Story = {
  args: {
    surah: getSurah(2),
    assignedAt: now - oneDay * 10,
    dueAt: now - oneDay * 2,
  },
}

export const Editable: Story = {
  args: {
    surah: getSurah(67),
    assignedAt: now - oneDay,
    dueAt: now + oneDay * 3,
    editable: true,
    onClose: () => console.log('close clicked'),
    onCancel: () => console.log('cancel clicked'),
  },
}
