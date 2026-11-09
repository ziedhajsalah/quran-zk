import { Button } from '@mantine/core'
import { useState } from 'react'
import { AddSurahDrawer } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Surahs/AddSurahDrawer',
  component: AddSurahDrawer,
  parameters: { layout: 'fullscreen' },
  args: {
    opened: false,
    onClose: () => {},
    excludeSurahNumbers: [],
    onSubmit: () => {},
  },
} satisfies Meta<typeof AddSurahDrawer>

export default meta
type Story = StoryObj<typeof meta>

function Wrapper() {
  const [opened, setOpened] = useState(false)
  return (
    <div style={{ padding: '2rem' }}>
      <Button onClick={() => setOpened(true)}>افتح المحدد</Button>
      <AddSurahDrawer
        opened={opened}
        onClose={() => setOpened(false)}
        excludeSurahNumbers={[1, 2, 18]}
        onSubmit={(input) => console.log('submit', input)}
      />
    </div>
  )
}

export const Interactive: Story = {
  render: () => <Wrapper />,
}
