import { useState } from 'react'
import { AssignmentReadiness, ReadinessBadge } from './AssignmentReadiness'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Surahs/AssignmentReadiness',
  component: AssignmentReadiness,
  args: {
    readyAt: null,
    onSubmit: async () => {},
    onRefresh: async () => {},
  },
} satisfies Meta<typeof AssignmentReadiness>
export default meta
type Story = StoryObj<typeof meta>

function StudentExample() {
  const [readyAt, setReadyAt] = useState<number | null>(null)
  return (
    <>
      <ReadinessBadge readyAt={readyAt} />
      <AssignmentReadiness
        readyAt={readyAt}
        onSubmit={(ready) => {
          setReadyAt(ready ? Date.now() : null)
          return Promise.resolve()
        }}
        onRefresh={async () => {}}
      />
    </>
  )
}
export const Student: Story = { render: () => <StudentExample /> }
export const Ready: Story = { args: { readyAt: Date.UTC(2026, 10, 8) } }
export const FailedSave: Story = {
  args: {
    onSubmit: () =>
      Promise.reject(
        new Error('الواجب لم يعد مفتوحاً. حدّث القائمة ثم حاول مرة أخرى.'),
      ),
  },
}
