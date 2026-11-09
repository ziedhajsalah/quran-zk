import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { eq, inArray } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import {
  grades,
  memorizationAssignments,
  reviews,
} from '../../src/server/db/schema/app'
import { createAccount } from '../../src/server/services/accounts.server'
import { setGrade } from '../../src/server/services/grades.server'
import {
  assignReview,
  listReviews,
} from '../../src/server/services/reviews.server'
import {
  assignMemorization,
  listMemorization,
} from '../../src/server/services/memorization.server'
import { gotoApp, loginAs } from './helpers/navigation'
import type { Actor } from '../../src/server/auth-guards.server'

test.use({ timezoneId: 'America/Los_Angeles' })
const env = parseEnv(readFileSync('.env.local', 'utf8'))
const url = env.DATABASE_URL ?? ''
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Readiness fixtures require local PostgreSQL.')
const password = env.DEV_SEED_PASSWORD ?? ''
if (!password) throw new Error('Set DEV_SEED_PASSWORD for local fixtures.')
const ids: Array<string> = []
const fixtures = new Map<
  number,
  { student: Actor; reviewId: string; memorizationId: string }
>()
let teacher: Actor
function definition(requestUrl: string) {
  return Buffer.from(
    decodeURIComponent(new URL(requestUrl).pathname.split('/').at(-1) ?? ''),
    'base64url',
  ).toString()
}
test.beforeAll(async () => {
  await withDatabase(url, async (db) => {
    const prefix = `ready.${Date.now()}`
    teacher = await createAccount(
      db,
      {
        username: `${prefix}.t`,
        displayName: 'معلم الجاهزية',
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
          displayName: `طالب الجاهزية ${width}`,
          email: null,
          password,
        },
        ['student'],
      )
      ids.push(student.id)
      await setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'medium',
      })
      await assignReview(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
      })
      await assignMemorization(db, teacher, {
        studentId: student.id,
        surahNumber: 2,
      })
      fixtures.set(width, {
        student,
        reviewId: (await listReviews(db, teacher, student.id))[0].id,
        memorizationId: (await listMemorization(db, teacher, student.id))[0]
          ._id,
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
  test(`students signal readiness and teachers filter and assess at ${width}px`, async ({
    page,
    browser,
  }, testInfo) => {
    const { student, reviewId, memorizationId } = fixtures.get(width)!
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({
      colorScheme: width === 1280 ? 'dark' : 'light',
    })
    await loginAs(page, student.username, password)
    await gotoApp(page, '/surahs?tab=reviews')
    const review = page.locator(`[id="review-${reviewId}"]`)
    await expect(
      review.getByRole('button', { name: 'إغلاق', exact: true }),
    ).toHaveCount(0)
    if (width === 390) {
      const nativeContext = await browser.newContext({
        javaScriptEnabled: false,
        storageState: await page.context().storageState(),
      })
      try {
        const native = await nativeContext.newPage()
        await native.goto('/surahs?tab=reviews')
        await expect(
          native.getByRole('button', {
            name: 'أنا جاهز للتقييم',
            exact: true,
          }),
        ).toBeDisabled()
      } finally {
        await nativeContext.close()
      }
    }
    // Hold the request: no duplicate submission before the readiness response.
    let requests = 0
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/_serverFn/**', async (route) => {
      if (
        definition(route.request().url()).includes('assignment-readiness.ts')
      ) {
        requests++
        await held
      }
      await route.continue()
    })
    await review
      .getByRole('button', { name: 'أنا جاهز للتقييم', exact: true })
      .click()
    try {
      await expect.poll(() => requests).toBe(1)
      await expect(
        review.getByRole('button', { name: 'أنا جاهز للتقييم', exact: true }),
      ).toBeDisabled()
    } finally {
      release()
    }
    await expect(
      review.getByText('جاهز للتقييم', { exact: true }),
    ).toBeVisible()
    await page.unroute('**/_serverFn/**')
    await review
      .getByRole('button', { name: 'التراجع عن الجاهزية', exact: true })
      .click()
    await expect(
      review.getByText('جاهز للتقييم', { exact: true }),
    ).toHaveCount(0)
    await review
      .getByRole('button', { name: 'أنا جاهز للتقييم', exact: true })
      .click()
    await expect(
      review.getByRole('button', {
        name: 'التراجع عن الجاهزية',
        exact: true,
      }),
    ).toBeEnabled()
    await page.getByRole('tab', { name: 'حفظ جديد', exact: true }).click()
    const memorization = page.locator(`[id="memorization-${memorizationId}"]`)
    await expect(
      memorization.getByRole('button', { name: 'تقييم الحفظ', exact: true }),
    ).toHaveCount(0)
    await page.route('**/_serverFn/**', async (route) => {
      if (
        definition(route.request().url()).includes('assignment-readiness.ts')
      )
        await route.abort()
      else await route.continue()
    })
    await memorization
      .getByRole('button', { name: 'أنا جاهز للتقييم', exact: true })
      .click()
    await expect(memorization.getByRole('alert')).toBeVisible()
    await expect(
      memorization.getByRole('button', {
        name: 'أنا جاهز للتقييم',
        exact: true,
      }),
    ).toBeEnabled()
    await expect(
      memorization.getByText('جاهز للتقييم', { exact: true }),
    ).toHaveCount(0)
    await page.unroute('**/_serverFn/**')
    await memorization
      .getByRole('button', { name: 'أنا جاهز للتقييم', exact: true })
      .click()
    await expect(memorization.getByRole('alert')).toHaveCount(0)
    await expect(
      memorization.getByText('جاهز للتقييم', { exact: true }),
    ).toBeVisible()
    await memorization
      .getByRole('button', { name: 'التراجع عن الجاهزية', exact: true })
      .click()
    await expect(
      memorization.getByRole('button', {
        name: 'أنا جاهز للتقييم',
        exact: true,
      }),
    ).toBeEnabled()
    await memorization
      .getByRole('button', { name: 'أنا جاهز للتقييم', exact: true })
      .click()
    await expect(
      memorization.getByRole('button', {
        name: 'التراجع عن الجاهزية',
        exact: true,
      }),
    ).toBeEnabled()
    await page.screenshot({
      path: testInfo.outputPath(`student-ready-${width}.png`),
      fullPage: true,
    })
    await gotoApp(page, '/')
    await expect(page.getByText('جاهز للتقييم', { exact: true })).toHaveCount(
      2,
    )
    // Readiness did not grade or close either task.
    await withDatabase(url, async (db) => {
      expect(
        await db
          .select()
          .from(grades)
          .where(eq(grades.studentId, student.id)),
      ).toMatchObject([{ surahNumber: 1, grade: 'medium' }])
      expect(
        (await listReviews(db, teacher, student.id))[0].readyAt,
      ).not.toBeNull()
      expect(
        (await listMemorization(db, teacher, student.id))[0].readyAt,
      ).not.toBeNull()
    })
    const studentState = await page.context().storageState()
    await page.context().clearCookies()
    await loginAs(page, teacher.username, password)
    await gotoApp(
      page,
      `/staff/work?q=${student.username}&kind=all&deadline=all`,
    )
    const rows = page.getByRole('article')
    await expect(rows).toHaveCount(2)
    await page
      .getByRole('textbox', { name: 'جاهزية الطالب', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'لم يعلن الجاهزية', exact: true })
      .click()
    await expect(rows).toHaveCount(0)
    await page
      .getByRole('textbox', { name: 'جاهزية الطالب', exact: true })
      .click()
    await page
      .getByRole('option', { name: 'جاهز للتقييم', exact: true })
      .click()
    await expect(rows).toHaveCount(2)
    await page
      .getByLabel('البحث عن طالب', { exact: true })
      .fill(student.username)
    await page.getByRole('button', { name: 'بحث', exact: true }).click()
    await expect
      .poll(() => new URL(page.url()).searchParams.get('readiness'))
      .toBe('ready')
    await page.reload()
    await expect(
      page.getByRole('textbox', { name: 'جاهزية الطالب', exact: true }),
    ).toHaveValue('جاهز للتقييم')
    await expect(rows).toHaveCount(2)
    await expect(rows.getByText('جاهز للتقييم', { exact: true })).toHaveCount(
      2,
    )
    await expect(
      page.getByRole('button', { name: 'التراجع عن الجاهزية', exact: true }),
    ).toHaveCount(0)
    await page.screenshot({
      path: testInfo.outputPath(`staff-ready-${width}.png`),
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    // Staff student-detail pages show the signal without student-only actions.
    await rows
      .filter({ hasText: 'الفاتحة' })
      .getByRole('link', { name: 'فتح الواجب', exact: true })
      .click()
    await expect(
      page
        .locator(`[id="review-${reviewId}"]`)
        .getByText('جاهز للتقييم', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'التراجع عن الجاهزية', exact: true }),
    ).toHaveCount(0)
    await page.goBack()
    await rows
      .filter({ hasText: 'الفاتحة' })
      .getByRole('button', { name: 'إتمام المراجعة', exact: true })
      .click()
    const dialog = page.getByRole('dialog', {
      name: 'إتمام المراجعة',
      exact: true,
    })
    await dialog.getByRole('radio', { name: 'حفظ متقن', exact: true }).check()
    await dialog
      .getByRole('button', { name: 'حفظ التقييم', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(rows).toHaveCount(1)
    await rows
      .getByRole('button', { name: 'إلغاء الواجب', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'تأكيد إلغاء الواجب', exact: true })
      .click()
    await expect(rows).toHaveCount(0)
    await withDatabase(url, async (db) => {
      expect(
        (await db.select().from(reviews).where(eq(reviews.id, reviewId)))[0],
      ).toMatchObject({
        readyAt: null,
        status: 'closed',
        closingGrade: 'good',
      })
      expect(
        (
          await db
            .select()
            .from(memorizationAssignments)
            .where(eq(memorizationAssignments.id, memorizationId))
        )[0],
      ).toMatchObject({ readyAt: null, status: 'cancelled' })
    })
    const returningStudent = await browser.newContext({
      storageState: studentState,
    })
    try {
      const studentPage = await returningStudent.newPage()
      await gotoApp(studentPage, '/surahs?tab=reviews')
      await expect(
        studentPage.locator(`[id="review-${reviewId}"]`),
      ).toHaveCount(0)
      await studentPage
        .getByRole('tab', { name: 'حفظ جديد', exact: true })
        .click()
      await expect(
        studentPage.getByText('لا توجد واجبات حفظ جديدة حالياً.', {
          exact: true,
        }),
      ).toBeVisible()
    } finally {
      await returningStudent.close()
    }
  })
}
