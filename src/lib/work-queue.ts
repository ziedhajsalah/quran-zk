export type WorkKind = 'review' | 'memorization'
export type WorkDeadline = 'all' | 'overdue' | 'today' | 'upcoming' | 'undated'
export type WorkFilters = {
  q: string
  kind: 'all' | WorkKind
  deadline: WorkDeadline
}
export type WorkCursor = { dueAt: number | null; kind: WorkKind; id: string }
export type WorkRow = WorkCursor & {
  studentId: string
  displayName: string
  username: string
  surahNumber: number
}
export type WorkPage = { rows: Array<WorkRow>; nextCursor: WorkCursor | null }
