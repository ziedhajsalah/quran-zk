import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { eq, inArray } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import {
  memorizationAssignments,
  reviews,
} from '../../src/server/db/schema/app'
import { createAccount } from '../../src/server/services/accounts.server'
import { setGrade } from '../../src/server/services/grades.server'
import {
  assignReview,
  finishReview,
} from '../../src/server/services/reviews.server'
import {
  assignMemorization,
  finishMemorization,
} from '../../src/server/services/memorization.server'
import { rescheduleAssignment } from '../../src/server/services/assignment-deadline.server'
import { gotoApp, loginAs } from './helpers/navigation'
import type { Locator, Page } from '@playwright/test'
import type { Actor } from '../../src/server/auth-guards.server'

test.use({ timezoneId: 'America/Los_Angeles' })
const env = parseEnv(readFileSync('.env.local', 'utf8'))
const url = env.DATABASE_URL ?? ''
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Deadline browser fixtures require local PostgreSQL.')
const password = env.DEV_SEED_PASSWORD ?? ''
if (!password) throw new Error('Set DEV_SEED_PASSWORD for local fixtures.')
const ids: Array<string> = []
let teacher: Actor
let username: string
const fixtures = new Map<string, { id: string; username: string }>()
const now = new Date()
const today = Date.UTC(
  now.getUTCFullYear(),
  now.getUTCMonth(),
  now.getUTCDate(),
)
const past = today - 86400000
const future = today + 86400000
const kinds = ['review', 'memorization'] as const
const tableFor = (kind: (typeof kinds)[number]) =>
  kind === 'review' ? reviews : memorizationAssignments
const tabFor = (kind: (typeof kinds)[number]) =>
  kind === 'review' ? 'reviews' : 'memorization'
test.beforeAll(async () => {
  await withDatabase(url, async (db) => {
    const prefix = `due.${Date.now()}`
    username = `${prefix}.teacher`
    teacher = await createAccount(
      db,
      { username, displayName: 'معلم المواعيد', email: null, password },
      ['teacher'],
    )
    ids.push(teacher.id)
    for (const key of ['390', '1280', 'stale-review', 'stale-memorization']) {
      const student = await createAccount(
        db,
        {
          username: `${prefix}.${key.replace('stale-', 's-').replace('memorization', 'mem')}`,
          displayName: `طالب المواعيد ${key}`,
          email: null,
          password,
        },
        ['student'],
      )
      fixtures.set(key, { id: student.id, username: student.username })
      ids.push(student.id)
      await setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'good',
      })
      await assignReview(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        dueAt: past,
      })
      await assignMemorization(db, teacher, {
        studentId: student.id,
        surahNumber: 2,
        dueAt: past,
      })
    }
  })
})
test.afterAll(async () => {
  if (ids.length)
    await withDatabase(url, (db) =>
      db.delete(user).where(inArray(user.id, ids)),
    )
})
async function pickDate(page: Page, dialog: Locator, screenshotPath?: string) {
  await dialog.getByLabel('تاريخ استحقاق الواجب', { exact: true }).click()
  const label = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(future)
  await expect(
    page.getByRole('button', { name: 'الشهر التالي', exact: true }),
  ).toBeVisible()
  const day = page.getByRole('button', { name: label, exact: true })
  for (let i = 0; i < 2 && (await day.count()) === 0; i++)
    await page
      .getByRole('button', { name: 'الشهر التالي', exact: true })
      .click()
  await expect(day).toBeVisible()
  if (screenshotPath)
    await page.screenshot({ path: screenshotPath, animations: 'disabled' })
  await day.click()
}
async function assignment(studentId: string, kind: (typeof kinds)[number]) {
  const table = tableFor(kind)
  return withDatabase(
    url,
    async (db) =>
      (await db.select().from(table).where(eq(table.studentId, studentId)))[0],
  )
}
for (const width of [390, 1280]) {
  test(`staff edit/clear/add deadlines and students see UTC dates at ${width}px`, async ({
    page,
    browser,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    const student = fixtures.get(String(width))!
    await loginAs(page, username, password)
    const card = page
      .getByRole('article')
      .filter({ hasText: `@${student.username}` })
    await expect(card.getByText(/مراجعات متأخرة/)).toBeVisible()
    await expect(card.getByText(/واجبات حفظ متأخرة/)).toBeVisible()
    for (const kind of kinds) {
      const original = await assignment(student.id, kind)
      await gotoApp(page, `/staff/students/${student.id}?tab=${tabFor(kind)}`)
      await page
        .getByRole('button', { name: 'تعديل الموعد', exact: true })
        .click()
      const dialog = page.getByRole('dialog', {
        name: 'تعديل موعد الواجب',
        exact: true,
      })
      await expect(
        dialog.getByRole('button', { name: 'حفظ الموعد', exact: true }),
      ).toBeDisabled()
      await pickDate(
        page,
        dialog,
        width === 390 && kind === 'review'
          ? testInfo.outputPath('deadline-calendar-mobile.png')
          : undefined,
      )
      let release!: () => void, signal!: () => void
      const started = new Promise<void>((resolve) => {
        signal = resolve
      })
      const gate = new Promise<void>((resolve) => {
        release = resolve
      })
      await page.route('**/_serverFn/**', async (route) => {
        if (
          route.request().method() === 'POST' &&
          route.request().postData()?.includes('expectedDueAt')
        ) {
          signal()
          await gate
        }
        await route.continue()
      })
      try {
        await dialog
          .getByRole('button', { name: 'حفظ الموعد', exact: true })
          .click()
        await started
        await expect(
          dialog.getByLabel('تاريخ استحقاق الواجب', { exact: true }),
        ).toBeDisabled()
        await expect(
          dialog.getByRole('button', {
            name: 'إغلاق تعديل الموعد',
            exact: true,
          }),
        ).toHaveCount(0)
        await page.keyboard.press('Escape')
        await expect(dialog).toBeVisible()
      } finally {
        release()
      }
      await expect(dialog).not.toBeVisible()
      await page.unroute('**/_serverFn/**')
      expect((await assignment(student.id, kind)).dueAt?.getTime()).toBe(future)
      expect((await assignment(student.id, kind)).id).toBe(original.id)
      // Clear and then add a date to the same assignment.
      await page
        .getByRole('button', { name: 'تعديل الموعد', exact: true })
        .click()
      await dialog
        .getByRole('button', { name: 'مسح موعد الواجب', exact: true })
        .click()
      await dialog
        .getByRole('button', { name: 'حفظ الموعد', exact: true })
        .click()
      await expect(dialog).not.toBeVisible()
      expect((await assignment(student.id, kind)).dueAt).toBeNull()
      await page
        .getByRole('button', { name: 'تعديل الموعد', exact: true })
        .click()
      await pickDate(page, dialog)
      await dialog
        .getByRole('button', { name: 'حفظ الموعد', exact: true })
        .click()
      await expect(dialog).not.toBeVisible()
      await page.getByRole('link', { name: 'الرئيسية', exact: true }).click()
      if (kind === 'review') {
        await expect(card.getByText(/مراجعات متأخرة/)).toHaveCount(0)
        await expect(card.getByText(/واجبات حفظ متأخرة/)).toBeVisible()
      } else await expect(card).toHaveCount(0)
    }
    const studentContext = await browser.newContext({
      timezoneId: 'America/Los_Angeles',
      viewport: { width, height: 844 },
    })
    try {
      const studentPage = await studentContext.newPage()
      await loginAs(studentPage, student.username, password)
      const date = new Intl.DateTimeFormat('ar', {
        dateStyle: 'medium',
        timeZone: 'UTC',
      }).format(future)
      await expect(
        studentPage.getByText(`الاستحقاق: ${date}`, { exact: true }),
      ).toHaveCount(2)
      for (const kind of kinds) {
        await gotoApp(studentPage, `/surahs?tab=${tabFor(kind)}`)
        await expect(
          studentPage.getByRole('button', {
            name: 'تعديل الموعد',
            exact: true,
          }),
        ).toHaveCount(0)
        expect(
          await studentPage.evaluate(
            () => document.documentElement.scrollWidth <= innerWidth,
          ),
        ).toBe(true)
      }
      if (width === 390)
        await studentPage.screenshot({
          path: testInfo.outputPath('student-rescheduled-mobile.png'),
          fullPage: true,
        })
    } finally {
      await studentContext.close()
    }
  })
}
for (const kind of kinds) {
  test(`${kind} stale and terminal errors retain selected date without overwriting work`, async ({
    page,
  }) => {
    const student = fixtures.get(`stale-${kind}`)!
    const original = await assignment(student.id, kind)
    await loginAs(page, username, password)
    await gotoApp(page, `/staff/students/${student.id}?tab=${tabFor(kind)}`)
    await page
      .getByRole('button', { name: 'تعديل الموعد', exact: true })
      .click()
    const dialog = page.getByRole('dialog', {
      name: 'تعديل موعد الواجب',
      exact: true,
    })
    await pickDate(page, dialog)
    const selected = await dialog
      .getByLabel('تاريخ استحقاق الواجب', { exact: true })
      .textContent()
    await withDatabase(url, (db) =>
      rescheduleAssignment(db, teacher, kind, {
        assignmentId: original.id,
        dueAt: today,
        expectedDueAt: past,
      }),
    )
    await dialog
      .getByRole('button', { name: 'حفظ الموعد', exact: true })
      .click()
    await expect(
      dialog.getByText(/تغيّر موعد الواجب منذ فتح النافذة/),
    ).toBeVisible()
    await expect(
      dialog.getByLabel('تاريخ استحقاق الواجب', { exact: true }),
    ).toHaveText(selected!)
    expect((await assignment(student.id, kind)).dueAt?.getTime()).toBe(today)
    await withDatabase(url, (db) =>
      kind === 'review'
        ? finishReview(db, teacher, { assignmentId: original.id }, true)
        : finishMemorization(db, teacher, { assignmentId: original.id }),
    )
    await dialog
      .getByRole('button', { name: 'حفظ الموعد', exact: true })
      .click()
    await expect(
      dialog.getByText(/الواجب غير موجود أو لم يعد مفتوحاً/),
    ).toBeVisible()
    await expect(
      dialog.getByLabel('تاريخ استحقاق الواجب', { exact: true }),
    ).toHaveText(selected!)
    expect((await assignment(student.id, kind)).dueAt?.getTime()).toBe(today)
    await dialog.getByRole('button', { name: 'رجوع', exact: true }).click()
  })
}
