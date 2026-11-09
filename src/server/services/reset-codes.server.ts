import { createHmac, randomInt, timingSafeEqual } from 'node:crypto'
import { and, eq, isNull, sql } from 'drizzle-orm'
import { hashPassword } from '../password.server'
import { resetCodes } from '../db/schema/app'
import { account, session, user } from '../db/schema/auth'
import { requireAdmin } from '../auth-guards.server'
import { fail } from '../errors'
import type { Database } from '../db.server'
import type { Actor } from '../auth-guards.server'

const INVALID = 'رمز غير صالح أو منتهي.'
function digest(secret: string, userId: string, code: string) {
  return createHmac('sha256', secret).update(`${userId}:${code}`).digest('hex')
}
async function findUser(db: Database, identifier: string) {
  const value = identifier.trim().toLowerCase()
  const row = (
    await db
      .select()
      .from(user)
      .where(
        value.includes('@') ? eq(user.email, value) : eq(user.username, value),
      )
  ).at(0)
  return row
}
export async function issueCode(
  db: Database,
  actor: Actor | null,
  secret: string,
  identifier: string,
) {
  const admin = requireAdmin(actor)
  const target = await findUser(db, identifier)
  if (!target || target.banned) fail('لم يتم العثور على مستخدم نشط.')
  const code = randomInt(0, 1_000_000).toString().padStart(6, '0')
  const expiresAt = new Date(Date.now() + 30 * 60_000)
  await db.transaction(async (tx) => {
    const current = (
      await tx.select().from(user).where(eq(user.id, target.id)).for('update')
    ).at(0)
    if (!current || current.banned) fail(INVALID)
    await tx
      .update(resetCodes)
      .set({ usedAt: new Date() })
      .where(and(eq(resetCodes.userId, target.id), isNull(resetCodes.usedAt)))
    await tx.insert(resetCodes).values({
      id: crypto.randomUUID(),
      userId: target.id,
      codeHash: digest(secret, target.id, code),
      expiresAt,
      issuedByAdminId: admin.id,
    })
  })
  return { code, expiresAt: expiresAt.getTime() }
}
export async function redeemCode(
  db: Database,
  secret: string,
  input: { identifier: string; code: string; newPassword: string },
) {
  const target = await findUser(db, input.identifier)
  if (!target || target.banned) fail(INVALID)
  const code = input.code.replace(/[\s-]/g, '')
  const codeHash = digest(secret, target.id, code)
  // Failed attempts commit before an error is thrown. A correct candidate is re-checked under lock after hashing.
  const candidate = await db.transaction(async (tx) => {
    const current = (
      await tx.select().from(user).where(eq(user.id, target.id)).for('update')
    ).at(0)
    if (!current || current.banned) fail(INVALID)
    const row = (
      await tx
        .select()
        .from(resetCodes)
        .where(and(eq(resetCodes.userId, target.id), isNull(resetCodes.usedAt)))
        .for('update')
    ).at(0)
    if (!row || row.expiresAt <= new Date() || row.attempts >= 5) return null
    if (
      !/^\d{6}$/.test(code) ||
      !timingSafeEqual(
        Buffer.from(row.codeHash, 'hex'),
        Buffer.from(codeHash, 'hex'),
      )
    ) {
      await tx
        .update(resetCodes)
        .set({
          attempts: sql`${resetCodes.attempts} + 1`,
          usedAt: row.attempts === 4 ? new Date() : null,
        })
        .where(eq(resetCodes.id, row.id))
      return null
    }
    return row.id
  })
  if (!candidate) fail(INVALID)
  const password = await hashPassword(input.newPassword)
  const ok = await db.transaction(async (tx) => {
    const current = (
      await tx.select().from(user).where(eq(user.id, target.id)).for('update')
    ).at(0)
    const row = (
      await tx
        .select()
        .from(resetCodes)
        .where(eq(resetCodes.id, candidate))
        .for('update')
    ).at(0)
    if (
      !current ||
      current.banned ||
      !row ||
      row.usedAt ||
      row.attempts >= 5 ||
      row.expiresAt <= new Date()
    )
      return false
    const updated = await tx
      .update(account)
      .set({ password, updatedAt: new Date() })
      .where(
        and(
          eq(account.userId, target.id),
          eq(account.providerId, 'credential'),
        ),
      )
      .returning()
    if (!updated.length) fail(INVALID)
    await tx
      .update(resetCodes)
      .set({ usedAt: new Date() })
      .where(eq(resetCodes.id, row.id))
    await tx.delete(session).where(eq(session.userId, target.id))
    return true
  })
  if (!ok) fail(INVALID)
  return { success: true as const }
}
