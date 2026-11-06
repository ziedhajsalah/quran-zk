import type { SurahGrade } from '~/data/grades'

export interface MemorizationRow {
  _id: string
  surahNumber: number
  assignedAt: number
  dueAt: number | null
}
export interface MemorizationInput {
  surahNumber: number
  dueAt?: number
}
export interface MemorizationAssessment {
  assignmentId: string
  grade: SurahGrade
}
