import { queryOptions } from '@tanstack/react-query'
import { currentUser } from '~/server/functions/session'

export const currentUserQuery = queryOptions({
  queryKey: ['session'],
  queryFn: () => currentUser(),
  staleTime: 0,
})
