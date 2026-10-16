import { accountInput, usernameSchema } from '../../src/server/accounts'
import { AdminSetupError } from './admin-errors'
import { promptPassword, selectDatabase } from './admin-setup'
import type { SetupOptions } from './admin-setup'

export function parseResetIdentifier(input: string) {
  const identifier = input.trim().toLowerCase()
  const valid = identifier.includes('@')
    ? identifier.length > 0 &&
      accountInput.shape.email.safeParse(identifier).success
    : usernameSchema.safeParse(identifier).success
  if (!valid)
    throw new AdminSetupError(
      'Enter an existing username (3–32 letters, numbers, dots, underscores or hyphens) or a valid email address.',
    )
  return identifier
}

export async function collectPasswordReset(options: SetupOptions) {
  const { ask, write } = options
  const { environment, connectionString } = await selectDatabase(options)
  let identifier: string
  for (;;) {
    try {
      identifier = parseResetIdentifier(
        await ask('Account username or email: '),
      )
      break
    } catch (error) {
      if (!(error instanceof AdminSetupError)) throw error
      write(error.message)
    }
  }
  const password = await promptPassword(options, 'New password')
  write(`Reset the password for "${identifier}" in ${environment}?`)
  write(
    'This revokes all existing sessions for that account. Roles and account status stay unchanged.',
  )
  if (
    (
      await ask(`Type "reset ${environment}" to continue, or Enter to cancel: `)
    ).trim() !== `reset ${environment}`
  )
    return null
  return { connectionString, identifier, password }
}
