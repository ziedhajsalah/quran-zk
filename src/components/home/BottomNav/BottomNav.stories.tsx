import { homeDashboardStoryData } from '../home-dashboard.fixtures'
import { BottomNav } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Home/BottomNav',
  component: BottomNav,
  args: {
    items: homeDashboardStoryData.bottomNavItems,
    activeItemId: homeDashboardStoryData.activeBottomNavId,
    fixed: false,
  },
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '1rem 1rem 2rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof BottomNav>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
