import type { HomeDashboardData } from './home-dashboard.types'

const baseHomeDashboardData: HomeDashboardData = {
  brandName: 'المدرسة القرآنية',
  brandMarkText: 'قر',
  notificationLabel: 'التنبيهات',
  heroEyebrow: 'لوحة تحكم الطالب',
  heroGreeting: 'أهلاً بك،',
  studentName: 'أحمد محمد',
  heroQuote: '"خيركم من تعلم القرآن وعلمه" - واصل رحلتك في رحاب القرآن الكريم اليوم.',
  dailyProgress: {
    title: 'التقدم اليومي',
    badgeLabel: 'تم الإنجاز',
    completionPercent: 75,
    completionLabel: 'تم الإنجاز',
    summary: 'لقد أتممت مراجعة ٣ صفحات من أصل ٤ مقررة اليوم.',
    completedDots: 3,
    totalDots: 5,
  },
  tip: {
    title: 'نصيحة اليوم',
    body: 'كرر الآيات التي حفظتها حديثاً قبل النوم لترسيخها في الذاكرة الطويلة.',
  },
  recentLessonsTitle: 'آخر الدروس',
  recentLessonsActionLabel: 'عرض الكل',
  recentLessons: [
    {
      id: 'lesson-al-kahf',
      title: 'سورة الكهف',
      progressPercent: 85,
      lastActivityLabel: 'آخر نشاط: منذ ساعتين',
      kind: 'reading',
    },
    {
      id: 'lesson-maryam',
      title: 'سورة مريم',
      progressPercent: 40,
      lastActivityLabel: 'آخر نشاط: أمس',
      kind: 'recitation',
    },
  ],
  coursesTitle: 'دروسي',
  courses: [
    {
      id: 'course-tajweed-basics',
      title: 'أحكام التجويد للمبتدئين',
      studentCount: 12,
      durationWeeks: 8,
      teacherName: 'د. عبد الرحمن زيد',
      artworkTone: 'primary',
      artworkLabel: 'مقدمة في التجويد',
      actionLabel: 'فتح دورة أحكام التجويد للمبتدئين',
    },
    {
      id: 'course-tabarak',
      title: 'حفظ جزء تبارك',
      studentCount: 8,
      durationWeeks: 12,
      teacherName: 'أ. فاطمة الزهراء',
      artworkTone: 'tertiary',
      artworkLabel: 'حفظ جزء تبارك',
      actionLabel: 'فتح دورة حفظ جزء تبارك',
    },
  ],
  bottomNavItems: [
    {
      id: 'home',
      label: 'الرئيسية',
      icon: 'home',
      to: '/',
    },
    {
      id: 'lessons',
      label: 'الدروس',
      icon: 'lessons',
    },
    {
      id: 'profile',
      label: 'الملف الشخصي',
      icon: 'profile',
      to: '/profile',
    },
  ],
  activeBottomNavId: 'home',
  floatingActionLabel: 'إضافة سريع',
}

export function createHomeDashboardData(studentName?: string): HomeDashboardData {
  const normalizedStudentName = studentName?.trim()

  return {
    ...baseHomeDashboardData,
    studentName:
      normalizedStudentName && normalizedStudentName.length > 0
        ? normalizedStudentName
        : baseHomeDashboardData.studentName,
  }
}

export const homeDashboardStoryData = createHomeDashboardData()
