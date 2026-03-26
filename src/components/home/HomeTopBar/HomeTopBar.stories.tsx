import { homeDashboardStoryData } from '../home-dashboard.fixtures'
import { HomeTopBar } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Home/HomeTopBar',
  component: HomeTopBar,
  args: {
    brandName: homeDashboardStoryData.brandName,
    brandMarkText: homeDashboardStoryData.brandMarkText,
    notificationLabel: homeDashboardStoryData.notificationLabel,
  },
} satisfies Meta<typeof HomeTopBar>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
