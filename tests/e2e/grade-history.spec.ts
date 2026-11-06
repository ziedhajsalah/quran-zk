import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { inArray } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import { gradeHistory } from '../../src/server/db/schema/app'
import { createAccount } from '../../src/server/services/accounts.server'
import { setGrade } from '../../src/server/services/grades.server'
import { assignReview } from '../../src/server/services/reviews.server'
import { gotoApp, loginAs, waitForAppReady } from './helpers/navigation'

test.use({ timezoneId: 'America/Los_Angeles' })
const env = parseEnv(readFileSync('.env.local', 'utf8'))
const databaseUrl = env.DATABASE_URL ?? ''
if (!['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname))
  throw new Error('Progress browser fixtures require local PostgreSQL.')
const password = env.DEV_SEED_PASSWORD ?? ''
if (!password) throw new Error('Set DEV_SEED_PASSWORD for progress fixtures.')
const ids: Array<string> = []
let teacherName: string,
  studentName: string,
  studentId: string,
  liveId: string,
  emptyId: string
const at = Date.UTC(2026, 10, 6)

test.beforeAll(async () => {
  await withDatabase(databaseUrl, async (db) => {
    const prefix = `progress.${Date.now()}`
    teacherName = `${prefix}.teacher`
    studentName = `${prefix}.student`
    const teacher = await createAccount(
      db,
      {
        username: teacherName,
        displayName: 'معلم التقدّم',
        email: null,
        password,
      },
      ['teacher'],
    )
    ids.push(teacher.id)
    const student = await createAccount(
      db,
      {
        username: studentName,
        displayName: 'طالب التقدّم',
        email: null,
        password,
      },
      ['student'],
    )
    ids.push(student.id)
    studentId = student.id
    const live = await createAccount(
      db,
      {
        username: `${prefix}.live`,
        displayName: 'طالب تقدّم مباشر',
        email: null,
        password,
      },
      ['student'],
    )
    ids.push(live.id)
    liveId = live.id
    const empty = await createAccount(
      db,
      {
        username: `${prefix}.empty`,
        displayName: 'طالب بلا سجل',
        email: null,
        password,
      },
      ['student'],
    )
    ids.push(empty.id)
    emptyId = empty.id
    // Saved historical transitions deliberately differ from the current grade.
    await db.insert(gradeHistory).values(
      Array.from({ length: 25 }, (_, i) => ({
        studentId,
        surahNumber: i % 2 ? 2 : 1,
        previousGrade: 'forgotten' as const,
        newGrade: 'medium' as const,
        actorId: i === 24 ? null : teacher.id,
        changedAt: new Date(at),
        source: 'review' as const,
      })),
    )
    await setGrade(db, teacher, { studentId, surahNumber: 1, grade: 'good' })
    await setGrade(db, teacher, {
      studentId: liveId,
      surahNumber: 1,
      grade: 'forgotten',
    })
    await assignReview(db, teacher, { studentId: liveId, surahNumber: 1 })
    await setGrade(db, teacher, {
      studentId: liveId,
      surahNumber: 114,
      grade: 'medium',
    })
  })
})
test.afterAll(async () => {
  if (ids.length)
    await withDatabase(databaseUrl, async (db) => {
      await db.delete(user).where(inArray(user.id, ids))
    })
})

for (const width of [390, 1280]) {
  test(`student progress filters and pagination work at ${width}px west of UTC`, async ({
    page,
  }, testInfo) => {
    const errors: Array<string> = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 844 })
    await loginAs(page, studentName, password)
    await gotoApp(page, '/surahs?tab=progress')
    await expect(
      page.getByRole('tab', { name: 'التقدّم', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('article')).toHaveCount(20)
    const stamp = new Intl.DateTimeFormat('ar', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(at)
    await expect(
      page
        .getByRole('article')
        .nth(1)
        .getByText(`التاريخ: ${stamp} (UTC)`, { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('article').first().getByText('حفظ متقن', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('article').nth(1).getByText('حفظ متوسط', { exact: true }),
    ).toBeVisible()
    await expect(
      page
        .getByRole('article')
        .getByRole('heading', { name: 'الناس', exact: true }),
    ).toHaveCount(0)
    await expect(
      page
        .getByRole('article')
        .nth(1)
        .getByText('بواسطة: حساب محذوف', { exact: true }),
    ).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    if (width === 390)
      await page.screenshot({
        path: testInfo.outputPath('grade-history-mobile.png'),
      })
    await page.getByRole('button', { name: 'الأقدم', exact: true }).click()
    await expect(page.getByRole('article')).toHaveCount(6)
    await expect(
      page.getByRole('button', { name: 'الأقدم', exact: true }),
    ).toBeDisabled()
    await page
      .getByRole('textbox', { name: 'تصفية حسب السورة', exact: true })
      .click()
    await page.getByRole('option', { name: 'البقرة', exact: true }).click()
    await expect(page.getByRole('article')).toHaveCount(12)
    await expect(
      page.getByRole('button', { name: 'الأحدث', exact: true }),
    ).toBeDisabled()
    await expect(
      page
        .getByRole('article')
        .first()
        .getByRole('heading', { name: 'البقرة' }),
    ).toBeVisible()
    await page
      .getByRole('textbox', { name: 'تصفية حسب السورة', exact: true })
      .click()
    await page.getByRole('option', { name: 'الكهف', exact: true }).click()
    await expect(
      page.getByText('لا توجد تغييرات مسجّلة لهذا الاختيار بعد.', {
        exact: true,
      }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'عرض كل السور', exact: true })
      .click()
    await expect(page.getByRole('article')).toHaveCount(20)
    await page.reload()
    await waitForAppReady(page)
    await expect(page.getByRole('article')).toHaveCount(20)
    expect(errors).toEqual([])
  })
}

test('staff see fresh review and manual grade transitions, and student navigation resets filters', async ({
  page,
}) => {
  await loginAs(page, teacherName, password)
  await gotoApp(page, `/staff/students/${liveId}?tab=progress`)
  await expect(page.getByRole('article')).toHaveCount(2)
  await page.getByRole('tab', { name: 'المراجعات', exact: true }).click()
  await page.getByRole('button', { name: 'إغلاق', exact: true }).click()
  await page.getByText('حفظ متقن', { exact: true }).click()
  await page.getByRole('button', { name: 'تأكيد الإغلاق', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'إغلاق', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('tab', { name: 'التقدّم', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(3)
  const latest = page.getByRole('article').first()
  await expect(latest.getByText('حفظ متقن', { exact: true })).toBeVisible()
  await expect(latest.getByText('يحتاج مراجعة', { exact: true })).toBeVisible()
  await expect(
    latest.getByText('عند إغلاق مراجعة', { exact: true }),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'السور', exact: true }).click()
  await page.getByText('حفظ متوسط', { exact: true }).first().click()
  await page.getByRole('tab', { name: 'التقدّم', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(4)
  await expect(latest.getByText('حفظ متوسط', { exact: true })).toBeVisible()
  await expect(latest.getByText('حفظ متقن', { exact: true })).toBeVisible()
  await expect(
    latest.getByText('تحديث سجل الحفظ', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: 'تصفية حسب السورة', exact: true })
    .click()
  await page.getByRole('option', { name: 'البقرة', exact: true }).click()
  await expect(
    page.getByText('لا توجد تغييرات مسجّلة لهذا الاختيار بعد.', {
      exact: true,
    }),
  ).toBeVisible()
  await gotoApp(page, `/staff/students/${studentId}?tab=progress`)
  await expect(page.getByRole('article')).toHaveCount(20)
  await gotoApp(page, `/staff/students/${emptyId}?tab=progress`)
  await expect(
    page.getByText('لا توجد تغييرات مسجّلة لهذا الاختيار بعد.', {
      exact: true,
    }),
  ).toBeVisible()
})

test('history request errors show a retry action and recover', async ({
  page,
}) => {
  await loginAs(page, studentName, password)
  await gotoApp(page, '/surahs?tab=grades')
  // Scope the failure to history; session/route loaders must continue normally.
  await page.route('**/_serverFn/**', (route) => {
    const endpoint =
      new URL(route.request().url()).pathname.split('/').at(-1) ?? ''
    const definition = Buffer.from(endpoint, 'base64url').toString()
    return definition.includes('listHistoryForStudent')
      ? route.fulfill({ status: 503, body: 'temporarily unavailable' })
      : route.continue()
  })
  await page.getByRole('tab', { name: 'التقدّم', exact: true }).click()
  await expect(
    page.getByText('تعذر تحميل سجل التقدّم', { exact: true }),
  ).toBeVisible({ timeout: 20000 })
  await expect(page.getByRole('article')).toHaveCount(0)
  await page.unroute('**/_serverFn/**')
  await page
    .getByRole('button', { name: 'إعادة المحاولة', exact: true })
    .click()
  await expect(page.getByRole('article')).toHaveCount(20)
})
