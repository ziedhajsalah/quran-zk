import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { inArray } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import {
  memorizationAssignments,
  reviews,
} from '../../src/server/db/schema/app'
import { createAccount } from '../../src/server/services/accounts.server'
import { setGrade } from '../../src/server/services/grades.server'
import { gotoApp, loginAs } from './helpers/navigation'
import type { Actor } from '../../src/server/auth-guards.server'

test.use({ timezoneId: 'America/Los_Angeles' })
const env = parseEnv(readFileSync('.env.local', 'utf8'))
const url = env.DATABASE_URL ?? ''
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Queue browser fixtures require local PostgreSQL.')
const password = env.DEV_SEED_PASSWORD ?? ''
if (!password) throw new Error('Set DEV_SEED_PASSWORD for local fixtures.')
const ids: Array<string> = []
const fixtures = new Map<number, Actor>()
let teacher: Actor
let viewer: Actor
const instant = new Date()
const today = Date.UTC(
  instant.getUTCFullYear(),
  instant.getUTCMonth(),
  instant.getUTCDate(),
)
test.beforeAll(async () => {
  await withDatabase(url, async (db) => {
    const prefix = `work.${Date.now()}`
    teacher = await createAccount(
      db,
      {
        username: `${prefix}.t`,
        displayName: 'معلم قائمة الواجبات',
        email: null,
        password,
      },
      ['teacher'],
    )
    ids.push(teacher.id)
    viewer = await createAccount(
      db,
      {
        username: `${prefix}.v`,
        displayName: 'طالب المشاهدة',
        email: null,
        password,
      },
      ['student'],
    )
    ids.push(viewer.id)
    for (const width of [390, 1280]) {
      const student = await createAccount(
        db,
        {
          username: `${prefix}.${width}`,
          displayName: `طالب القائمة ${width}`,
          email: null,
          password,
        },
        ['student'],
      )
      ids.push(student.id)
      fixtures.set(width, student)
      for (let i = 1; i <= 21; i++) {
        await setGrade(db, teacher, {
          studentId: student.id,
          surahNumber: i,
          grade: 'good',
        })
        await db.insert(reviews).values({
          id: `${student.id}-${String(i).padStart(2, '0')}`,
          studentId: student.id,
          surahNumber: i,
          assignedAt: instant,
          dueAt: new Date(today - 86400000),
        })
      }
      for (const [i, due] of [
        today - 86400000,
        today,
        today + 86400000,
        null,
      ].entries())
        await db.insert(memorizationAssignments).values({
          id: `${student.id}-m${i}`,
          studentId: student.id,
          surahNumber: 30 + i,
          assignedAt: instant,
          dueAt: due === null ? null : new Date(due),
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
  test(`staff search, filter, paginate and act on linked work at ${width}px`, async ({
    page,
  }, testInfo) => {
    const student = fixtures.get(width)!
    await page.setViewportSize({ width, height: 844 })
    await loginAs(page, teacher.username, password)
    await page
      .getByRole('link', { name: 'قائمة الواجبات', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'قائمة الواجبات', exact: true }),
    ).toBeVisible()
    await page.getByLabel('البحث عن طالب').fill(student.username)
    await page.getByRole('button', { name: 'بحث', exact: true }).click()
    const rows = page.getByRole('article')
    await expect(rows).toHaveCount(20)
    await expect(rows.first()).toContainText(student.displayName)
    await page.getByRole('button', { name: 'التالي', exact: true }).click()
    await expect(rows).toHaveCount(2)
    await expect(
      page.getByRole('button', { name: 'التالي', exact: true }),
    ).toBeDisabled()
    await page.getByRole('button', { name: 'السابق', exact: true }).click()
    await expect(rows).toHaveCount(20)
    await page.getByRole('textbox', { name: 'نوع الواجب', exact: true }).click()
    await page.getByRole('option', { name: 'حفظ جديد', exact: true }).click()
    await expect(rows).toHaveCount(1)
    for (const [label, due] of [
      ['اليوم', today],
      ['قادمة', today + 86400000],
      ['دون موعد', null],
    ] as const) {
      await page
        .getByRole('textbox', { name: 'موعد الاستحقاق', exact: true })
        .click()
      await page.getByRole('option', { name: label, exact: true }).click()
      await expect(rows).toHaveCount(1)
      await expect(rows).toContainText(
        due === null
          ? 'دون موعد محدد'
          : new Intl.DateTimeFormat('ar', {
              dateStyle: 'medium',
              timeZone: 'UTC',
            }).format(due),
      )
    }
    if (width === 390)
      await page.screenshot({
        path: testInfo.outputPath('work-queue-mobile.png'),
        fullPage: true,
      })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await rows.getByRole('link', { name: 'فتح الواجب' }).click()
    await expect(page).toHaveURL(
      new RegExp(`tab=memorization#memorization-${student.id}-m3$`),
    )
    const linked = page.locator(`[id="memorization-${student.id}-m3"]`)
    await expect(linked).toBeVisible()
    await expect(linked).toBeInViewport()
    await linked
      .getByRole('button', { name: 'إلغاء الواجب', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'تأكيد إلغاء الواجب', exact: true })
      .click()
    await expect(linked).toHaveCount(0)
    await page.goBack()
    await expect(page.getByLabel('البحث عن طالب')).toHaveValue(student.username)
    await expect(
      page.getByRole('textbox', { name: 'نوع الواجب', exact: true }),
    ).toHaveValue('حفظ جديد')
    await expect(
      page.getByText('لا توجد واجبات تطابق البحث والفلاتر.'),
    ).toBeVisible()
    // A review link selects its tab and identifies the exact assignment as well.
    await page.getByRole('textbox', { name: 'نوع الواجب', exact: true }).click()
    await page.getByRole('option', { name: 'مراجعة', exact: true }).click()
    await page
      .getByRole('textbox', { name: 'موعد الاستحقاق', exact: true })
      .click()
    await page.getByRole('option', { name: 'متأخرة', exact: true }).click()
    await rows.first().getByRole('link', { name: 'فتح الواجب' }).click()
    await expect(page).toHaveURL(
      new RegExp(`tab=reviews#review-${student.id}-01$`),
    )
    await expect(
      page
        .locator(`[id="review-${student.id}-01"]`)
        .getByRole('button', { name: 'إغلاق', exact: true }),
    ).toBeVisible()
  })
}
test('students and anonymous visitors cannot open the staff work queue', async ({
  page,
}) => {
  await gotoApp(page, '/staff/work')
  await expect(page).toHaveURL(/\/login/)
  await loginAs(page, viewer.username, password)
  await gotoApp(page, '/staff/work?q=private')
  await expect(page).toHaveURL('http://localhost:3000/')
  await expect(
    page.getByRole('heading', { name: 'قائمة الواجبات', exact: true }),
  ).toHaveCount(0)
})
test('queue handles loading failures, retry, empty search and invalid URL filters', async ({
  page,
}) => {
  await loginAs(page, teacher.username, password)
  await page.route('**/_serverFn/**', async (route) => {
    const endpoint =
      new URL(route.request().url()).pathname.split('/').at(-1) ?? ''
    const definition = Buffer.from(
      decodeURIComponent(endpoint),
      'base64url',
    ).toString()
    if (definition.includes('work-queue.ts')) await route.abort()
    else await route.continue()
  })
  await page.getByRole('link', { name: 'قائمة الواجبات', exact: true }).click()
  await expect(
    page.getByText('تعذر تحميل الواجبات', { exact: true }),
  ).toBeVisible({ timeout: 20000 })
  await page.unroute('**/_serverFn/**')
  await page
    .getByRole('button', { name: 'إعادة المحاولة', exact: true })
    .click()
  await expect(page.getByRole('article').first()).toBeVisible()
  await page.getByLabel('البحث عن طالب').fill('queue-no-such-student')
  await page.getByRole('button', { name: 'بحث', exact: true }).click()
  await expect(
    page.getByText('لا توجد واجبات تطابق البحث والفلاتر.'),
  ).toBeVisible()
  await gotoApp(page, '/staff/work?kind=unknown&deadline=unknown&q=')
  await expect(
    page.getByRole('textbox', { name: 'نوع الواجب', exact: true }),
  ).toHaveValue('كل الواجبات')
  await expect(
    page.getByRole('textbox', { name: 'موعد الاستحقاق', exact: true }),
  ).toHaveValue('متأخرة')
})
