import { GradeHistoryList } from './GradeHistoryList'
import type { Meta, StoryObj } from '@storybook/react-vite'

const now = Date.UTC(2026, 10, 6, 10)
const meta = {
  title: 'Surahs/GradeHistory',
  component: GradeHistoryList,
  parameters: { layout: 'padded' },
  args: {
    rows: [
      {
        id: 3,
        surahNumber: 1,
        previousGrade: 'medium',
        newGrade: 'good',
        actorDisplayName: 'المعلم أحمد',
        changedAt: now,
        source: 'review',
      },
      {
        id: 2,
        surahNumber: 2,
        previousGrade: 'forgotten',
        newGrade: null,
        actorDisplayName: null,
        changedAt: now - 86400000,
        source: 'grade',
      },
      {
        id: 1,
        surahNumber: 1,
        previousGrade: null,
        newGrade: 'medium',
        actorDisplayName: 'المعلم أحمد',
        changedAt: now - 172800000,
        source: 'grade',
      },
    ],
  },
} satisfies Meta<typeof GradeHistoryList>
export default meta
type Story = StoryObj<typeof meta>
export const Transitions: Story = {}
export const Empty: Story = { args: { rows: [] } }
export const Mobile: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 390, margin: 'auto' }}>
        <Story />
      </div>
    ),
  ],
}
