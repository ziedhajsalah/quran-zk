import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { authComponent, createAuth } from './auth'
import { requireStaffAuthUser } from './auth/helpers'

const MAX_BODY_LENGTH = 2000

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

export const add = mutation({
  args: {
    studentId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    const trimmed = args.body.trim()
    if (trimmed.length === 0) {
      throw new ConvexError('Note body cannot be empty.')
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      throw new ConvexError('Note body is too long.')
    }
    const now = Date.now()
    await ctx.db.insert('studentNotes', {
      studentId: args.studentId,
      authorId: String(staff._id),
      body: trimmed,
      createdAt: now,
      editedAt: null,
    })
  },
})
