import { v } from 'convex/values'
import { query } from './_generated/server'
import { authComponent, createAuth } from './auth'
import {
  requireSelfOrStaffAuthUser,
  requireStaffAuthUser,
  serializeAuthUser,
} from './auth/helpers'
import { parseStoredRoles } from './auth/utils'

export const listForStudent = query({
  args: {
    studentId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSelfOrStaffAuthUser(ctx, args.studentId)
    return await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student', (q) => q.eq('studentId', args.studentId))
      .collect()
  },
})

export const listAllStudents = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffAuthUser(ctx)
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

    const all: Array<Awaited<ReturnType<typeof auth.api.getUser>>> = []
    let offset = 0
    let total = 0
    do {
      const result = await auth.api.listUsers({
        query: { limit: 100, offset },
        headers,
      })
      all.push(...result.users)
      total = result.total
      offset += result.users.length
    } while (offset < total)

    return all
      .filter((u) => parseStoredRoles(u.role).includes('student'))
      .filter((u) => !u.banned)
      .map(serializeAuthUser)
      .sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'ar'),
      )
  },
})
