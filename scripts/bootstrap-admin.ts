import { withDatabase } from '../src/server/db.server'
import { createAccount } from '../src/server/services/accounts.server'

const {
  DATABASE_URL,
  ADMIN_USERNAME,
  ADMIN_PASSWORD,
  ADMIN_NAME,
  ADMIN_EMAIL,
} = process.env
if (!DATABASE_URL || !ADMIN_USERNAME || !ADMIN_PASSWORD || !ADMIN_NAME)
  throw new Error(
    'DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD and ADMIN_NAME are required.',
  )
const result = await withDatabase(DATABASE_URL, (db) =>
  createAccount(
    db,
    {
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
      displayName: ADMIN_NAME,
      email: ADMIN_EMAIL ?? null,
    },
    ['admin'],
    true,
  ),
)
console.log(`Created admin ${result.username}.`)
