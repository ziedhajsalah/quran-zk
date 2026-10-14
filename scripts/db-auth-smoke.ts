import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { withDatabase } from '../src/server/db.server'
import { createAuth } from '../src/server/auth.server'
import { getActor } from '../src/server/auth-guards.server'
import { user } from '../src/server/db/schema/auth'
import { createAccount } from '../src/server/services/accounts.server'
import {
  issueCode,
  redeemCode,
} from '../src/server/services/reset-codes.server'

const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is required.')
const config = {
  SITE_URL: 'http://localhost:3000',
  BETTER_AUTH_SECRET: randomBytes(48).toString('base64url'),
}
const username = `smoke.${Date.now()}`
const password = randomBytes(24).toString('base64url')
let id: string | undefined
try {
  await withDatabase(url, async (db) => {
    const created = await createAccount(
      db,
      {
        username,
        displayName: 'Temporary migration smoke account',
        email: null,
        password,
      },
      ['admin', 'student'],
    )
    id = created.id
    const auth = createAuth(db, config)
    const response = await auth.handler(
      new Request(`${config.SITE_URL}/api/auth/sign-in/username`, {
        method: 'POST',
        headers: {
          origin: config.SITE_URL,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      }),
    )
    if (response.status !== 200)
      throw new Error(`Hosted auth login returned ${response.status}.`)
    const cookie = response.headers.get('set-cookie')?.split(';')[0]
    if (!cookie) throw new Error('Hosted login did not set a cookie.')
    const headers = new Headers({ cookie })
    const actor = await getActor(db, auth, headers)
    if (!actor || actor.id !== created.id || !actor.isAdmin || !actor.isStudent)
      throw new Error('Hosted session/multi-role lookup failed.')
    const { code } = await issueCode(
      db,
      actor,
      config.BETTER_AUTH_SECRET,
      username,
    )
    await redeemCode(db, config.BETTER_AUTH_SECRET, {
      identifier: username,
      code,
      newPassword: randomBytes(24).toString('base64url'),
    })
    if (await getActor(db, auth, headers))
      throw new Error('Hosted reset did not revoke its session.')
    console.log(
      'Neon Better Auth credentials, login cookies, multi-role sessions and reset revocation verified.',
    )
  })
} finally {
  if (id)
    await withDatabase(url, (db) => db.delete(user).where(eq(user.id, id!)))
}
console.log(
  'Temporary smoke account, credentials, sessions and reset codes removed.',
)
