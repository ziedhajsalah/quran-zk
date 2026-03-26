import { homeDashboardStoryData } from '../home-dashboard.fixtures'
import { LessonCard } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Home/LessonCard',
  component: LessonCard,
  args: {
    lesson: homeDashboardStoryData.recentLessons[0],
  },
} satisfies Meta<typeof LessonCard>

export default meta

type Story = StoryObj<typeof meta>

export const ReadingLesson: Story = {}

export const RecitationLesson: Story = {
  args: {
    lesson: homeDashboardStoryData.recentLessons[1],
  },
}
