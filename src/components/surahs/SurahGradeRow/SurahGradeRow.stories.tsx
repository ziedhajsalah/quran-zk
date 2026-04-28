import { SurahGradeRow } from './SurahGradeRow'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { getSurah } from '~/data/surahs'

const meta = {
  title: 'Surahs/SurahGradeRow',
  component: SurahGradeRow,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SurahGradeRow>

export default meta
type Story = StoryObj<typeof meta>

export const Good: Story = {
  args: {
    surah: getSurah(18),
    grade: 'good',
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
}

export const Medium: Story = {
  args: {
    surah: getSurah(19),
    grade: 'medium',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
}

export const Forgotten: Story = {
  args: {
    surah: getSurah(2),
    grade: 'forgotten',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
  },
}
