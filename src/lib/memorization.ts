import type { SurahGrade } from '~/data/grades'

export interface MemorizationRow {
  _id: string
  surahNumber: number
  assignedAt: number
  readyAt?: number | null
  dueAt: number | null
}
export interface MemorizationInput {
  surahNumber: number
  dueAt?: number
}
export interface MemorizationAssessment {
  feedback?: string
  nextReviewDueAt?: number
  assignmentId: string
  grade: SurahGrade
}

export type MemorizationHistoryStatus = 'all' | 'closed' | 'cancelled'
export interface MemorizationHistoryCursor {
  closedAt: number
  id: string
}
export interface MemorizationHistoryRow {
  id: string
  surahNumber: number
  status: 'closed' | 'cancelled'
  assignedAt: number
  dueAt: number | null
  closedAt: number
  closingGrade: SurahGrade | null
  assessmentFeedback?: string | null
}
export interface MemorizationHistoryPage {
  rows: Array<MemorizationHistoryRow>
  nextCursor: MemorizationHistoryCursor | null
}
