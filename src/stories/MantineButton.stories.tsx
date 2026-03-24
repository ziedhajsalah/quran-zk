import { Button, Group } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Mantine/Button',
  component: Button,
  args: {
    children: 'Read surah',
    color: 'teal',
    radius: 'md',
    size: 'md',
  },
} satisfies Meta<typeof Button>

export default meta

type Story = StoryObj<typeof meta>

export const Filled: Story = {}

export const Outline: Story = {
  args: {
    variant: 'outline',
  },
}

export const Grouped: Story = {
  render: (args) => (
    <Group>
      <Button {...args}>Read surah</Button>
      <Button {...args} variant="light">
        Start review
      </Button>
    </Group>
  ),
}
