import { StudentsPicker } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Surahs/StudentsPicker',
  component: StudentsPicker,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof StudentsPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {
  args: {
    emptyMessage: 'لا يوجد طلاب بعد.',
    students: [
      { id: '1', displayName: 'أحمد محمد', username: 'ahmad' },
      { id: '2', displayName: 'فاطمة علي', username: 'fatima' },
      { id: '3', displayName: 'يوسف الحسن', username: 'yusuf' },
    ],
    onSelect: (id) => console.log('selected', id),
  },
}

export const Empty: Story = {
  args: {
    emptyMessage: 'لا يوجد طلاب بعد.',
    students: [],
    onSelect: () => {},
  },
}
