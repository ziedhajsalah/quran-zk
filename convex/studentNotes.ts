import { v } from 'convex/values'
import { query } from './_generated/server'
import { authComponent, createAuth } from './auth'
import { requireStaffAuthUser } from './auth/helpers'

type AuthApi = Awaited<
  ReturnType<typeof authComponent.getAuth<typeof createAuth>>
>['auth']
type AuthHeaders = Awaited<
  ReturnType<typeof authComponent.getAuth<typeof createAuth>>
>['headers']

async function resolveAuthorDisplayName(
  auth: AuthApi,
  headers: AuthHeaders,
  authorId: string,
): Promise<string> {
  try {
    const user = await auth.api.getUser({ query: { id: authorId }, headers })
    return user?.name ?? 'مستخدم محذوف'
  } catch {
    return 'مستخدم محذوف'
  }
}

export const listForStudent = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    await requireStaffAuthUser(ctx)
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)
    const rows = await ctx.db
      .query('studentNotes')
      .withIndex('by_student_created', (q) =>
        q.eq('studentId', args.studentId),
      )
      .collect()
    const sorted = [...rows].sort((a, b) => b.createdAt - a.createdAt)
    return Promise.all(
      sorted.map(async (n) => ({
        ...n,
        authorDisplayName: await resolveAuthorDisplayName(
          auth,
          headers,
          n.authorId,
        ),
      })),
    )
  },
})
