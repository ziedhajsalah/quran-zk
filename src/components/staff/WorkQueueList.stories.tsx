import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router'
import { WorkQueueList } from './WorkQueueList'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Staff/WorkQueueList',
  component: WorkQueueList,
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
  args: {
    busy: false,
    onAction: () => {},
    rows: [
      {
        id: 'review-one',
        kind: 'review',
        currentGrade: 'medium',
        studentId: 'one',
        displayName: 'أحمد محمد',
        username: 'ahmed',
        surahNumber: 1,
        dueAt: Date.UTC(2026, 10, 7),
      },
      {
        id: 'memorization-one',
        kind: 'memorization',
        currentGrade: null,
        studentId: 'two',
        displayName: 'فاطمة علي',
        username: 'fatima',
        surahNumber: 67,
        dueAt: null,
      },
    ],
  },
} satisfies Meta<typeof WorkQueueList>
export default meta
type Story = StoryObj<typeof meta>
export const MixedWork: Story = {}
export const Empty: Story = { args: { rows: [] } }

export const Busy: Story = { args: { busy: true } }
