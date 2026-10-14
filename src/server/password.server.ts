import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

// Preserve Better Auth's scrypt parameters, NFKC normalization and salt:key format.
const options = { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 }
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password.normalize('NFKC'), salt, 64, options, (error, key) => {
      if (error) reject(error)
      else resolve(key)
    })
  })
}
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  return `${salt}:${(await derive(password, salt)).toString('hex')}`
}
export async function verifyPassword({
  hash,
  password,
}: {
  hash: string
  password: string
}) {
  if (!/^[a-f0-9]{32}:[a-f0-9]{128}$/i.test(hash)) return false
  const [salt, key] = hash.split(':')
  return timingSafeEqual(await derive(password, salt), Buffer.from(key, 'hex'))
}
