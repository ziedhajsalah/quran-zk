import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { eq, inArray } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import { reviews } from '../../src/server/db/schema/app'
import { createAccount } from '../../src/server/services/accounts.server'
import { setGrade } from '../../src/server/services/grades.server'
import {
  assignReview,
  listReviews,
} from '../../src/server/services/reviews.server'
import { assignMemorization } from '../../src/server/services/memorization.server'
import { gotoApp, loginAs } from './helpers/navigation'
import type { Actor } from '../../src/server/auth-guards.server'
import type { Locator, Page } from '@playwright/test'

test.use({ timezoneId: 'America/Los_Angeles' })
const env = parseEnv(readFileSync('.env.local', 'utf8'))
const url = env.DATABASE_URL ?? ''
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Follow-up browser fixtures require local PostgreSQL.')
const password = env.DEV_SEED_PASSWORD ?? ''
if (!password) throw new Error('Set DEV_SEED_PASSWORD for local fixtures.')
const feedbackLabel = 'ملاحظات التقييم (اختياري)'
const queueReviewFeedback = 'أحسنت المراجعة.\nانتبه لأحكام المدّ <b>نص فقط</b>.'
const queueMemorizationFeedback = 'حفظ متقن، تابع تثبيت السورة.'
const detailMemorizationFeedback = 'راجع بدايات الآيات المتشابهة.'
const detailReviewFeedback = 'تحسن واضح في المراجعة التالية.'
const ids: Array<string> = []
const students = new Map<number, Actor>()
let teacher: Actor
const now = new Date()
const today = Date.UTC(
  now.getUTCFullYear(),
  now.getUTCMonth(),
  now.getUTCDate(),
)
const dueAt = today + 7 * 86400000
const arabicDate = new Intl.DateTimeFormat('ar', {
  timeZone: 'UTC',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
}).format(dueAt)
function definition(requestUrl: string) {
  return Buffer.from(
    decodeURIComponent(new URL(requestUrl).pathname.split('/').at(-1) ?? ''),
    'base64url',
  ).toString()
}
async function chooseFollowUp(page: Page, dialog: Locator) {
  await dialog
    .getByRole('checkbox', { name: 'إسناد المراجعة التالية', exact: true })
    .check()
  await dialog
    .getByRole('button', { name: 'موعد المراجعة التالية', exact: true })
    .click()
  const calendar = page.getByRole('dialog', {
    name: 'اختيار موعد المراجعة التالية',
    exact: true,
  })
  await expect(calendar).toBeVisible()
  await expect(
    calendar.getByRole('button', { name: 'الشهر التالي', exact: true }),
  ).toBeVisible()
  const day = calendar.getByRole('button', { name: arabicDate, exact: true })
  if (!(await day.count()))
    await calendar
      .getByRole('button', { name: 'الشهر التالي', exact: true })
      .click()
  await day.click()
  await expect(calendar).not.toBeVisible()
  await expect(
    dialog.getByRole('button', { name: 'موعد المراجعة التالية', exact: true }),
  ).toHaveText(arabicDate)
}
test.beforeAll(async () => {
  await withDatabase(url, async (db) => {
    const prefix = `followup.${Date.now()}`
    teacher = await createAccount(
      db,
      {
        username: `${prefix}.t`,
        displayName: 'معلم المراجعة التالية',
        email: null,
        password,
      },
      ['teacher'],
    )
    ids.push(teacher.id)
    for (const width of [390, 1280]) {
      const student = await createAccount(
        db,
        {
          username: `${prefix}.${width}`,
          displayName: `طالب المتابعة ${width}`,
          email: null,
          password,
        },
        ['student'],
      )
      ids.push(student.id)
      students.set(width, student)
      for (const surahNumber of [1, 2]) {
        await setGrade(db, teacher, {
          studentId: student.id,
          surahNumber,
          grade: 'medium',
        })
        await assignReview(db, teacher, {
          studentId: student.id,
          surahNumber,
          dueAt: today - (3 - surahNumber) * 86400000,
        })
      }
      for (const surahNumber of [3, 4])
        await assignMemorization(db, teacher, {
          studentId: student.id,
          surahNumber,
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
for (const width of [390, 1280]) {
  test(`optional next reviews work from queue and student dialogs and appear to the student at ${width}px`, async ({
    page,
  }, testInfo) => {
    const student = students.get(width)!
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ colorScheme: width === 1280 ? 'dark' : 'light' })
    await loginAs(page, teacher.username, password)
    await gotoApp(
      page,
      `/staff/work?q=${student.username}&kind=review&deadline=overdue`,
    )
    const rows = page.getByRole('article')
    await expect(rows).toHaveCount(2)
    await rows
      .filter({ hasText: 'الفاتحة' })
      .getByRole('button', { name: 'إتمام المراجعة', exact: true })
      .click()
    let dialog = page.getByRole('dialog', {
      name: 'إتمام المراجعة',
      exact: true,
    })
    await expect(
      dialog.getByRole('checkbox', {
        name: 'إسناد المراجعة التالية',
        exact: true,
      }),
    ).not.toBeChecked()
    await dialog
      .getByRole('radio', { name: 'الإبقاء على التقييم الحالي', exact: true })
      .check()
    await dialog
      .getByRole('checkbox', { name: 'إسناد المراجعة التالية', exact: true })
      .check()
    await expect(
      dialog.getByRole('button', { name: 'حفظ التقييم', exact: true }),
    ).toBeDisabled()
    await dialog
      .getByRole('checkbox', { name: 'إسناد المراجعة التالية', exact: true })
      .uncheck()
    await chooseFollowUp(page, dialog)
    await expect(
      dialog.getByRole('textbox', { name: feedbackLabel, exact: true }),
    ).toHaveAttribute('maxlength', '2000')
    await dialog
      .getByRole('textbox', { name: feedbackLabel, exact: true })
      .fill(queueReviewFeedback)
    // A failed request retains both the grade choice and the next-review date.
    await page.route('**/_serverFn/**', async (route) => {
      const fn = definition(route.request().url())
      if (fn.includes('reviews.ts') && fn.includes('close')) await route.abort()
      else await route.continue()
    })
    await dialog
      .getByRole('button', { name: 'حفظ والتالي', exact: true })
      .click()
    await expect(
      dialog.getByText('تعذر حفظ العملية', { exact: true }),
    ).toBeVisible()
    await expect(
      dialog.getByRole('button', {
        name: 'موعد المراجعة التالية',
        exact: true,
      }),
    ).toHaveText(arabicDate)
    await expect(
      dialog.getByRole('radio', {
        name: 'الإبقاء على التقييم الحالي',
        exact: true,
      }),
    ).toBeChecked()
    await expect(
      dialog.getByRole('textbox', { name: feedbackLabel, exact: true }),
    ).toHaveValue(queueReviewFeedback)
    await page.unroute('**/_serverFn/**')
    await dialog
      .getByRole('button', { name: 'حفظ والتالي', exact: true })
      .click()
    await expect(dialog).toContainText('البقرة')
    await expect(
      dialog.getByRole('textbox', { name: feedbackLabel, exact: true }),
    ).toHaveValue('')
    await expect(
      dialog.getByRole('checkbox', {
        name: 'إسناد المراجعة التالية',
        exact: true,
      }),
    ).not.toBeChecked()
    await dialog
      .getByRole('radio', { name: 'الإبقاء على التقييم الحالي', exact: true })
      .check()
    await dialog
      .getByRole('button', { name: 'حفظ التقييم', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(rows).toHaveCount(0)
    await gotoApp(
      page,
      `/staff/work?q=${student.username}&kind=memorization&deadline=all`,
    )
    await rows
      .filter({ hasText: 'آل عمران' })
      .getByRole('button', { name: 'تقييم الحفظ', exact: true })
      .click()
    dialog = page.getByRole('dialog', {
      name: 'تقييم واجب الحفظ',
      exact: true,
    })
    await dialog.getByRole('radio', { name: 'حفظ متقن', exact: true }).check()
    await chooseFollowUp(page, dialog)
    await dialog
      .getByRole('textbox', { name: feedbackLabel, exact: true })
      .fill(queueMemorizationFeedback)
    await dialog
      .getByRole('button', { name: 'حفظ التقييم', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(rows).toHaveCount(1)
    // The dedicated memorization dialog offers the same optional follow-up.
    await gotoApp(page, `/staff/students/${student.id}?tab=memorization`)
    await page.getByRole('button', { name: 'تقييم الحفظ', exact: true }).click()
    dialog = page.getByRole('dialog', {
      name: 'تقييم واجب الحفظ',
      exact: true,
    })
    await dialog.getByRole('radio', { name: 'حفظ متوسط', exact: true }).check()
    await chooseFollowUp(page, dialog)
    await dialog
      .getByRole('textbox', { name: feedbackLabel, exact: true })
      .fill(detailMemorizationFeedback)
    await page.screenshot({
      path: testInfo.outputPath(`follow-up-${width}.png`),
    })
    await dialog
      .getByRole('button', { name: 'حفظ تقييم الحفظ', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await page.getByRole('tab', { name: 'المراجعات', exact: true }).click()
    let saved = await withDatabase(url, (db) =>
      listReviews(db, teacher, student.id),
    )
    expect(saved.map((row) => row.surahNumber).sort()).toEqual([1, 3, 4])
    const first = saved.find((row) => row.surahNumber === 1)!
    await page
      .locator(`[id="review-${first.id}"]`)
      .getByRole('button', { name: 'إغلاق', exact: true })
      .click()
    dialog = page.getByRole('dialog', { name: 'إغلاق المراجعة', exact: true })
    await chooseFollowUp(page, dialog)
    await dialog
      .getByRole('textbox', { name: feedbackLabel, exact: true })
      .fill(detailReviewFeedback)
    // This older dialog now waits for the server and retains its choices on failure.
    await page.route('**/_serverFn/**', async (route) => {
      const fn = definition(route.request().url())
      if (fn.includes('reviews.ts') && fn.includes('close')) await route.abort()
      else await route.continue()
    })
    await dialog
      .getByRole('button', { name: 'تأكيد الإغلاق', exact: true })
      .click()
    await expect(dialog.getByRole('alert')).toBeVisible()
    await expect(
      dialog.getByRole('button', {
        name: 'موعد المراجعة التالية',
        exact: true,
      }),
    ).toHaveText(arabicDate)
    await expect(
      dialog.getByRole('textbox', { name: feedbackLabel, exact: true }),
    ).toHaveValue(detailReviewFeedback)
    await page.unroute('**/_serverFn/**')
    await dialog
      .getByRole('button', { name: 'تأكيد الإغلاق', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    saved = await withDatabase(url, (db) =>
      listReviews(db, teacher, student.id),
    )
    expect(saved.map((row) => row.surahNumber).sort()).toEqual([1, 3, 4])
    expect(saved.every((row) => row.dueAt === dueAt)).toBe(true)
    expect(saved.some((row) => row.id === first.id)).toBe(false)
    const [closed] = await withDatabase(url, (db) =>
      db.select().from(reviews).where(eq(reviews.id, first.id)),
    )
    expect(closed).toMatchObject({
      status: 'closed',
      closingGrade: 'medium',
      assessmentFeedback: detailReviewFeedback,
    })
    await page.getByRole('tab', { name: 'المراجعات', exact: true }).click()
    const another = saved.find((row) => row.surahNumber === 3)!
    await page
      .locator(`[id="review-${another.id}"]`)
      .getByRole('button', { name: 'إغلاق', exact: true })
      .click()
    dialog = page.getByRole('dialog', { name: 'إغلاق المراجعة', exact: true })
    await expect(
      dialog.getByRole('checkbox', {
        name: 'إسناد المراجعة التالية',
        exact: true,
      }),
    ).not.toBeChecked()
    await dialog.getByRole('button', { name: 'إلغاء', exact: true }).click()
    await checkFeedbackHistory(page, `/staff/students/${student.id}`)
    await page.context().clearCookies()
    await loginAs(page, student.username, password)
    await expect(page.locator('a[href*="tab=reviews#review-"]')).toHaveCount(3)
    await gotoApp(page, '/surahs?tab=reviews')
    for (const row of saved) {
      const task = page.locator(`[id="review-${row.id}"]`)
      await expect(task).toBeVisible()
      await expect(task).toContainText(arabicDate)
      await expect(
        task.getByRole('button', { name: 'إغلاق', exact: true }),
      ).toHaveCount(0)
    }
    await checkFeedbackHistory(page, '/surahs')
    await page.screenshot({
      path: testInfo.outputPath(`feedback-history-${width}.png`),
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
  })
}

async function checkFeedbackHistory(page: Page, base: string) {
  await gotoApp(page, `${base}?tab=history`)
  const reviewHistory = page.getByRole('tabpanel', {
    name: 'السجل',
    exact: true,
  })
  await expect(
    reviewHistory.getByText(queueReviewFeedback, { exact: true }),
  ).toBeVisible()
  await expect(
    reviewHistory.getByText(detailReviewFeedback, { exact: true }),
  ).toBeVisible()
  // Feedback remains plain text, including strings resembling markup.
  await expect(reviewHistory.locator('b')).toHaveCount(0)
  await gotoApp(page, `${base}?tab=memorization`)
  await page.getByRole('button', { name: 'عرض سجل الحفظ', exact: true }).click()
  await expect(
    page.getByText(queueMemorizationFeedback, { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText(detailMemorizationFeedback, { exact: true }),
  ).toBeVisible()
}
