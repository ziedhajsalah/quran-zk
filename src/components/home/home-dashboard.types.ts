import type { FileRouteTypes } from '~/routeTree.gen'

export type LessonKind = 'reading' | 'recitation'
export type CourseArtworkTone = 'primary' | 'tertiary'
export type BottomNavIcon = 'home' | 'lessons' | 'profile'
export type BottomNavId = 'home' | 'surahs' | 'profile'
export type BottomNavRoute = Extract<
  FileRouteTypes['to'],
  '/' | '/surahs' | '/profile'
>

export interface DailyProgressData {
  title: string
  badgeLabel: string
  completionPercent: number
  completionLabel: string
  summary: string
  completedDots: number
  totalDots: number
}

export interface LessonSummary {
  id: string
  title: string
  progressPercent: number
  lastActivityLabel: string
  kind: LessonKind
}

export interface CourseSummary {
  id: string
  title: string
  studentCount: number
  durationWeeks: number
  teacherName: string
  artworkTone: CourseArtworkTone
  artworkLabel: string
  actionLabel: string
}

export interface BottomNavItem {
  id: BottomNavId
  label: string
  icon: BottomNavIcon
  to?: BottomNavRoute
}

export interface HomeDashboardData {
  brandName: string
  brandMarkText: string
  notificationLabel: string
  heroEyebrow: string
  heroGreeting: string
  studentName: string
  heroQuote: string
  dailyProgress: DailyProgressData
  tip: {
    title: string
    body: string
  }
  recentLessonsTitle: string
  recentLessonsActionLabel: string
  recentLessons: Array<LessonSummary>
  coursesTitle: string
  courses: Array<CourseSummary>
  bottomNavItems: Array<BottomNavItem>
  activeBottomNavId: BottomNavItem['id']
  floatingActionLabel: string
}
