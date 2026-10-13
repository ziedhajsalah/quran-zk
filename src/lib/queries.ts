import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import * as grades from '~/server/functions/grades'
import * as reviews from '~/server/functions/reviews'
import * as notes from '~/server/functions/notes'

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
      await Promise.all(
        keys.map((key) => client.invalidateQueries({ queryKey: [key] })),
      )
    },
  }).mutateAsync
}
