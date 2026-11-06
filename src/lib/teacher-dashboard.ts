export interface TeacherDashboardStudent {
  studentId: string
  displayName: string
  username: string
  overdueCount: number
  forgottenCount: number
  oldestDueAt: number | null
}

export interface TeacherDashboardData {
  totalStudents: number
  attentionStudents: number
  overdueReviews: number
  studentsNeedingReview: number
  students: Array<TeacherDashboardStudent>
}
