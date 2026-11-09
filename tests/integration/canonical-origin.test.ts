import { describe, expect, it } from 'vitest'
import { canonicalOriginRedirect } from '../../src/server/canonical-origin.server'

describe('production canonical origin', () => {
  it.each(['www.quran-zk.tn', 'quran-zk.ziedhajsalah.workers.dev'])(
    'preserves path and query for %s',
    (host) => {
      const response = canonicalOriginRedirect(
        new Request(`https://${host}/login?redirect=%2Fprofile`),
        'https://quran-zk.tn',
      )
      expect(response?.status).toBe(308)
      expect(response?.headers.get('location')).toBe(
        'https://quran-zk.tn/login?redirect=%2Fprofile',
      )
    },
  )
  it.each([
    'quran-zk.tn',
    'quran-zk-dev.ziedhajsalah.workers.dev',
    'develop-quran-zk.ziedhajsalah.workers.dev',
    'localhost',
    'evil.example',
  ])('leaves %s untouched', (host) => {
    expect(
      canonicalOriginRedirect(
        new Request(`https://${host}/login`),
        'https://quran-zk.tn',
      ),
    ).toBeNull()
  })
  it('does not canonicalize development deployments', () => {
    expect(
      canonicalOriginRedirect(
        new Request('https://www.quran-zk.tn/login'),
        'http://localhost:3000',
      ),
    ).toBeNull()
  })
})
