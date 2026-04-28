export type SurahGrade = 'good' | 'medium' | 'forgotten'

export const GRADE_LABELS: Record<SurahGrade, string> = {
  good: 'حفظ متقن',
  medium: 'حفظ متوسط',
  forgotten: 'يحتاج مراجعة',
}

export const GRADE_COLORS: Record<SurahGrade, string> = {
  good: 'teal',
  medium: 'yellow',
  forgotten: 'orange',
}

export const GRADE_ORDER: ReadonlyArray<SurahGrade> = ['good', 'medium', 'forgotten']
