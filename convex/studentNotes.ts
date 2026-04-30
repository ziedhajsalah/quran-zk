import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import { authComponent } from './auth'
import { requireSelfOrStaffAuthUser, requireStaffAuthUser } from './auth/helpers'
import type { MutationCtx, QueryCtx } from './_generated/server'

// Keep in sync with the client-side counter in AddNoteDrawer.tsx.
const MAX_BODY_LENGTH = 2000
const MAX_NOTES_PER_STUDENT = 100
const DELETED_USER_NAME = 'مستخدم محذوف'

async function resolveAuthorDisplayName(
  ctx: QueryCtx | MutationCtx,
  authorId: string,
): Promise<string> {
  const user = await authComponent.getAnyUserById(ctx, authorId)
  return user?.name ?? DELETED_USER_NAME
}

export const listForStudent = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    await requireSelfOrStaffAuthUser(ctx, args.studentId)
    const rows = await ctx.db
      .query('studentNotes')
      .withIndex('by_student_created', (q) =>
        q.eq('studentId', args.studentId),
      )
      .order('desc')
      .take(MAX_NOTES_PER_STUDENT)

    // Resolve unique author ids once so a student with N notes from M
    // distinct teachers issues M lookups, not N.
    const uniqueAuthorIds = [...new Set(rows.map((r) => r.authorId))]
    const nameByAuthor = new Map<string, string>()
    await Promise.all(
      uniqueAuthorIds.map(async (id) => {
        nameByAuthor.set(id, await resolveAuthorDisplayName(ctx, id))
      }),
    )

    return rows.map((n) => ({
      ...n,
      authorDisplayName: nameByAuthor.get(n.authorId) ?? DELETED_USER_NAME,
    }))
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

export const edit = mutation({
  args: {
    noteId: v.id('studentNotes'),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    const note = await ctx.db.get('studentNotes', args.noteId)
    if (!note) {
      throw new ConvexError('Note not found.')
    }
    if (note.authorId !== String(staff._id)) {
      throw new ConvexError('You can only edit your own notes.')
    }
    const trimmed = args.body.trim()
    if (trimmed.length === 0) {
      throw new ConvexError('Note body cannot be empty.')
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      throw new ConvexError('Note body is too long.')
    }
    await ctx.db.patch('studentNotes', args.noteId, {
      body: trimmed,
      editedAt: Date.now(),
    })
  },
})

export const remove = mutation({
  args: { noteId: v.id('studentNotes') },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    const note = await ctx.db.get('studentNotes', args.noteId)
    if (!note) {
      throw new ConvexError('Note not found.')
    }
    if (note.authorId !== String(staff._id)) {
      throw new ConvexError('You can only delete your own notes.')
    }
    await ctx.db.delete('studentNotes', args.noteId)
  },
})
