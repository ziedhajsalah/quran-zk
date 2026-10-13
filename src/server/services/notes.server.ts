import { and, desc, eq } from 'drizzle-orm'
import { notes } from '../db/schema/app'
import { user } from '../db/schema/auth'
import {
  requireSelfOrStaff,
  requireStaff,
  requireStudent,
} from '../auth-guards.server'
import { fail } from '../errors'
import type { Database } from '../db.server'
import type { Actor } from '../auth-guards.server'

export async function listNotes(
  db: Database,
  actor: Actor | null,
  studentId: string,
) {
  requireSelfOrStaff(actor, studentId)
  const rows = await db
    .select({ note: notes, authorName: user.name })
    .from(notes)
    .leftJoin(user, eq(user.id, notes.authorId))
    .where(eq(notes.studentId, studentId))
    .orderBy(desc(notes.createdAt), desc(notes.id))
    .limit(100)
  return rows.map(({ note, authorName }) => ({
    ...note,
    _id: note.id,
    authorId: note.authorId ?? '',
    authorDisplayName: authorName ?? 'مستخدم محذوف',
    createdAt: note.createdAt.getTime(),
    editedAt: note.editedAt?.getTime() ?? null,
  }))
}
function noteBody(body: string) {
  const value = body.trim()
  if (!value || value.length > 2000)
    fail('الملاحظة يجب أن تكون بين 1 و2000 حرف.')
  return value
}
export async function addNote(
  db: Database,
  actor: Actor | null,
  input: { studentId: string; body: string },
) {
  const staff = requireStaff(actor)
  await requireStudent(db, input.studentId)
  await db.insert(notes).values({
    id: crypto.randomUUID(),
    studentId: input.studentId,
    body: noteBody(input.body),
    authorId: staff.id,
    createdAt: new Date(),
  })
}
export async function editNote(
  db: Database,
  actor: Actor | null,
  input: { noteId: string; body: string },
) {
  const staff = requireStaff(actor)
  const rows = await db
    .update(notes)
    .set({ body: noteBody(input.body), editedAt: new Date() })
    .where(and(eq(notes.id, input.noteId), eq(notes.authorId, staff.id)))
    .returning()
  if (!rows.length) fail('يمكنك تعديل ملاحظاتك فقط.')
}
export async function removeNote(
  db: Database,
  actor: Actor | null,
  input: { noteId: string },
) {
  const staff = requireStaff(actor)
  const rows = await db
    .delete(notes)
    .where(and(eq(notes.id, input.noteId), eq(notes.authorId, staff.id)))
    .returning()
  if (!rows.length) fail('يمكنك حذف ملاحظاتك فقط.')
}
