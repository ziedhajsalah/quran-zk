import { homeDashboardStoryData } from '../home-dashboard.fixtures'
import { DailyProgressCard } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Home/DailyProgressCard',
  component: DailyProgressCard,
  args: {
    data: homeDashboardStoryData.dailyProgress,
  },
} satisfies Meta<typeof DailyProgressCard>

export default meta

type Story = StoryObj<typeof meta>

export const PartialProgress: Story = {}
