import { SurahGradeList } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Surahs/SurahGradeList',
  component: SurahGradeList,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SurahGradeList>

export default meta
type Story = StoryObj<typeof meta>

const now = Date.now()

export const Populated: Story = {
  args: {
    emptyMessage: 'لا توجد سور بعد.',
    rows: [
      { surahNumber: 1, grade: 'good', updatedAt: now - 1000 * 60 * 60 * 2 },
      { surahNumber: 18, grade: 'medium', updatedAt: now - 1000 * 60 * 60 * 24 },
      { surahNumber: 36, grade: 'forgotten', updatedAt: now - 1000 * 60 * 60 * 24 * 7 },
      { surahNumber: 67, grade: 'good', updatedAt: now - 1000 * 60 * 60 * 6 },
    ],
  },
}

export const Empty: Story = {
  args: {
    emptyMessage: 'لم تبدأ في حفظ أي سورة بعد. تواصل مع معلمك.',
    rows: [],
  },
}

export const Editable: Story = {
  args: {
    emptyMessage: 'لم يبدأ هذا الطالب الحفظ بعد. أضف أول سورة.',
    rows: [
      { surahNumber: 1, grade: 'good', updatedAt: now - 1000 * 60 * 60 },
      { surahNumber: 18, grade: 'medium', updatedAt: now - 1000 * 60 * 60 * 24 },
    ],
    editable: true,
    onChangeGrade: (n, g) => console.log('grade changed', n, g),
    onAddSurah: () => console.log('add surah clicked'),
  },
}
