import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { TeacherDashboard } from './TeacherDashboard'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Home/TeacherDashboard',
  component: TeacherDashboard,
  decorators: [
    (Story) => {
      const root = createRootRoute({ component: () => <Story /> })
      const router = createRouter({
        routeTree: root,
        history: createMemoryHistory({ initialEntries: ['/'] }),
      })
      return <RouterProvider router={router} />
    },
  ],
  parameters: { layout: 'fullscreen' },
  args: {
    displayName: 'معلم المدرسة',
    data: {
      totalStudents: 12,
      attentionStudents: 2,
      overdueReviews: 3,
      studentsNeedingReview: 2,
      students: [
        {
          studentId: 'one',
          displayName: 'أحمد محمد',
          username: 'ahmed',
          overdueCount: 3,
          forgottenCount: 1,
          oldestDueAt: Date.UTC(2026, 10, 1),
        },
        {
          studentId: 'two',
          displayName: 'فاطمة علي',
          username: 'fatima',
          overdueCount: 0,
          forgottenCount: 2,
          oldestDueAt: null,
        },
      ],
    },
  },
} satisfies Meta<typeof TeacherDashboard>
export default meta
type Story = StoryObj<typeof meta>
export const Populated: Story = {}
export const NoStudents: Story = {
  args: {
    data: {
      totalStudents: 0,
      attentionStudents: 0,
      overdueReviews: 0,
      studentsNeedingReview: 0,
      students: [],
    },
  },
}
export const NothingOverdue: Story = {
  args: {
    data: {
      totalStudents: 12,
      attentionStudents: 0,
      overdueReviews: 0,
      studentsNeedingReview: 0,
      students: [],
    },
  },
}
export const Mobile: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 390, margin: 'auto' }}>
        <Story />
      </div>
    ),
  ],
}
