import { DeleteNoteDialog } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Staff/DeleteNoteDialog',
  component: DeleteNoteDialog,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof DeleteNoteDialog>

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    opened: true,
    onClose: () => console.log('close'),
    onConfirm: () => console.log('confirm'),
  },
}

export const WithSlowConfirm: Story = {
  args: {
    opened: true,
    onClose: () => console.log('close'),
    onConfirm: () => new Promise((resolve) => setTimeout(resolve, 1000)),
  },
}
