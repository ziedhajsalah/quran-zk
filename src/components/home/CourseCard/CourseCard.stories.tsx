import { homeDashboardStoryData } from '../home-dashboard.fixtures'
import { CourseCard } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Home/CourseCard',
  component: CourseCard,
  args: {
    course: homeDashboardStoryData.courses[0],
  },
} satisfies Meta<typeof CourseCard>

export default meta

type Story = StoryObj<typeof meta>

export const PrimaryArtwork: Story = {}

export const TertiaryArtwork: Story = {
  args: {
    course: homeDashboardStoryData.courses[1],
  },
}
