import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const deadlines = [Date.UTC(2026, 0, 1), Date.UTC(2026, 10, 6)]
let rendered: Array<string>

beforeAll(() => {
  // Start a fresh process so TZ applies before the component's module-level
  // Intl formatter is created, even when the parent runner/CI uses UTC.
  const script = `
    import { createElement } from 'react'
    import { renderToStaticMarkup } from 'react-dom/server'
    import { MantineProvider } from '@mantine/core'
    import { SurahReviewRow } from './src/components/surahs/SurahReviewRow/SurahReviewRow.tsx'
    import { getSurah } from './src/data/surahs.ts'

    if (new Date('2026-01-01T00:00:00Z').getTimezoneOffset() <= 0) {
      throw new Error('Date regression test must run west of UTC.')
    }
    const rows = ${JSON.stringify([...deadlines, null])}.map((dueAt) =>
      renderToStaticMarkup(createElement(MantineProvider, null,
        createElement(SurahReviewRow, {
          surah: getSurah(1), assignedAt: Date.UTC(2026, 0, 1), dueAt,
        }),
      )),
    )
    process.stdout.write(JSON.stringify(rows))
  `
  rendered = JSON.parse(
    execFileSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '--eval', script],
      {
        cwd: fileURLToPath(new URL('../..', import.meta.url)),
        env: { ...process.env, TZ: 'America/Los_Angeles' },
        encoding: 'utf8',
        timeout: 15_000,
      },
    ),
  )
})

describe('review deadline calendar dates west of UTC', () => {
  it.each(deadlines)(
    'renders UTC-midnight deadline %s without shifting to the previous day',
    (dueAt) => {
      const expected = new Intl.DateTimeFormat('ar', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(dueAt)
      expect(rendered[deadlines.indexOf(dueAt)]).toContain(
        `الاستحقاق: ${expected}`,
      )
    },
  )
  it('does not invent a deadline for an undated review', () => {
    expect(rendered[deadlines.length]).not.toContain('الاستحقاق:')
  })
})
