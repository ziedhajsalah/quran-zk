import type { SurahGrade } from '~/data/grades'
import { SURAHS } from '~/data/surahs'

export interface DashboardGrade {
  surahNumber: number
  grade: SurahGrade
}
export interface DashboardReview {
  readyAt?: number | null
  _id: string
  surahNumber: number
  dueAt: number | null
  assignedAt: number
}
export interface DashboardNote {
  _id: string
  body: string
  authorDisplayName: string
  createdAt: number
  editedAt: number | null
}

// Due dates are stored as UTC calendar dates, matching the review queue.
export function summarizeStudentDashboard(
  grades: ReadonlyArray<DashboardGrade>,
  reviews: ReadonlyArray<DashboardReview>,
  notes: ReadonlyArray<DashboardNote>,
  now: number,
) {
  const date = new Date(now)
  const today = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  )
  const counts = { good: 0, medium: 0, forgotten: 0 }
  for (const row of grades) counts[row.grade]++
  return {
    counts,
    totalSurahs: SURAHS.length,
    recorded: grades.length,
    masteryPercent: Math.round((counts.good / SURAHS.length) * 100),
    overdue: reviews.filter((row) => row.dueAt !== null && row.dueAt < today)
      .length,
    dueToday: reviews.filter(
      (row) =>
        row.dueAt !== null &&
        row.dueAt >= today &&
        row.dueAt < today + 86_400_000,
    ).length,
    reviewCount: reviews.length,
    reviews: [...reviews]
      .sort(
        (a, b) =>
          (a.dueAt ?? Infinity) - (b.dueAt ?? Infinity) ||
          a.assignedAt - b.assignedAt ||
          a._id.localeCompare(b._id),
      )
      .slice(0, 5),
    notes: [...notes]
      .sort((a, b) => b.createdAt - a.createdAt || b._id.localeCompare(a._id))
      .slice(0, 3),
  }
}
export type StudentDashboardSummary = ReturnType<
  typeof summarizeStudentDashboard
>
