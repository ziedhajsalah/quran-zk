const relativeFormatter = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' })

const UNITS: ReadonlyArray<readonly [Intl.RelativeTimeFormatUnit, number]> = [
  ['day', 1000 * 60 * 60 * 24],
  ['hour', 1000 * 60 * 60],
  ['minute', 1000 * 60],
]

/**
 * Format a millisecond timestamp as an Arabic relative-time string
 * (e.g. "قبل ٣ أيام", "غدًا", "الآن"). Uses `Intl.RelativeTimeFormat`
 * with `numeric: 'auto'` for natural phrasing.
 *
 * @param fallback Returned when the diff is below one minute. Defaults
 *   to `'الآن'` (now). Some surfaces want a contextual phrase, e.g.
 *   `'أُسند الآن'`, so they can pass it here.
 */
export function formatArabicRelative(
  timestamp: number,
  fallback: string = 'الآن',
): string {
  const diffMs = timestamp - Date.now()
  for (const [unit, divisor] of UNITS) {
    const diff = Math.round(diffMs / divisor)
    if (Math.abs(diff) >= 1) {
      return relativeFormatter.format(diff, unit)
    }
  }
  return fallback
}
