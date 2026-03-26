import { homeDashboardStoryData } from '../home-dashboard.fixtures'
import { HomeDashboard } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Home/HomeDashboard',
  component: HomeDashboard,
  args: {
    data: homeDashboardStoryData,
    overlayNavigation: false,
  },
  parameters: {
    layout: 'fullscreen',
  },
} satisfies Meta<typeof HomeDashboard>

export default meta

type Story = StoryObj<typeof meta>

export const Mobile: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 390, margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
}

export const Desktop: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 1280, margin: '0 auto' }}>
        <Story />
      </div>
    ),
  ],
}
