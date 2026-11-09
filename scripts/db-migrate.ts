import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { withDatabase } from '../src/server/db.server'

const url = process.env.DATABASE_URL
if (!url)
  throw new Error(
    'DATABASE_URL is required. Use a direct connection for migrations.',
  )
await withDatabase(url, (db) => migrate(db, { migrationsFolder: './drizzle' }))
console.log('Database migrations applied.')
