import { createFileRoute } from '@tanstack/react-router'
import { useSuspenseQuery } from '@tanstack/react-query'
import { TeacherDashboard } from '~/components/home/TeacherDashboard'
import { StudentDashboard } from '~/components/home/StudentDashboard'
import { summarizeStudentDashboard } from '~/components/home/student-dashboard'
import { currentUserQuery } from '~/lib/auth-queries'
import {
  gradesQuery,
  notesQuery,
  reviewsQuery,
  teacherDashboardQuery,
} from '~/lib/queries'

export const Route = createFileRoute('/_protected/')({
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(currentUserQuery)
    if (me.isTeacher || me.isAdmin)
      await context.queryClient.ensureQueryData(teacherDashboardQuery())
    else if (me.isStudent)
      await Promise.all([
        context.queryClient.ensureQueryData(gradesQuery(me.id)),
        context.queryClient.ensureQueryData(reviewsQuery(me.id)),
        context.queryClient.ensureQueryData(notesQuery(me.id)),
      ])
    return { now: Date.now() }
  },
  component: Home,
})

function Home() {
  const { data: me } = useSuspenseQuery(currentUserQuery)
  return me.isTeacher || me.isAdmin ? <StaffHome /> : <StudentHome />
}

function StudentHome() {
  const { data: me } = useSuspenseQuery(currentUserQuery)
  const { data: grades } = useSuspenseQuery(gradesQuery(me.id))
  const { data: reviews } = useSuspenseQuery(reviewsQuery(me.id))
  const { data: notes } = useSuspenseQuery(notesQuery(me.id))
  const { now } = Route.useLoaderData()
  return (
    <StudentDashboard
      studentName={me.displayName}
      summary={summarizeStudentDashboard(grades, reviews, notes, now)}
    />
  )
}

function StaffHome() {
  const { data: me } = useSuspenseQuery(currentUserQuery)
  const { data } = useSuspenseQuery(teacherDashboardQuery())
  return <TeacherDashboard displayName={me.displayName} data={data} />
}
