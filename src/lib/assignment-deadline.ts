export interface AssignmentDeadline {
  assignmentId: string
  surahNumber: number
  dueAt: number | null
}
export interface AssignmentDeadlineChange {
  dueAt: number | null
  expectedDueAt: number | null
}
