const arabicNumberFormatter = new Intl.NumberFormat('ar')

export function formatArabicNumber(value: number) {
  return arabicNumberFormatter.format(value)
}

export function formatArabicPercent(value: number) {
  return `${formatArabicNumber(Math.round(value))}٪`
}
