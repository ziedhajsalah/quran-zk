import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type { ReviewHistoryCursor, ReviewHistoryStatus } from './review-history'
import * as grades from '~/server/functions/grades'
import * as reviews from '~/server/functions/reviews'
import * as notes from '~/server/functions/notes'
import * as teacherDashboard from '~/server/functions/teacher-dashboard'

export const teacherDashboardQuery = () =>
  queryOptions({
    queryKey: ['teacher-dashboard'],
    queryFn: () => teacherDashboard.summary(),
  })

export const studentsQuery = () =>
  queryOptions({
    queryKey: ['students'],
    queryFn: () => grades.listAllStudents(),
  })
export const gradesQuery = (studentId: string) =>
  queryOptions({
    queryKey: ['grades', studentId],
    queryFn: () => grades.listForStudent({ data: { studentId } }),
  })
export const reviewsQuery = (studentId: string) =>
  queryOptions({
    queryKey: ['reviews', studentId],
    queryFn: () => reviews.listOpenForStudent({ data: { studentId } }),
  })
// Shares the reviews prefix so closing/cancelling immediately invalidates history.
export const reviewHistoryQuery = (
  studentId: string,
  status: ReviewHistoryStatus,
  cursor: ReviewHistoryCursor | null,
) =>
  queryOptions({
    queryKey: ['reviews', studentId, 'history', status, cursor],
    queryFn: () =>
      reviews.listHistoryForStudent({ data: { studentId, status, cursor } }),
  })
export const notesQuery = (studentId: string) =>
  queryOptions({
    queryKey: ['notes', studentId],
    queryFn: () => notes.listForStudent({ data: { studentId } }),
  })
// Typed mutation wrapper keeps existing form submit contracts and invalidates only affected data.
export function useAppMutation<TInput, TOutput>(
  fn: (options: { data: TInput }) => Promise<TOutput>,
  keys: Array<string>,
) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (data: TInput) => fn({ data }),
    onSuccess: async () => {
      const affectsDashboard = keys.some((key) =>
        ['grades', 'reviews', 'students', 'users'].includes(key),
      )
      const affectedKeys = affectsDashboard
        ? [...keys, 'teacher-dashboard']
        : keys
      await Promise.all(
        affectedKeys.map((key) =>
          client.invalidateQueries({ queryKey: [key] }),
        ),
      )
    },
  }).mutateAsync
}
