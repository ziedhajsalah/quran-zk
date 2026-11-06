import { createServerFn } from '@tanstack/react-start'
import { withRuntime } from '../runtime.server'
import { getTeacherDashboard } from '../services/teacher-dashboard.server'

export const summary = createServerFn({ method: 'GET' }).handler(() =>
  withRuntime(({ db, actor }) => getTeacherDashboard(db, actor)),
)
