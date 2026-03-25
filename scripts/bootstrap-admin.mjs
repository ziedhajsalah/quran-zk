#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { createClerkClient } from '@clerk/backend'

function loadEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return
  }

  const fileContents = readFileSync(filePath, 'utf8')

  for (const rawLine of fileContents.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    if (!key || process.env[key] !== undefined) {
      continue
    }

    let value = line.slice(separatorIndex + 1).trim()
    const isQuoted =
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))

    if (isQuoted) {
      value = value.slice(1, -1).trim()
    } else {
      value = value.replace(/\s+#.*$/, '').trim()
    }

    process.env[key] = value
  }
}

function loadLocalEnv() {
  const root = process.cwd()
  loadEnvFile(path.join(root, '.env'))
  loadEnvFile(path.join(root, '.env.local'))
}

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (!token.startsWith('--')) {
      continue
    }
    const key = token.slice(2)
    const value = argv[i + 1]
    if (!value || value.startsWith('--')) {
      throw new Error(`Missing value for --${key}`)
    }
    args[key] = value
    i += 1
  }
  return args
}

function formatClerkError(error) {
  if (
    typeof error === 'object' &&
    error &&
    'errors' in error &&
    Array.isArray(error.errors)
  ) {
    return error.errors
      .map((entry) => {
        const code =
          typeof entry === 'object' && entry && 'code' in entry
            ? entry.code
            : 'unknown'
        const message =
          typeof entry === 'object' && entry && 'message' in entry
            ? entry.message
            : 'Unknown Clerk validation error'
        const meta =
          typeof entry === 'object' && entry && 'meta' in entry ? entry.meta : null
        return `${code}: ${message}${meta ? ` (${JSON.stringify(meta)})` : ''}`
      })
      .join('\n')
  }

  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

async function main() {
  loadLocalEnv()

  const { username, password, 'display-name': displayName, email } = parseArgs(
    process.argv.slice(2),
  )

  if (!username || !password || !displayName) {
    throw new Error(
      'Usage: npm run bootstrap:admin -- --username <value> --password <value> --display-name <value> [--email <value>]',
    )
  }

  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error('Missing CLERK_SECRET_KEY environment variable.')
  }

  const clerkClient = createClerkClient({ secretKey })
  let clerkUser = null
  try {
    clerkUser = await clerkClient.users.createUser({
      username,
      password,
      firstName: displayName,
      emailAddress: email ? [email] : undefined,
    })

    const args = JSON.stringify({
      clerkUserId: clerkUser.id,
      username,
      displayName,
      email: email ?? null,
    })

    const result = spawnSync(
      'npx',
      ['convex', 'run', '--push', 'auth/users:bootstrapAdmin', args],
      {
        stdio: 'inherit',
        shell: false,
      },
    )

    if (result.status !== 0) {
      await clerkClient.users.deleteUser(clerkUser.id)
      throw new Error('Convex bootstrap mutation failed.')
    }
  } catch (error) {
    if (clerkUser) {
      await clerkClient.users.deleteUser(clerkUser.id)
    }

    throw new Error(
      [
        'Failed to bootstrap the first admin.',
        formatClerkError(error),
        'Check Clerk Dashboard > User & authentication and ensure:',
        '- Username is enabled if you pass --username',
        '- Password authentication is enabled',
        '- Email is enabled if you pass --email',
      ].join('\n'),
    )
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
