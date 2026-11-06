import type { SurahGrade } from '~/data/grades'

export interface GradeHistoryRow {
  id: number
  surahNumber: number
  previousGrade: SurahGrade | null
  newGrade: SurahGrade | null
  actorDisplayName: string | null
  changedAt: number
  source: 'grade' | 'review'
}
export interface GradeHistoryPage {
  rows: Array<GradeHistoryRow>
  nextCursor: number | null
}
