import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import { query } from '../_generated/server'
import { authComponent, createAuth } from '../auth'
import { requireAdminAuthUser, requireCurrentAuthUser, serializeAuthUser } from './helpers'
import { userStatusValidator } from './validators'

function parseOffset(cursor: string | null) {
  if (!cursor) {
    return 0
  }

  const offset = Number.parseInt(cursor, 10)
  return Number.isFinite(offset) && offset >= 0 ? offset : 0
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentAuthUser(ctx)
    return serializeAuthUser(user)
  },
})

export const adminList = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    status: v.optional(userStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireAdminAuthUser(ctx)
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

    const offset = parseOffset(args.paginationOpts.cursor)
    const limit = args.paginationOpts.numItems
    const search = args.search?.trim()

    const result = await auth.api.listUsers({
      query: {
        limit,
        offset,
        ...(search
          ? {
              searchValue: search,
              searchField: search.includes('@') ? 'email' : 'name',
              searchOperator: 'contains',
            }
          : {}),
        ...(args.status
          ? {
              filterField: 'banned',
              filterOperator: 'eq',
              filterValue: args.status === 'disabled',
            }
          : {}),
      },
      headers,
    })

    const nextOffset = offset + result.users.length

    return {
      page: result.users.map(serializeAuthUser),
      isDone: nextOffset >= result.total,
      continueCursor: String(nextOffset),
    }
  },
})
