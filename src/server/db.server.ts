import { Client } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import * as authSchema from './db/schema/auth'
import * as appSchema from './db/schema/app'

export type Database = ReturnType<typeof createDatabase>
export const schema = { ...authSchema, ...appSchema }
export function createDatabase(client: Client) {
  return drizzle(client, { schema })
}
export async function withDatabase<T>(
  connectionString: string,
  run: (db: Database) => Promise<T>,
): Promise<T> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10_000,
  })
  try {
    await client.connect()
    return await run(createDatabase(client))
  } finally {
    await client.end()
  }
}
