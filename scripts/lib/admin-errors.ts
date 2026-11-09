import { ZodError } from 'zod'
import { AppError } from '../../src/server/errors'

/** Only messages written by this CLI may be printed verbatim. */
export class AdminSetupError extends Error {}

const messages: Record<string, string> = {
  ERR_INVALID_URL:
    'The connection URL is invalid. Provide a complete PostgreSQL connection URL with the database name; keep its credentials private.',
  ECONNREFUSED:
    'PostgreSQL refused the connection. Start the local database if using Local, and check the selected host and port.',
  ENOTFOUND:
    'The database hostname could not be found. Check the connection URL and your DNS/network connection.',
  EAI_AGAIN:
    'The database hostname lookup temporarily failed. Check your network connection and try again.',
  ETIMEDOUT:
    'The database connection timed out. Check network access, firewall rules and whether the database is available, then retry.',
  ENETUNREACH:
    'The database network is unreachable. Check your connection or VPN and try again.',
  EHOSTUNREACH:
    'The database host is unreachable. Check your network and the selected database endpoint.',
  ECONNRESET:
    'The database connection was interrupted. Check that the database is available, then retry. If the interruption happened while saving, verify whether the admin was created before trying again.',
  EPIPE:
    'The database connection closed unexpectedly. Verify whether the admin was created before trying again.',
  '28P01':
    'PostgreSQL rejected the database credentials. Check the DATABASE_URL user and password; these are separate from the new admin password.',
  '28000':
    'The database role is not allowed to connect. Check the database user and its connection permissions.',
  '3D000':
    'The database in the connection URL does not exist. Check the database name and select an existing migrated application database.',
  '42P01':
    'Required application tables are missing. Apply the reviewed migrations with npm run db:migrate and DATABASE_URL explicitly set to this same database, then retry. Do not run the seed script against hosted databases.',
  '42703':
    'The database schema is out of date. Apply the reviewed migrations with npm run db:migrate and DATABASE_URL explicitly set to this same database, then retry.',
  '42501':
    'The database role lacks the permissions needed to create an admin. Use the intended application database owner or ask its operator to check permissions.',
  '53300':
    'PostgreSQL has no connection slots available. Wait for other connections to close, then retry.',
  '57P03':
    'PostgreSQL is starting up or temporarily unavailable. Wait a moment and retry.',
  '23505':
    'An account with this username or email already exists. Sign in with the existing account or ask an admin to manage it. This command only creates the first admin.',
  EACCES:
    'The selected configuration file cannot be read. Check its file permissions, or choose Custom and enter the connection URL privately.',
  EPERM:
    'The operating system denied access. Check terminal permissions for reading the selected configuration file and connecting to PostgreSQL.',
}
const tlsCodes = new Set([
  'CERT_HAS_EXPIRED',
  'CERT_NOT_YET_VALID',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
  'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
  'ERR_TLS_CERT_ALTNAME_INVALID',
])

export function adminSetupErrorMessage(
  error: unknown,
  operation: 'create' | 'reset' = 'create',
): string {
  if (error instanceof AdminSetupError) return error.message
  if (error instanceof ZodError) {
    if (operation === 'reset')
      return 'Invalid recovery details. The new password must contain 8–128 characters; it was not saved.'
    const fields: Record<string, string> = {
      username:
        'username: use 3–32 letters, numbers, dots, underscores or hyphens',
      displayName: 'display name: use 1–200 characters',
      email: 'email: enter a valid email address or leave it empty',
      password: 'password: use 8–128 characters',
    }
    const hints = [
      ...new Set(
        error.issues
          .map((issue) => fields[String(issue.path[0])])
          .filter(Boolean),
      ),
    ]
    return `Invalid admin details. ${hints.length ? hints.join('; ') + '.' : 'Check the supplied account fields.'}`
  }
  // Drizzle wraps PostgreSQL failures in `cause`; connection failures can also
  // arrive as AggregateError. Inspect only allowlisted codes, never SQL or values.
  const pending: Array<unknown> = [error]
  const seen = new Set<unknown>()
  for (let remaining = 16; pending.length && remaining > 0; remaining--) {
    const current = pending.shift()
    if (!current || typeof current !== 'object' || seen.has(current)) continue
    seen.add(current)
    if (
      current instanceof AppError &&
      current.message === 'Bootstrap is only available before any user exists.'
    )
      return 'This database already contains users, so first-admin setup is disabled. Sign in with an existing admin, use npm run rescue:password with DATABASE_URL explicitly set to this database if you forgot the password, or select an empty application database. No new admin was created by this attempt.'
    if (operation === 'reset' && current instanceof AppError) {
      if (current.message === 'المستخدم غير موجود.')
        return 'The account no longer exists. Check the identifier and selected environment. No password was changed.'
      if (current.message === 'لا توجد بيانات دخول لهذا المستخدم.')
        return 'This account has no password credential to reset. Ask the project maintainer to check its sign-in method. No password was changed.'
    }
    const failure = current as {
      code?: unknown
      cause?: unknown
      errors?: unknown
    }
    if (typeof failure.code === 'string') {
      if (operation === 'reset') {
        if (failure.code === '42501')
          return 'The database role lacks permission to update credentials or revoke sessions. Use the intended application database role or ask its operator to check permissions.'
        if (failure.code === '28P01')
          return 'PostgreSQL rejected the database credentials. Check the DATABASE_URL user and password; these are separate from the new account password.'
        if (failure.code === '23505')
          return 'Conflicting credential records prevented password recovery. Ask the project maintainer to check this account.'
        if (['ECONNRESET', 'EPIPE'].includes(failure.code))
          return 'The database connection was interrupted. The reset outcome is uncertain: try signing in with the new password before retrying recovery.'
      }
      if (Object.hasOwn(messages, failure.code)) return messages[failure.code]
      if (tlsCodes.has(failure.code))
        return 'The database TLS certificate could not be verified. Check the connection hostname, system clock and trusted CA configuration. Keep certificate verification enabled.'
    }
    if (
      current instanceof Error &&
      [
        'timeout expired',
        'Connection terminated due to connection timeout',
      ].includes(current.message)
    )
      return messages.ETIMEDOUT
    if (failure.cause) pending.push(failure.cause)
    if (Array.isArray(failure.errors))
      pending.push(...failure.errors.slice(0, 8))
  }
  if (operation === 'reset')
    return 'Password recovery failed unexpectedly. Verify the selected database and account, then retry. Do not share passwords or the connection URL when reporting the issue.'
  return 'Admin setup failed unexpectedly. Verify the selected database and retry. If it persists, report the failing step to the project maintainer without sharing passwords or the connection URL.'
}
