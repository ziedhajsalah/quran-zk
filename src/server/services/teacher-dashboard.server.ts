import { sql } from 'drizzle-orm'
import { requireStaff } from '../auth-guards.server'
import { grades, reviews } from '../db/schema/app'
import { user } from '../db/schema/auth'
import type { Actor } from '../auth-guards.server'
import type { Database } from '../db.server'
import type { TeacherDashboardData } from '~/lib/teacher-dashboard'

export async function getTeacherDashboard(
  db: Database,
  actor: Actor | null,
  now = new Date(),
): Promise<TeacherDashboardData> {
  requireStaff(actor)
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  )
  // Aggregate reviews and grades separately to avoid multiplying counts when a
  // student has several of each. One statement keeps totals and preview consistent.
  const result = await db.execute<
    TeacherDashboardData & Record<string, unknown>
  >(sql`
    with overdue as (
      select student_id, count(*)::int as overdue_count, min(due_at) as oldest_due
      from ${reviews}
      where status = 'open' and due_at < ${today.toISOString()}::timestamptz
      group by student_id
    ), forgotten as (
      select student_id, count(*)::int as forgotten_count
      from ${grades} where grade = 'forgotten' group by student_id
    ), students as (
      select u.id, u.name, coalesce(u.username, '') as username,
        coalesce(o.overdue_count, 0) as overdue_count,
        coalesce(f.forgotten_count, 0) as forgotten_count, o.oldest_due
      from ${user} u
      left join overdue o on o.student_id = u.id
      left join forgotten f on f.student_id = u.id
      where u.banned = false and 'student' = any(string_to_array(u.role, ','))
    ), priority as (
      select * from students where overdue_count > 0 or forgotten_count > 0
      order by oldest_due asc nulls last, forgotten_count desc, name, id
      limit 20
    )
    select
      count(*)::int as "totalStudents",
      (count(*) filter (where overdue_count > 0 or forgotten_count > 0))::int as "attentionStudents",
      coalesce(sum(overdue_count), 0)::int as "overdueReviews",
      (count(*) filter (where forgotten_count > 0))::int as "studentsNeedingReview",
      coalesce((select jsonb_agg(jsonb_build_object(
        'studentId', id, 'displayName', name, 'username', username,
        'overdueCount', overdue_count, 'forgottenCount', forgotten_count,
        'oldestDueAt', extract(epoch from oldest_due) * 1000
      ) order by oldest_due asc nulls last, forgotten_count desc, name, id)
      from priority), '[]'::jsonb) as students
    from students
  `)
  return result.rows[0]
}
