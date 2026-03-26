import { homeDashboardStoryData } from '../home-dashboard.fixtures'
import { TipCard } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Home/TipCard',
  component: TipCard,
  args: {
    title: homeDashboardStoryData.tip.title,
    body: homeDashboardStoryData.tip.body,
  },
} satisfies Meta<typeof TipCard>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
