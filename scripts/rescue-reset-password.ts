import { eq } from 'drizzle-orm'
import { withDatabase } from '../src/server/db.server'
import { user } from '../src/server/db/schema/auth'
import { setPassword } from '../src/server/services/accounts.server'
import { passwordSchema } from '../src/server/accounts'
import { AdminSetupError, adminSetupErrorMessage } from './lib/admin-errors'
import { parseDatabaseTarget } from './lib/admin-setup'
import {
  collectPasswordReset,
  parseResetIdentifier,
} from './lib/password-reset-setup'
import { withTerminal } from './lib/terminal'

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log(
      'npm run rescue:password — interactive password recovery\nFor automation: npm run rescue:password -- --non-interactive\nRequires DATABASE_URL, RESET_IDENTIFIER (username or email), RESET_PASSWORD.\nNo production configuration files are loaded automatically.',
    )
    return
  }
  if (args.some((arg) => arg !== '--non-interactive'))
    throw new AdminSetupError('Unknown option. Use --help for usage.')
  console.log(
    'Password recovery\nUpdates an existing account password and revokes all its sessions in one transaction.\nDoes not create accounts, grant admin access, or change account status.\nPassword and connection URL input are hidden and are not saved to files. Press Ctrl+C to cancel.\n',
  )
  let setup
  if (args.includes('--non-interactive')) {
    const { DATABASE_URL, RESET_IDENTIFIER, RESET_PASSWORD } = process.env
    if (!DATABASE_URL || !RESET_IDENTIFIER || !RESET_PASSWORD) {
      const required = { DATABASE_URL, RESET_IDENTIFIER, RESET_PASSWORD }
      const missing = Object.keys(required).filter(
        (key) => !required[key as keyof typeof required],
      )
      throw new AdminSetupError(
        `Missing environment variables: ${missing.join(', ')}. Export them before running --non-interactive, or run without that flag to use the wizard.`,
      )
    }
    setup = {
      connectionString: DATABASE_URL,
      identifier: parseResetIdentifier(RESET_IDENTIFIER),
      password: RESET_PASSWORD,
    }
  } else setup = await withTerminal(collectPasswordReset)
  if (!setup) {
    console.log('Cancelled. No database connection was opened.')
    return
  }
  const password = passwordSchema.parse(setup.password)
  const identifier = parseResetIdentifier(setup.identifier)
  parseDatabaseTarget(setup.connectionString)
  await withDatabase(setup.connectionString, async (db) => {
    const target = (
      await db
        .select({ id: user.id })
        .from(user)
        .where(
          identifier.includes('@')
            ? eq(user.email, identifier)
            : eq(user.username, identifier),
        )
    ).at(0)
    if (!target)
      throw new AdminSetupError(
        'No account matches that username or email in the selected database. Check the identifier and environment, then retry. No password was changed.',
      )
    await setPassword(db, target.id, password)
  })
  console.log(
    'Password updated and all existing sessions revoked. Sign in to the selected environment with the new password.',
  )
}

main().catch((error: unknown) => {
  if (error instanceof Error && error.name === 'AbortError') {
    console.error('Cancelled.')
    process.exitCode = 130
  } else {
    console.error(adminSetupErrorMessage(error, 'reset'))
    process.exitCode = 1
  }
})
