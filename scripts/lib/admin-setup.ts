import {
  accountInput,
  passwordSchema,
  usernameSchema,
} from '../../src/server/accounts'
import { AdminSetupError } from './admin-errors'

export type Ask = (message: string, secret?: boolean) => Promise<string>
type Options = {
  ask: Ask
  write: (message: string) => void
  readDatabaseUrl: (file: string) => Promise<string | undefined>
  databaseUrl?: string
}

export function parseDatabaseTarget(connectionString: string) {
  let target: URL
  try {
    target = new URL(connectionString.trim())
  } catch {
    throw new AdminSetupError(
      'The connection URL is not valid. Enter a complete postgresql://user:password@host:port/database URL; input stays hidden.',
    )
  }
  if (
    !['postgres:', 'postgresql:'].includes(target.protocol) ||
    !target.hostname ||
    target.pathname.length < 2
  )
    throw new AdminSetupError(
      'A PostgreSQL connection URL with a database name is required.',
    )
  return target
}

export async function collectAdminSetup({
  ask,
  write,
  readDatabaseUrl,
  databaseUrl,
}: Options) {
  const selection =
    (
      await ask(
        'Environment: 1) Local  2) Hosted development  3) Production  4) Custom [1]: ',
      )
    ).trim() || '1'
  const environment = {
    '1': 'local',
    '2': 'development',
    '3': 'production',
    '4': 'custom',
  }[selection]
  if (!environment)
    throw new AdminSetupError('Choose an environment from 1 to 4.')

  const file =
    environment === 'local'
      ? '.env.local'
      : environment === 'development'
        ? '.env.neon-development.local'
        : undefined
  let connectionString = file
    ? await readDatabaseUrl(file)
    : environment === 'custom'
      ? databaseUrl
      : undefined
  if (connectionString)
    write(`Using DATABASE_URL from ${file ?? 'the current process'}.`)
  else
    connectionString = await ask(
      'PostgreSQL connection URL (input hidden): ',
      true,
    )
  const target = parseDatabaseTarget(connectionString)
  if (
    environment === 'local' &&
    !['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)
  )
    throw new AdminSetupError(
      'The local configuration points to a remote host. Choose the appropriate hosted environment instead.',
    )
  // Do not show the user, password or query parameters from a connection URL.
  write(`Selected ${environment}: ${target.host}${target.pathname}`)

  async function field(
    message: string,
    validate: (value: string) => string | null,
  ) {
    for (;;) {
      const value = (await ask(message)).trim()
      const problem = validate(value)
      if (!problem) return value
      write(problem)
    }
  }
  const username = await field('Admin username: ', (value) =>
    usernameSchema.safeParse(value).success
      ? null
      : 'Use 3–32 letters, numbers, dots, underscores or hyphens.',
  )
  const displayName = await field('Display name: ', (value) =>
    accountInput.shape.displayName.safeParse(value).success
      ? null
      : 'Enter a display name of 1–200 characters.',
  )
  const email = await field('Email (optional; Enter to skip): ', (value) =>
    accountInput.shape.email.safeParse(value).success
      ? null
      : 'Enter a valid email address or leave it empty.',
  )
  let password: string
  for (;;) {
    password = await ask('Password (8–128 characters; input hidden): ', true)
    if (!passwordSchema.safeParse(password).success) {
      write('The password must contain 8–128 characters.')
      continue
    }
    if (password === (await ask('Confirm password (input hidden): ', true)))
      break
    write('Passwords do not match. Try again.')
  }
  const account = accountInput.parse({ username, displayName, email, password })
  write(
    `Create the first admin "${account.username}" (${account.displayName}) in ${environment}?`,
  )
  write(
    'This grants full admin access. It will refuse to create an account if any user already exists.',
  )
  if (
    (
      await ask(
        `Type "create ${environment}" to continue, or Enter to cancel: `,
      )
    ).trim() !== `create ${environment}`
  )
    return null
  return { connectionString: connectionString.trim(), account }
}
