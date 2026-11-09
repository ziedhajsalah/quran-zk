import { describe, expect, it } from 'vitest'
import { accountInput } from '../../src/server/accounts'
import { AppError } from '../../src/server/errors'
import {
  AdminSetupError,
  adminSetupErrorMessage,
} from '../../scripts/lib/admin-errors'

const secret = 'postgresql://private-user:password-canary@private-host/database'
function databaseFailure(code: string) {
  return new Error(`SQL with credential ${secret}`, {
    cause: Object.assign(new Error(secret), {
      code,
      query: secret,
      parameters: [secret],
    }),
  })
}

describe('safe admin setup diagnostics', () => {
  it.each([
    ['ECONNREFUSED', /Start the local database/],
    ['ENOTFOUND', /hostname could not be found/],
    ['ETIMEDOUT', /firewall/],
    ['28P01', /separate from the new admin password/],
    ['28000', /connection permissions/],
    ['3D000', /database name/],
    ['42P01', /npm run db:migrate/],
    ['42703', /schema is out of date/],
    ['42501', /permissions needed/],
    ['53300', /connection slots/],
    ['57P03', /starting up/],
    ['23505', /first admin/],
    ['ECONNRESET', /verify whether the admin was created/i],
    ['EACCES', /file permissions/],
    ['ERR_INVALID_URL', /connection URL is invalid/],
  ])('explains wrapped %s without leaking driver details', (code, expected) => {
    const message = adminSetupErrorMessage(databaseFailure(code))
    expect(message).toMatch(expected)
    expect(message).not.toContain(secret)
    expect(message).not.toContain('password-canary')
  })
  it('recognizes the empty-user-table safeguard and suggests recovery', () => {
    const message = adminSetupErrorMessage(
      new Error(secret, {
        cause: new AppError(
          'Bootstrap is only available before any user exists.',
        ),
      }),
    )
    expect(message).toContain('already contains users')
    expect(message).toContain('npm run rescue:password')
    expect(message).not.toContain(secret)
  })
  it('recognizes aggregate connection failures and pg connection timeouts', () => {
    expect(
      adminSetupErrorMessage(
        new AggregateError([databaseFailure('ECONNREFUSED')], secret),
      ),
    ).toContain('refused')
    expect(
      adminSetupErrorMessage(
        new Error('Connection terminated due to connection timeout'),
      ),
    ).toContain('timed out')
  })
  it('keeps TLS verification enabled in its recovery advice', () => {
    const message = adminSetupErrorMessage(
      databaseFailure('ERR_TLS_CERT_ALTNAME_INVALID'),
    )
    expect(message).toContain('hostname')
    expect(message).toContain('Keep certificate verification enabled')
    expect(message).not.toContain(secret)
  })
  it('reports invalid account fields without values from Zod errors', () => {
    const result = accountInput.safeParse({
      username: '!',
      displayName: '',
      email: secret,
      password: 'tiny',
    })
    if (result.success) throw new Error('Expected validation failure')
    const message = adminSetupErrorMessage(result.error)
    expect(message).toContain('username:')
    expect(message).toContain('password: use 8–128 characters')
    expect(message).not.toContain(secret)
    expect(message).not.toContain('tiny')
  })
  it('handles unknown and cyclic errors without dumping arbitrary messages or codes', () => {
    const error = { message: secret, code: secret, cause: null as unknown }
    error.cause = error
    for (const value of [
      error,
      new AppError(secret),
      databaseFailure('constructor'),
      databaseFailure('toString'),
      null,
    ]) {
      const message = adminSetupErrorMessage(value)
      expect(message).toContain('failed unexpectedly')
      expect(message).not.toContain(secret)
    }
  })
  it('prints only deliberately authored operator errors verbatim', () => {
    expect(
      adminSetupErrorMessage(
        new AdminSetupError('Choose an environment from 1 to 4.'),
      ),
    ).toBe('Choose an environment from 1 to 4.')
  })
})
