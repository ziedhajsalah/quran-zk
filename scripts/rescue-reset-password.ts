import { eq } from 'drizzle-orm'
import { withDatabase } from '../src/server/db.server'
import { user } from '../src/server/db/schema/auth'
import { setPassword } from '../src/server/services/accounts.server'
import { passwordSchema } from '../src/server/accounts'

const { DATABASE_URL, RESET_IDENTIFIER, RESET_PASSWORD } = process.env
if (!DATABASE_URL || !RESET_IDENTIFIER || !RESET_PASSWORD)
  throw new Error(
    'DATABASE_URL, RESET_IDENTIFIER and RESET_PASSWORD are required.',
  )
const password = passwordSchema.parse(RESET_PASSWORD)
await withDatabase(DATABASE_URL, async (db) => {
  const value = RESET_IDENTIFIER.trim().toLowerCase()
  const target = (
    await db
      .select()
      .from(user)
      .where(
        value.includes('@') ? eq(user.email, value) : eq(user.username, value),
      )
  ).at(0)
  if (!target) throw new Error('Account not found.')
  await setPassword(db, target.id, password)
  console.log('Password updated and sessions revoked.')
})
