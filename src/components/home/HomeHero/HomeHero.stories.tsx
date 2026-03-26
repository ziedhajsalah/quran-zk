import { homeDashboardStoryData } from '../home-dashboard.fixtures'
import { HomeHero } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Home/HomeHero',
  component: HomeHero,
  args: {
    eyebrow: homeDashboardStoryData.heroEyebrow,
    greeting: homeDashboardStoryData.heroGreeting,
    studentName: homeDashboardStoryData.studentName,
    quote: homeDashboardStoryData.heroQuote,
  },
} satisfies Meta<typeof HomeHero>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}

export const FallbackName: Story = {
  args: {
    studentName: 'طالب جديد',
  },
}
