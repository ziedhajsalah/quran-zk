import { AddNoteDrawer } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Staff/AddNoteDrawer',
  component: AddNoteDrawer,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AddNoteDrawer>

export default meta
type Story = StoryObj<typeof meta>

export const AddMode: Story = {
  args: {
    opened: true,
    onClose: () => console.log('close'),
    onSubmit: (body) => console.log('submit', body),
  },
}

export const EditMode: Story = {
  args: {
    opened: true,
    initialBody: 'ملاحظة قديمة قابلة للتعديل.',
    onClose: () => console.log('close'),
    onSubmit: (body) => console.log('submit', body),
  },
}

export const Empty: Story = {
  args: {
    opened: true,
    onClose: () => console.log('close'),
    onSubmit: (body) => console.log('submit', body),
  },
}

export const LongInitial: Story = {
  args: {
    opened: true,
    initialBody: 'يحفظ بسرعة بعد المغرب. ينصح بالاستراحة. '.repeat(46),
    onClose: () => console.log('close'),
    onSubmit: (body) => console.log('submit', body),
  },
}
