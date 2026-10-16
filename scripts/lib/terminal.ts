import { readFile } from 'node:fs/promises'
import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import { parseEnv } from 'node:util'
import { AdminSetupError } from './admin-errors'
import type { SetupOptions } from './admin-setup'

export async function withTerminal<T>(
  run: (options: SetupOptions) => Promise<T>,
) {
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
    return await run({
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
