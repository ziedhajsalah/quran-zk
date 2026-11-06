import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { StudentDashboard } from './StudentDashboard'
import { summarizeStudentDashboard } from './student-dashboard'
import type { Meta, StoryObj } from '@storybook/react-vite'

const now = Date.UTC(2026, 10, 6)
const meta = {
  title: 'Home/StudentDashboard',
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
  component: StudentDashboard,
  parameters: { layout: 'fullscreen' },
  args: {
    studentName: 'أحمد محمد',
    summary: summarizeStudentDashboard(
      [
        { surahNumber: 1, grade: 'good' },
        { surahNumber: 2, grade: 'medium' },
        { surahNumber: 3, grade: 'forgotten' },
      ],
      [
        {
          _id: 'overdue',
          surahNumber: 1,
          assignedAt: now - 86400000 * 3,
          dueAt: now - 86400000,
        },
        {
          _id: 'today',
          surahNumber: 2,
          assignedAt: now - 86400000,
          dueAt: now,
        },
        { _id: 'undated', surahNumber: 3, assignedAt: now, dueAt: null },
      ],
      [
        {
          _id: 'note',
          authorDisplayName: 'المعلم',
          body: 'أحسنت في مراجعة الفاتحة. واصل التكرار لتثبيت الحفظ.',
          createdAt: now,
          editedAt: null,
        },
      ],
      now,
    ),
  },
} satisfies Meta<typeof StudentDashboard>
export default meta
type Story = StoryObj<typeof meta>
export const Populated: Story = {}
export const Empty: Story = {
  args: { summary: summarizeStudentDashboard([], [], [], now) },
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

export const NewMemorization: Story = {
  args: {
    memorization: [
      {
        _id: 'new-18',
        surahNumber: 18,
        assignedAt: now,
        dueAt: now + 86400000,
      },
      { _id: 'new-36', surahNumber: 36, assignedAt: now, dueAt: null },
    ],
  },
}
