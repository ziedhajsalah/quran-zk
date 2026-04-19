import { v } from 'convex/values'
import { action, internalMutation } from '../_generated/server'
import { components, internal } from '../_generated/api'
import { authComponent, createAuth } from '../auth'
import type { ResetPasswordCapture } from '../auth'
import { requireAdminAuthUser } from './helpers'
import type { ActionCtx } from '../_generated/server'
import type { Doc } from '../_generated/dataModel'

const DEFAULT_TTL_MINUTES = 30
const DEFAULT_MAX_ATTEMPTS = 5
const GENERIC_ERROR = 'رمز غير صالح أو منتهي.'

function getTtlMs() {
  const raw = process.env.PASSWORD_RESET_CODE_TTL_MINUTES
  const parsed = raw ? Number.parseInt(raw, 10) : NaN
  const minutes = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL_MINUTES
  return minutes * 60 * 1000
}

function getMaxAttempts() {
  const raw = process.env.PASSWORD_RESET_MAX_ATTEMPTS
  const parsed = raw ? Number.parseInt(raw, 10) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_MAX_ATTEMPTS
}

function generateCode() {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  const value = buf[0] % 1_000_000
  return value.toString().padStart(6, '0')
}

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function normalizeCode(input: string) {
  const stripped = input.replace(/[\s-]/g, '')
  if (!/^\d{6}$/.test(stripped)) {
    return null
  }
  return stripped
}

const USERNAME_SHAPE = /^[A-Za-z0-9._-]{3,32}$/

function normalizeIdentifier(input: string) {
  const trimmed = input.trim()
  if (!trimmed) {
    return null
  }
  if (trimmed.includes('@')) {
    return { kind: 'email' as const, value: trimmed.toLowerCase() }
  }
  const lowered = trimmed.toLowerCase()
  if (!USERNAME_SHAPE.test(lowered)) {
    return null
  }
  return { kind: 'username' as const, value: lowered }
}

type BetterAuthUserRow = {
  _id: string
  id?: string | null
  email: string
  username?: string | null
  banned?: boolean | null
}

async function resolveUserByIdentifier(
  ctx: ActionCtx,
  identifier: string,
): Promise<BetterAuthUserRow | null> {
  const normalized = normalizeIdentifier(identifier)
  if (!normalized) {
    return null
  }
  const row = (await ctx.runQuery(components.betterAuth.adapter.findOne, {
    model: 'user',
    where: [{ field: normalized.kind, value: normalized.value }],
  })) as BetterAuthUserRow | null
  return row ?? null
}

async function captureResetToken(
  ctx: ActionCtx,
  email: string,
): Promise<ResetPasswordCapture | null> {
  let captured: ResetPasswordCapture | undefined
  const auth = createAuth(ctx, {
    onResetPasswordSent: (capture) => {
      captured = capture
    },
  })
  await auth.api.requestPasswordReset({
    body: { email },
    headers: new Headers(),
  })
  return captured ?? null
}

export const adminIssue = action({
  args: {
    identifier: v.string(),
  },
  handler: async (ctx, args): Promise<{ code: string; expiresAt: number }> => {
    const admin = await requireAdminAuthUser(ctx)

    const user = await resolveUserByIdentifier(ctx, args.identifier)
    if (!user) {
      throw new Error('لم يتم العثور على هذا المستخدم.')
    }

    const capture = await captureResetToken(ctx, user.email)
    if (!capture) {
      throw new Error('تعذر إصدار رمز إعادة التعيين.')
    }

    const code = generateCode()
    const codeHash = await sha256Hex(code)
    const expiresAt = Date.now() + getTtlMs()
    const adminId = String(admin._id)

    await ctx.runMutation(internal.auth.resetCodes.storeIssuedCode, {
      userId: capture.userId,
      codeHash,
      betterAuthToken: capture.token,
      expiresAt,
      issuedByAdminId: adminId,
    })

    return { code, expiresAt }
  },
})

export const redeem = action({
  args: {
    identifier: v.string(),
    code: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: true }> => {
    if (typeof args.newPassword !== 'string' || args.newPassword.length < 8) {
      throw new Error('كلمة المرور يجب ألا تقل عن 8 أحرف.')
    }

    const normalizedCode = normalizeCode(args.code)
    const user = await resolveUserByIdentifier(ctx, args.identifier)

    if (!normalizedCode || !user) {
      throw new Error(GENERIC_ERROR)
    }

    const codeHash = await sha256Hex(normalizedCode)
    const result = await ctx.runMutation(
      internal.auth.resetCodes.validateAndClaimCode,
      {
        codeHash,
        userId: user._id,
        maxAttempts: getMaxAttempts(),
      },
    )

    if (!result.ok) {
      throw new Error(GENERIC_ERROR)
    }

    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)
    await auth.api.resetPassword({
      body: {
        token: result.betterAuthToken,
        newPassword: args.newPassword,
      },
      headers: new Headers(),
    })

    await auth.api.revokeUserSessions({
      body: { userId: user._id },
      headers,
    })

    return { success: true }
  },
})

export const storeIssuedCode = internalMutation({
  args: {
    userId: v.string(),
    codeHash: v.string(),
    betterAuthToken: v.string(),
    expiresAt: v.number(),
    issuedByAdminId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now()
    const existing = await ctx.db
      .query('passwordResetCodes')
      .withIndex('by_user', (q) => q.eq('userId', args.userId))
      .collect()
    for (const row of existing) {
      if (row.usedAt === null) {
        await ctx.db.patch(row._id, { usedAt: now })
      }
    }
    await ctx.db.insert('passwordResetCodes', {
      userId: args.userId,
      codeHash: args.codeHash,
      betterAuthToken: args.betterAuthToken,
      expiresAt: args.expiresAt,
      usedAt: null,
      attempts: 0,
      issuedByAdminId: args.issuedByAdminId,
    })
  },
})

type ValidateResult =
  | { ok: true; betterAuthToken: string }
  | { ok: false }

export const validateAndClaimCode = internalMutation({
  args: {
    codeHash: v.string(),
    userId: v.string(),
    maxAttempts: v.number(),
  },
  handler: async (ctx, args): Promise<ValidateResult> => {
    const now = Date.now()
    const row: Doc<'passwordResetCodes'> | null = await ctx.db
      .query('passwordResetCodes')
      .withIndex('by_code_hash', (q) => q.eq('codeHash', args.codeHash))
      .unique()

    if (!row) {
      return { ok: false }
    }

    if (
      row.userId !== args.userId ||
      row.usedAt !== null ||
      row.expiresAt < now ||
      row.attempts >= args.maxAttempts
    ) {
      await ctx.db.patch(row._id, { attempts: row.attempts + 1 })
      return { ok: false }
    }

    await ctx.db.patch(row._id, {
      usedAt: now,
      attempts: row.attempts + 1,
    })
    return { ok: true, betterAuthToken: row.betterAuthToken }
  },
})

