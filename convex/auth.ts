import { createClient } from '@convex-dev/better-auth'
import { convex } from '@convex-dev/better-auth/plugins'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'
import { admin } from 'better-auth/plugins/admin'
import { username } from 'better-auth/plugins/username'
import { betterAuth } from 'better-auth/minimal'
import authSchema from './betterAuth/schema'
import authConfig from './auth.config'
import { components } from './_generated/api'
import type { BetterAuthOptions } from 'better-auth/minimal'
import type { GenericCtx } from '@convex-dev/better-auth'
import type { DataModel } from './_generated/dataModel'

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/

export const authRoles = {
  admin: adminAc,
  teacher: userAc,
  student: userAc,
} as const

function isGenerateOnlyContext(ctx: unknown) {
  return (
    typeof ctx === 'object' &&
    ctx !== null &&
    !('auth' in ctx) &&
    !('runQuery' in ctx) &&
    !('runMutation' in ctx)
  )
}

function getSiteUrl(ctx?: unknown) {
  const siteUrl = process.env.SITE_URL ?? process.env.VITE_SITE_URL
  if (siteUrl) {
    return siteUrl
  }
  if (isGenerateOnlyContext(ctx)) {
    return 'http://localhost:3000'
  }
  throw new Error('Missing SITE_URL environment variable.')
}

function getAuthSecret(ctx?: unknown) {
  const secret = process.env.BETTER_AUTH_SECRET
  if (secret) {
    return secret
  }
  if (isGenerateOnlyContext(ctx)) {
    return 'better-auth-schema-generation-secret-32'
  }
  throw new Error('Missing BETTER_AUTH_SECRET environment variable.')
}

export const authComponent = createClient<DataModel, typeof authSchema>(
  components.betterAuth,
  {
    local: {
      schema: authSchema,
    },
  },
)

export type ResetPasswordCapture = {
  userId: string
  token: string
}

export type CreateAuthOptions = {
  disableSignUp?: boolean
  onResetPasswordSent?: (capture: ResetPasswordCapture) => void
}

export function createAuthOptions(
  ctx: GenericCtx<DataModel>,
  options?: CreateAuthOptions,
) {
  const siteUrl = getSiteUrl(ctx)

  return {
    secret: getAuthSecret(ctx),
    baseURL: siteUrl,
    trustedOrigins: [siteUrl],
    database: authComponent.adapter(ctx),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      disableSignUp: options?.disableSignUp ?? true,
      resetPasswordTokenExpiresIn: 60 * 60,
      sendResetPassword: ({ user, token }) => {
        options?.onResetPasswordSent?.({
          userId: user.id,
          token,
        })
        return Promise.resolve()
      },
    },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 32,
        usernameNormalization: (value) => value.trim().toLowerCase(),
        usernameValidator: (value) => USERNAME_PATTERN.test(value.trim()),
      }),
      admin({
        defaultRole: 'student',
        adminRoles: ['admin'],
        roles: authRoles,
      }),
      convex({
        authConfig,
      }),
    ],
  } satisfies BetterAuthOptions
}

export function createAuth(
  ctx: GenericCtx<DataModel>,
  options?: CreateAuthOptions,
) {
  return betterAuth(createAuthOptions(ctx, options))
}
