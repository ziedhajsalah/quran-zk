import { withDatabase } from '../src/server/db.server'
import { createAccount } from '../src/server/services/accounts.server'
import { accountInput } from '../src/server/accounts'
import { collectAdminSetup, parseDatabaseTarget } from './lib/admin-setup'
import { AdminSetupError, adminSetupErrorMessage } from './lib/admin-errors'
import { withTerminal } from './lib/terminal'

async function main() {
  const args = process.argv.slice(2)
  if (args.includes('--help')) {
    console.log(
      'npm run bootstrap:admin — interactive first-admin setup\nFor automation: npm run bootstrap:admin -- --non-interactive\nRequires DATABASE_URL, ADMIN_USERNAME, ADMIN_NAME, ADMIN_PASSWORD; ADMIN_EMAIL is optional.\nNo production configuration files are loaded automatically.',
    )
    return
  }
  if (args.some((arg) => arg !== '--non-interactive'))
    throw new AdminSetupError('Unknown option. Use --help for usage.')
  console.log(
    'First-admin setup (the app has no separate super-admin role).\nCreates a permanent admin and password credential in PostgreSQL in one transaction.\nRequires migrated tables and an empty user table. It does not migrate, seed, or save passwords to files.\nPress Ctrl+C to cancel.\n',
  )
  let setup
  if (args.includes('--non-interactive')) {
    const {
      DATABASE_URL,
      ADMIN_USERNAME,
      ADMIN_PASSWORD,
      ADMIN_NAME,
      ADMIN_EMAIL,
    } = process.env
    if (!DATABASE_URL || !ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_NAME) {
      const required = {
        DATABASE_URL,
        ADMIN_USERNAME,
        ADMIN_PASSWORD,
        ADMIN_NAME,
      }
      const missing = Object.keys(required).filter(
        (key) => !required[key as keyof typeof required],
      )
      throw new AdminSetupError(
        `Missing environment variables: ${missing.join(', ')}. Export them before running --non-interactive, or run without that flag to use the wizard.`,
      )
    }
    setup = {
      connectionString: DATABASE_URL,
      account: {
        username: ADMIN_USERNAME,
        password: ADMIN_PASSWORD,
        displayName: ADMIN_NAME,
        email: ADMIN_EMAIL ?? null,
      },
    }
  } else setup = await withTerminal(collectAdminSetup)
  if (!setup) {
    console.log('Cancelled. No database connection was opened.')
    return
  }
  const account = accountInput.parse(setup.account)
  parseDatabaseTarget(setup.connectionString)
  const result = await withDatabase(setup.connectionString, (db) =>
    createAccount(db, account, ['admin'], true),
  )
  console.log(
    `Created admin ${result.username}. You can now sign in to the selected environment.`,
  )
}

main().catch((error: unknown) => {
  if (error instanceof Error && error.name === 'AbortError') {
    console.error('Cancelled.')
    process.exitCode = 130
  } else {
    console.error(adminSetupErrorMessage(error))
    process.exitCode = 1
  }
})
