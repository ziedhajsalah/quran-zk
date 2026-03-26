import { homeDashboardStoryData } from '../home-dashboard.fixtures'
import { FloatingActionButton } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Home/FloatingActionButton',
  component: FloatingActionButton,
  args: {
    label: homeDashboardStoryData.floatingActionLabel,
    fixed: false,
  },
} satisfies Meta<typeof FloatingActionButton>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
