import { convexQuery } from '@convex-dev/react-query'
import { api } from '../../convex/_generated/api'

export const currentUserQuery = convexQuery(api.auth.users.current, {})
