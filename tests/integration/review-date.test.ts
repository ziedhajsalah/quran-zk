import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MantineProvider } from '@mantine/core'
import { describe, expect, it } from 'vitest'
import { SurahReviewRow } from '~/components/surahs/SurahReviewRow/SurahReviewRow'
import { getSurah } from '~/data/surahs'

function renderReview(dueAt: number | null) {
  return renderToStaticMarkup(
    createElement(
      MantineProvider,
      null,
      createElement(SurahReviewRow, {
        surah: getSurah(1),
        assignedAt: Date.UTC(2026, 0, 1),
        dueAt,
      }),
    ),
  )
}

describe('review deadline calendar dates', () => {
  it.each([Date.UTC(2026, 0, 1), Date.UTC(2026, 10, 6)])(
    'renders UTC-midnight deadline %s without shifting to the previous day',
    (dueAt) => {
      const expected = new Intl.DateTimeFormat('ar', {
        timeZone: 'UTC',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(dueAt)
      expect(renderReview(dueAt)).toContain(`الاستحقاق: ${expected}`)
    },
  )
  it('does not invent a deadline for an undated review', () => {
    expect(renderReview(null)).not.toContain('الاستحقاق:')
  })
})
