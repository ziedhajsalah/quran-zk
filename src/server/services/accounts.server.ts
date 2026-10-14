import { and, eq, sql } from 'drizzle-orm'
import { hashPassword } from '../password.server'
import { account, session, user } from '../db/schema/auth'
import { accountInput, roles, serializeUser } from '../accounts'
import { requireAdmin, requireStaff } from '../auth-guards.server'
import { fail } from '../errors'
import type { z } from 'zod'
import type { AppRole } from '../accounts'
import type { Database } from '../db.server'
import type { Actor } from '../auth-guards.server'

export type CreateAccount = z.input<typeof accountInput>
const ADMIN_LOCK = 7468201
// One transaction creates user + credential; uses Better Auth's pinned hash contract.
export async function createAccount(
  db: Database,
  input: CreateAccount,
  appRoles: Array<AppRole>,
  bootstrap = false,
) {
  const normalized = accountInput.parse(input)
  const password = await hashPassword(normalized.password)
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_LOCK})`)
    if (
      bootstrap &&
      (await tx.select({ id: user.id }).from(user).limit(1)).length
    )
      fail('Bootstrap is only available before any user exists.')
    const id = crypto.randomUUID()
    const [created] = await tx
      .insert(user)
      .values({
        id,
        username: normalized.username,
        displayUsername: normalized.username,
        name: normalized.displayName,
        email: normalized.email ?? `${normalized.username}@auth.local.invalid`,
        role: [...new Set(appRoles)].sort().join(','),
      })
      .returning()
    await tx.insert(account).values({
      id: crypto.randomUUID(),
      accountId: id,
      providerId: 'credential',
      userId: id,
      password,
    })
    return serializeUser(created)
  })
}
export async function staffCreateStudent(
  db: Database,
  actor: Actor | null,
  input: CreateAccount,
) {
  requireStaff(actor)
  return createAccount(db, input, ['student'])
}
export async function adminCreate(
  db: Database,
  actor: Actor | null,
  input: CreateAccount & { roles: Array<AppRole> },
) {
  requireAdmin(actor)
  return createAccount(db, input, input.roles)
}
export async function adminList(db: Database, actor: Actor | null) {
  requireAdmin(actor)
  return (await db.select().from(user)).map(serializeUser)
}
export async function updateAccount(
  db: Database,
  actor: Actor | null,
  input: {
    userId: string
    username?: string
    displayName?: string
    email?: string | null
    roles?: Array<AppRole>
    status?: 'active' | 'disabled'
    remove?: boolean
  },
) {
  requireAdmin(actor)
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${ADMIN_LOCK})`)
    // Re-check the actor after lock acquisition so a concurrently demoted admin cannot act.
    const caller = (
      await tx.select().from(user).where(eq(user.id, actor!.id))
    ).at(0)
    if (!caller || caller.banned || !roles(caller.role).includes('admin'))
      fail('غير مصرح لك بهذه العملية.')
    const existing = (
      await tx
        .select()
        .from(user)
        .where(eq(user.id, input.userId))
        .for('update')
    ).at(0)
    if (!existing) fail('المستخدم غير موجود.')
    const losesAdmin =
      input.remove ||
      input.status === 'disabled' ||
      (input.roles && !input.roles.includes('admin'))
    if (
      !existing.banned &&
      roles(existing.role).includes('admin') &&
      losesAdmin
    ) {
      const admins = await tx.select().from(user).where(eq(user.banned, false))
      if (
        !admins.some(
          (row) => row.id !== existing.id && roles(row.role).includes('admin'),
        )
      )
        fail('يجب إبقاء مشرف نشط واحد على الأقل.')
    }
    if (input.remove) {
      await tx.delete(user).where(eq(user.id, existing.id))
      return null
    }
    const values: Partial<typeof user.$inferInsert> = { updatedAt: new Date() }
    if (input.username !== undefined) {
      values.username = input.username
      values.displayUsername = input.username
      if (
        input.email === undefined &&
        existing.email.endsWith('@auth.local.invalid')
      )
        values.email = `${input.username}@auth.local.invalid`
    }
    if (input.displayName !== undefined) values.name = input.displayName
    if (input.email !== undefined)
      values.email =
        input.email ||
        `${input.username ?? existing.username}@auth.local.invalid`
    if (input.roles) values.role = [...new Set(input.roles)].sort().join(',')
    if (input.status) {
      values.banned = input.status === 'disabled'
      values.banExpires = null
      values.banReason = values.banned ? 'Account disabled' : null
    }
    const [updated] = await tx
      .update(user)
      .set(values)
      .where(eq(user.id, existing.id))
      .returning()
    if (input.status === 'disabled' || input.roles)
      await tx.delete(session).where(eq(session.userId, existing.id))
    return serializeUser(updated)
  })
}
export async function setPassword(
  db: Database,
  userId: string,
  newPassword: string,
) {
  const password = await hashPassword(newPassword)
  await db.transaction(async (tx) => {
    const target = (
      await tx.select().from(user).where(eq(user.id, userId)).for('update')
    ).at(0)
    if (!target) fail('المستخدم غير موجود.')
    const updated = await tx
      .update(account)
      .set({ password, updatedAt: new Date() })
      .where(
        and(eq(account.userId, userId), eq(account.providerId, 'credential')),
      )
      .returning()
    if (!updated.length) fail('لا توجد بيانات دخول لهذا المستخدم.')
    await tx.delete(session).where(eq(session.userId, userId))
  })
  return { success: true as const }
}
