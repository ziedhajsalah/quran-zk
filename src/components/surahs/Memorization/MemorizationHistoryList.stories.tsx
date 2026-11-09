import { MemorizationHistoryList } from './MemorizationHistoryList'
import type { Meta, StoryObj } from '@storybook/react-vite'

const now = Date.UTC(2026, 10, 6)
const meta = {
  title: 'Surahs/MemorizationHistory',
  component: MemorizationHistoryList,
  parameters: { layout: 'padded' },
  args: {
    rows: [
      {
        id: 'completed',
        surahNumber: 1,
        status: 'closed',
        assignedAt: now - 86400000 * 3,
        dueAt: now,
        closedAt: now,
        closingGrade: 'good',
        assessmentFeedback:
          'أحسنت الحفظ.\nراجع أحكام المدّ قبل المراجعة التالية.',
      },
      {
        id: 'cancelled',
        surahNumber: 2,
        status: 'cancelled',
        assignedAt: now - 86400000 * 2,
        dueAt: null,
        closedAt: now - 86400000,
        closingGrade: null,
      },
    ],
  },
} satisfies Meta<typeof MemorizationHistoryList>
export default meta
type Story = StoryObj<typeof meta>
export const CompletedAndCancelled: Story = {}
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
