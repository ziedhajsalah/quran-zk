#!/usr/bin/env node

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

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
  return {
    reset: argv.includes('--reset'),
  }
}

function main() {
  loadLocalEnv()
  const { reset } = parseArgs(process.argv.slice(2))
  const args = JSON.stringify({ reset })

  const result = spawnSync(
    'npx',
    ['convex', 'run', '--push', 'seed:run', args],
    {
      stdio: 'inherit',
      shell: false,
    },
  )

  if (result.status !== 0) {
    throw new Error(
      [
        'Failed to seed demo data.',
        'Check that CONVEX_DEPLOYMENT is set and BETTER_AUTH_SECRET / SITE_URL exist on the Convex deployment.',
      ].join('\n'),
    )
  }
}

main()
