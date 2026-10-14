import { betterAuth } from 'better-auth/minimal'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { admin } from 'better-auth/plugins/admin'
import { username } from 'better-auth/plugins/username'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { adminAc, userAc } from 'better-auth/plugins/admin/access'
import { schema } from './db.server'
import { hashPassword, verifyPassword } from './password.server'
import { consumeRateLimit, rateLimitKey } from './rate-limit.server'
import type { Database } from './db.server'

export type AuthEnvironment = { BETTER_AUTH_SECRET: string; SITE_URL: string }
export function createAuth(db: Database, config: AuthEnvironment) {
  if (!config.BETTER_AUTH_SECRET || config.BETTER_AUTH_SECRET.length < 32)
    throw new Error('BETTER_AUTH_SECRET must be at least 32 characters.')
  if (!config.SITE_URL) throw new Error('SITE_URL is required.')
  const adminPlugin = admin({
    defaultRole: 'student',
    adminRoles: ['admin'],
    roles: { admin: adminAc, teacher: userAc, student: userAc },
  })
  return betterAuth({
    secret: config.BETTER_AUTH_SECRET,
    baseURL: config.SITE_URL,
    trustedOrigins: [config.SITE_URL],
    disabledPaths: [
      ...Object.values(adminPlugin.endpoints).map((endpoint) => endpoint.path),
      '/update-user',
      '/change-email',
      '/delete-user',
      '/link-social',
      '/unlink-account',
    ],
    database: drizzleAdapter(db, { provider: 'pg', schema, transaction: true }),
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip'] } },
    rateLimit: {
      enabled: true,
      window: 60,
      max: 100,
      customRules: {
        '/sign-in/username': { window: 60, max: 30 },
        '/sign-in/email': { window: 60, max: 30 },
      },
      customStorage: {
        consume: (key, rule) =>
          consumeRateLimit(
            db,
            rateLimitKey(config.BETTER_AUTH_SECRET, 'ip', key),
            rule,
          ),
      },
    },
    emailAndPassword: {
      password: { hash: hashPassword, verify: verifyPassword },
      enabled: true,
      disableSignUp: true,
      requireEmailVerification: false,
      revokeSessionsOnPasswordReset: true,
    },
    session: { cookieCache: { enabled: false } },
    plugins: [
      username({
        minUsernameLength: 3,
        maxUsernameLength: 32,
        usernameNormalization: (value) => value.trim().toLowerCase(),
        usernameValidator: (value) =>
          /^[A-Za-z0-9._-]{3,32}$/.test(value.trim()),
      }),
      adminPlugin,
      tanstackStartCookies(),
    ],
  })
}
