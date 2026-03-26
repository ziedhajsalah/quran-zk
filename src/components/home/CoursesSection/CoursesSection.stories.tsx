import { homeDashboardStoryData } from '../home-dashboard.fixtures'
import { CoursesSection } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Home/CoursesSection',
  component: CoursesSection,
  args: {
    title: homeDashboardStoryData.coursesTitle,
    courses: homeDashboardStoryData.courses,
  },
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '1rem' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof CoursesSection>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
