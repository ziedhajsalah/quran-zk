import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { parseEnv } from 'node:util'
import { withDatabase } from '../src/server/db.server'
import { createAccount } from '../src/server/services/accounts.server'
import { accountInput } from '../src/server/accounts'
import { collectAdminSetup, parseDatabaseTarget } from './lib/admin-setup'
import { AdminSetupError, adminSetupErrorMessage } from './lib/admin-errors'

async function interactiveSetup() {
  if (!process.stdin.isTTY || !process.stdout.isTTY)
    throw new AdminSetupError(
      'Use an interactive terminal, or pass --non-interactive with the required environment variables.',
    )
  let hidden = false
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!hidden) process.stdout.write(chunk)
      callback()
    },
  })
  const input = createInterface({
    input: process.stdin,
    output,
    terminal: true,
  })
  const controller = new AbortController()
  input.on('SIGINT', () => {
    controller.abort()
    input.close()
  })
  input.on('close', () => controller.abort())
  try {
    return await collectAdminSetup({
      databaseUrl: process.env.DATABASE_URL,
      write: (message) => console.log(message),
      readDatabaseUrl: async (file) => {
        try {
          return parseEnv(await readFile(file, 'utf8')).DATABASE_URL
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code === 'ENOENT')
            return undefined
          throw error
        }
      },
      ask: async (message, secret = false) => {
        if (secret) {
          process.stdout.write(message)
          hidden = true
        }
        try {
          return await input.question(secret ? '' : message, {
            signal: controller.signal,
          })
        } finally {
          hidden = false
          if (secret) process.stdout.write('\n')
        }
      },
    })
  } finally {
    input.close()
    output.end()
  }
}

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
  } else setup = await interactiveSetup()
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
