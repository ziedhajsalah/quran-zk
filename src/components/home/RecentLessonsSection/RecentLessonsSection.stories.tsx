import { homeDashboardStoryData } from '../home-dashboard.fixtures'
import { RecentLessonsSection } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Home/RecentLessonsSection',
  component: RecentLessonsSection,
  args: {
    title: homeDashboardStoryData.recentLessonsTitle,
    actionLabel: homeDashboardStoryData.recentLessonsActionLabel,
    lessons: homeDashboardStoryData.recentLessons,
  },
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RecentLessonsSection>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
