import { Button } from '@mantine/core'
import { useState } from 'react'
import { MemorizationQueue } from './MemorizationQueue'
import { AssignMemorizationDrawer } from './AssignMemorizationDrawer'
import { AssessMemorizationDialog } from './AssessMemorizationDialog'
import type { Meta, StoryObj } from '@storybook/react-vite'

const row = {
  _id: 'new-surah',
  surahNumber: 18,
  assignedAt: Date.UTC(2026, 10, 6),
  dueAt: Date.UTC(2026, 11, 6),
}
const meta = {
  title: 'Surahs/Memorization',
  component: MemorizationQueue,
  parameters: { layout: 'padded' },
  args: {
    rows: [row, { ...row, _id: 'undated', surahNumber: 36, dueAt: null }],
  },
} satisfies Meta<typeof MemorizationQueue>
export default meta
type Story = StoryObj<typeof meta>
export const StudentQueue: Story = {}
export const StaffQueue: Story = { args: { editable: true } }
export const Empty: Story = { args: { rows: [] } }
export const Mobile: Story = {
  decorators: [
    (Story) => (
      <div style={{ maxWidth: 390, margin: 'auto' }}>
        <Story />
      </div>
    ),
  ],
}
function AssignExample() {
  const [opened, setOpened] = useState(true)
  return (
    <>
      <Button onClick={() => setOpened(true)}>إسناد حفظ جديد</Button>
      <AssignMemorizationDrawer
        opened={opened}
        onClose={() => setOpened(false)}
        excludeSurahNumbers={[1, 2]}
        onSubmit={() =>
          Promise.reject(
            new Error('هذه السورة مسجّلة للطالب بالفعل. اختر سورة أخرى.'),
          )
        }
      />
    </>
  )
}
export const AssignmentError: Story = { render: () => <AssignExample /> }
function AssessExample() {
  const [opened, setOpened] = useState(true)
  return (
    <>
      <Button onClick={() => setOpened(true)}>تقييم الحفظ</Button>
      {opened ? (
        <AssessMemorizationDialog
          assignment={row}
          onClose={() => setOpened(false)}
          onSubmit={() =>
            Promise.reject(new Error('تعذر حفظ التقييم. حاول مرة أخرى.'))
          }
        />
      ) : null}
    </>
  )
}
export const AssessmentError: Story = { render: () => <AssessExample /> }
