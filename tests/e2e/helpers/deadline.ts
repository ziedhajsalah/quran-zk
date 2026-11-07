import { expect } from '@playwright/test'
import type { Locator, Page } from '@playwright/test'

export function arabicDate(
  timestamp: number,
  options: Intl.DateTimeFormatOptions,
) {
  return new Intl.DateTimeFormat('ar', {
    numberingSystem: 'latn',
    timeZone: 'UTC',
    ...options,
  }).format(timestamp)
}

export async function useUtcDeadlineBoundary(page: Page) {
  const now = new Date()
  await page.clock.setFixedTime(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15, 0, 30)),
  )
  expect(
    await page.evaluate(() => [new Date().getDate(), new Date().getUTCDate()]),
  ).toEqual([14, 15])
}

export async function chooseArabicDeadline(page: Page, drawer: Locator) {
  const today = await page.evaluate(() => new Date().toISOString().slice(0, 10))
  const todayMs = Date.parse(`${today}T00:00:00.000Z`)
  const dueAt = todayMs + 86_400_000
  const input = drawer.getByLabel('تاريخ الاستحقاق (اختياري)', { exact: true })
  await input.click()
  await expect(
    drawer.getByRole('button', { name: 'الشهر التالي', exact: true }),
  ).toBeVisible()
  const dayLabel = (timestamp: number) =>
    arabicDate(timestamp, { day: 'numeric', month: 'long', year: 'numeric' })
  const day = drawer.getByRole('button', {
    name: dayLabel(dueAt),
    exact: true,
  })
  if ((await day.count()) === 0)
    await drawer
      .getByRole('button', { name: 'الشهر التالي', exact: true })
      .click()
  await expect(
    drawer.getByRole('button', {
      name: arabicDate(dueAt, { month: 'long', year: 'numeric' }),
      exact: true,
    }),
  ).toBeVisible()
  await drawer
    .getByRole('button', { name: 'الشهر التالي', exact: true })
    .click()
  const nextMonth = new Date(dueAt)
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1, 1)
  await expect(
    drawer.getByRole('button', {
      name: arabicDate(nextMonth.getTime(), { month: 'long', year: 'numeric' }),
      exact: true,
    }),
  ).toBeVisible()
  await drawer
    .getByRole('button', { name: 'الشهر السابق', exact: true })
    .click()
  await expect(drawer.getByRole('columnheader')).toHaveText([
    'ن',
    'ث',
    'ر',
    'خ',
    'ج',
    'س',
    'ح',
  ])
  const yesterday = drawer.getByRole('button', {
    name: dayLabel(todayMs - 86_400_000),
    exact: true,
  })
  if ((await yesterday.count()) > 0) await expect(yesterday).toBeDisabled()
  const todayButton = drawer.getByRole('button', {
    name: dayLabel(todayMs),
    exact: true,
  })
  if ((await todayButton.count()) > 0) await expect(todayButton).toBeEnabled()
  await day.click()
  await expect(input).toHaveText(dayLabel(dueAt))
  return dueAt
}

export async function clearDeadline(drawer: Locator, label: string) {
  const clear = drawer.getByRole('button', { name: label, exact: true })
  await expect(clear).toHaveAttribute('tabindex', '0')
  await clear.focus()
  await clear.press('Enter')
  await expect(
    drawer.getByLabel('تاريخ الاستحقاق (اختياري)', { exact: true }),
  ).toHaveText('اختر تاريخًا')
  await expect(clear).toHaveCount(0)
}
