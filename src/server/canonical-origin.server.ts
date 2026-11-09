const productionOrigin = 'https://quran-zk.tn'
const aliases = new Set([
  'www.quran-zk.tn',
  'quran-zk.ziedhajsalah.workers.dev',
])

/** Keep authentication cookies and origin checks on the configured public origin. */
export function canonicalOriginRedirect(request: Request, siteUrl: string) {
  const url = new URL(request.url)
  if (siteUrl !== productionOrigin || !aliases.has(url.hostname)) return null
  const target = new URL(productionOrigin)
  target.pathname = url.pathname
  target.search = url.search
  return Response.redirect(target.href, 308)
}
