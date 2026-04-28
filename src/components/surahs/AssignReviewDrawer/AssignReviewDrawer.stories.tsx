import { Button } from '@mantine/core'
import { useState } from 'react'
import { AssignReviewDrawer } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Surahs/AssignReviewDrawer',
  component: AssignReviewDrawer,
  parameters: { layout: 'fullscreen' },
  args: {
    opened: false,
    onClose: () => {},
    memorizedSurahNumbers: [],
    excludeSurahNumbers: [],
    onSubmit: () => {},
  },
} satisfies Meta<typeof AssignReviewDrawer>

export default meta
type Story = StoryObj<typeof meta>

function Wrapper() {
  const [opened, setOpened] = useState(false)
  return (
    <div style={{ padding: '2rem' }}>
      <Button onClick={() => setOpened(true)}>افتح المحدد</Button>
      <AssignReviewDrawer
        opened={opened}
        onClose={() => setOpened(false)}
        memorizedSurahNumbers={[1, 2, 18, 36, 67, 112, 113, 114]}
        excludeSurahNumbers={[2]}
        onSubmit={(input) => console.log('submit', input)}
      />
    </div>
  )
}

export const Interactive: Story = {
  render: () => <Wrapper />,
}
