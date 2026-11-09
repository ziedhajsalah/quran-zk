import { Button } from '@mantine/core'
import { useState } from 'react'
import { CloseAssignmentDialog } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { getSurah } from '~/data/surahs'

const meta = {
  title: 'Surahs/CloseAssignmentDialog',
  component: CloseAssignmentDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    opened: false,
    onClose: () => {},
    surah: null,
    currentGrade: null,
    onSubmit: () => {},
  },
} satisfies Meta<typeof CloseAssignmentDialog>

export default meta
type Story = StoryObj<typeof meta>

function Wrapper() {
  const [opened, setOpened] = useState(false)
  return (
    <div style={{ padding: '2rem' }}>
      <Button onClick={() => setOpened(true)}>افتح المربع</Button>
      <CloseAssignmentDialog
        opened={opened}
        onClose={() => setOpened(false)}
        surah={getSurah(36)}
        currentGrade="medium"
        onSubmit={(input) => console.log('submit', input)}
      />
    </div>
  )
}

export const Interactive: Story = {
  render: () => <Wrapper />,
}

function NoGradeWrapper() {
  const [opened, setOpened] = useState(false)
  return (
    <div style={{ padding: '2rem' }}>
      <Button onClick={() => setOpened(true)}>افتح بدون تقييم</Button>
      <CloseAssignmentDialog
        opened={opened}
        onClose={() => setOpened(false)}
        surah={getSurah(112)}
        currentGrade={null}
        onSubmit={(input) => console.log('submit', input)}
      />
    </div>
  )
}

export const NoCurrentGrade: Story = {
  render: () => <NoGradeWrapper />,
}
