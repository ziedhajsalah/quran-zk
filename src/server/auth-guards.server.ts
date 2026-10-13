import { eq } from 'drizzle-orm'
import { user } from './db/schema/auth'
import { roles, serializeUser } from './accounts'
import { fail } from './errors'
import type { createAuth } from './auth.server'
import type { Database } from './db.server'

export type Actor = ReturnType<typeof serializeUser>
export async function getActor(
  db: Database,
  auth: ReturnType<typeof createAuth>,
  headers: Headers,
) {
  const session = await auth.api.getSession({ headers })
  if (!session) return null
  // Re-read status/roles even if a session adapter changes caching behavior later.
  const row = (
    await db.select().from(user).where(eq(user.id, session.user.id))
  ).at(0)
  return row && !row.banned && roles(row.role).length
    ? serializeUser(row)
    : null
}
export function requireActor(actor: Actor | null): Actor {
  return actor ?? fail('يلزم تسجيل الدخول.')
}
export function requireStaff(actor: Actor | null) {
  const value = requireActor(actor)
  if (!value.isAdmin && !value.isTeacher) fail('غير مصرح لك بهذه العملية.')
  return value
}
export function requireAdmin(actor: Actor | null) {
  const value = requireActor(actor)
  if (!value.isAdmin) fail('غير مصرح لك بهذه العملية.')
  return value
}
export function requireSelfOrStaff(actor: Actor | null, studentId: string) {
  const value = requireActor(actor)
  if (value.id !== studentId) requireStaff(actor)
  return value
}
export async function requireStudent(
  db: Pick<Database, 'select'>,
  studentId: string,
  lock = false,
) {
  const query = db.select().from(user).where(eq(user.id, studentId))
  const row = (await (lock ? query.for('update') : query)).at(0)
  if (!row || row.banned || !roles(row.role).includes('student'))
    fail('لم يتم العثور على طالب نشط.')
  return row
}
