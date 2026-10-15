import { describe, expect, it, vi } from 'vitest'
import { collectAdminSetup } from '../../scripts/lib/admin-setup'

const local = 'postgresql://operator:private-password@127.0.0.1:55432/quran_dev'
const remote =
  'postgresql://operator:private-password@dev.example/neondb?sslmode=verify-full'
function wizard(
  answers: Array<string>,
  database = local,
  databaseUrl?: string,
) {
  const queue = [...answers]
  const ask = vi.fn(() => {
    const answer = queue.shift()
    if (answer === undefined) throw new Error('Unexpected prompt')
    return Promise.resolve(answer)
  })
  const readDatabaseUrl = vi.fn(() => Promise.resolve(database || undefined))
  const write = vi.fn()
  return { ask, readDatabaseUrl, write, databaseUrl }
}
const details = [
  'Admin.User',
  'Administrator',
  '',
  'A private password',
  'A private password',
]

describe('interactive first-admin configuration', () => {
  it('loads only local configuration and normalizes the account after confirmation', async () => {
    const options = wizard(['1', ...details, 'create local'])
    const result = await collectAdminSetup(options)
    expect(options.readDatabaseUrl.mock.calls).toEqual([['.env.local']])
    expect(result?.account).toMatchObject({
      username: 'admin.user',
      email: null,
    })
    expect(result?.connectionString).toBe(local)
    expect(options.write.mock.calls.flat().join('\n')).not.toContain(
      'private-password',
    )
  })
  it('loads the development file rather than a generic process database URL', async () => {
    const options = wizard(
      ['2', ...details, 'create development'],
      remote,
      'postgresql://prod.example/production',
    )
    expect((await collectAdminSetup(options))?.connectionString).toBe(remote)
    expect(options.readDatabaseUrl.mock.calls).toEqual([
      ['.env.neon-development.local'],
    ])
  })
  it('never loads a configuration file or inherits DATABASE_URL for production', async () => {
    const options = wizard(
      ['3', remote, ...details, 'create production'],
      local,
      local,
    )
    expect((await collectAdminSetup(options))?.connectionString).toBe(remote)
    expect(options.readDatabaseUrl).not.toHaveBeenCalled()
    expect(options.ask.mock.calls).toContainEqual([
      'PostgreSQL connection URL (input hidden): ',
      true,
    ])
  })
  it('allows explicit process configuration only for a custom target', async () => {
    const options = wizard(['4', ...details, 'create custom'], local, remote)
    expect((await collectAdminSetup(options))?.connectionString).toBe(remote)
    expect(options.readDatabaseUrl).not.toHaveBeenCalled()
  })
  it('prompts privately for a missing development URL', async () => {
    const options = wizard(['2', remote, ...details, 'create development'], '')
    expect((await collectAdminSetup(options))?.connectionString).toBe(remote)
    expect(options.ask.mock.calls).toContainEqual([
      'PostgreSQL connection URL (input hidden): ',
      true,
    ])
  })
  it('cancels unless the selected environment is explicitly confirmed', async () => {
    const options = wizard(['1', ...details, 'create production'])
    expect(await collectAdminSetup(options)).toBeNull()
  })
  it('refuses a remote target labeled local', async () => {
    await expect(collectAdminSetup(wizard(['1'], remote))).rejects.toThrow(
      'local configuration points to a remote host',
    )
  })
  it('retries invalid fields, short passwords and mismatched confirmation', async () => {
    const options = wizard([
      '1',
      '!',
      'valid.admin',
      '',
      'Admin',
      'bad email',
      '',
      'short',
      'Long password one',
      'mismatch',
      'Long password two',
      'Long password two',
      'create local',
    ])
    const result = await collectAdminSetup(options)
    expect(result?.account.password).toBe('Long password two')
    expect(options.write.mock.calls.flat().join('\n')).not.toContain(
      'Long password',
    )
  })
  it('rejects non-PostgreSQL targets and invalid menu choices', async () => {
    await expect(
      collectAdminSetup(wizard(['4', 'https://example.com/db'], '')),
    ).rejects.toThrow('PostgreSQL connection URL')
    const options = wizard(['5'])
    await expect(collectAdminSetup(options)).rejects.toThrow(
      'Choose an environment',
    )
    expect(options.readDatabaseUrl).not.toHaveBeenCalled()
  })
})
