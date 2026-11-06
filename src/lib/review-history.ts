import type { SurahGrade } from '~/data/grades'

export type ReviewHistoryStatus = 'all' | 'closed' | 'cancelled'
export interface ReviewHistoryCursor {
  closedAt: number | null
  id: string
}
export interface ReviewHistoryRow {
  id: string
  surahNumber: number
  status: 'closed' | 'cancelled'
  assignedAt: number
  dueAt: number | null
  closedAt: number | null
  closingGrade: SurahGrade | null
}
export interface ReviewHistoryPage {
  rows: Array<ReviewHistoryRow>
  nextCursor: ReviewHistoryCursor | null
}
