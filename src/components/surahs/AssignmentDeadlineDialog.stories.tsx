import { AssignmentDeadlineDialog } from './AssignmentDeadlineDialog'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Surahs/AssignmentDeadlineDialog',
  component: AssignmentDeadlineDialog,
  args: {
    assignment: {
      assignmentId: 'assignment',
      surahNumber: 18,
      dueAt: Date.UTC(2026, 10, 15),
    },
    onClose: () => {},
    onSubmit: (): Promise<unknown> => Promise.resolve(),
  },
} satisfies Meta<typeof AssignmentDeadlineDialog>
export default meta
type Story = StoryObj<typeof meta>
export const ExistingDeadline: Story = {}
export const Undated: Story = {
  args: {
    assignment: { assignmentId: 'undated', surahNumber: 2, dueAt: null },
  },
}
export const SaveError: Story = {
  args: {
    onSubmit: () =>
      Promise.reject(
        new Error('تغيّر موعد الواجب. أغلق النافذة وحدّث القائمة.'),
      ),
  },
}
export const Pending: Story = {
  args: { onSubmit: () => new Promise(() => {}) },
}
