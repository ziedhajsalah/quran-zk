const origin = 'https://quran-zk.tn'

async function check(url, status, location) {
  const response = await fetch(url, {
    redirect: 'manual',
    signal: AbortSignal.timeout(20_000),
  })
  if (response.status !== status)
    throw new Error(`${url}: expected ${status}, received ${response.status}`)
  if (location && response.headers.get('location') !== location)
    throw new Error(`${url}: unexpected redirect destination`)
  return response
}

const login = await check(`${origin}/login`, 200)
if (!(await login.text()).includes('المكتبة المباركة'))
  throw new Error('Production login page did not render the app.')
const session = await check(`${origin}/api/auth/get-session`, 200)
if ((await session.json()) !== null)
  throw new Error('Anonymous session response was not null.')
await check(`${origin}/profile`, 307, '/login?redirect=%2Fprofile&reason=auth')
for (const alias of [
  'https://www.quran-zk.tn',
  'https://quran-zk.ziedhajsalah.workers.dev',
]) {
  await check(
    `${alias}/login?redirect=%2Fprofile`,
    308,
    `${origin}/login?redirect=%2Fprofile`,
  )
}
console.log(
  'Production page, anonymous session, protected redirect and canonical aliases are healthy.',
)
