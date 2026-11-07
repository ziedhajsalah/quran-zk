import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { and, eq, inArray } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import {
  gradeHistory,
  grades,
  memorizationAssignments,
} from '../../src/server/db/schema/app'
import { createAccount } from '../../src/server/services/accounts.server'
import { setGrade } from '../../src/server/services/grades.server'
import {
  assignMemorization,
  finishMemorization,
} from '../../src/server/services/memorization.server'
import { gotoApp, loginAs, waitForAppReady } from './helpers/navigation'
import {
  chooseArabicDeadline,
  clearDeadline,
  useUtcDeadlineBoundary,
} from './helpers/deadline'
import type { Locator, Page } from '@playwright/test'
import type { Actor } from '../../src/server/auth-guards.server'

test.use({ timezoneId: 'America/Los_Angeles' })
const env = parseEnv(readFileSync('.env.local', 'utf8'))
const databaseUrl = env.DATABASE_URL ?? ''
if (!['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname))
  throw new Error('Memorization browser fixtures require local PostgreSQL.')
const password = env.DEV_SEED_PASSWORD ?? ''
if (!password)
  throw new Error('Set DEV_SEED_PASSWORD for local memorization fixtures.')
const ids: Array<string> = []
const students = new Map<string, Actor>()
let teacher: Actor

test.beforeAll(async () => {
  await withDatabase(databaseUrl, async (db) => {
    const prefix = `mem.${Date.now()}`
    teacher = await createAccount(
      db,
      {
        username: `${prefix}.teacher`,
        displayName: 'معلم الحفظ الجديد',
        email: null,
        password,
      },
      ['teacher'],
    )
    ids.push(teacher.id)
    for (const key of ['390', '1280', 'manual', 'retry', 'stale']) {
      const student = await createAccount(
        db,
        {
          username: `${prefix}.${key}`,
          displayName: `طالب الحفظ ${key}`,
          email: null,
          password,
        },
        ['student'],
      )
      ids.push(student.id)
      students.set(key, student)
      await setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'medium',
      })
      await assignMemorization(db, teacher, {
        studentId: student.id,
        surahNumber: 2,
      })
    }
  })
})
test.afterAll(async () => {
  if (ids.length)
    await withDatabase(databaseUrl, async (db) => {
      await db.delete(user).where(inArray(user.id, ids))
    })
})
async function staffPage(page: Page, key: string) {
  const student = students.get(key)!
  await loginAs(page, teacher.username, password)
  await gotoApp(page, `/staff/students/${student.id}?tab=memorization`)
  await expect(page.getByRole('article')).toHaveCount(1)
  return student
}
async function openDrawer(page: Page) {
  await page
    .getByRole('button', { name: 'إسناد حفظ جديد', exact: true })
    .click()
  const drawer = page.getByRole('dialog', {
    name: 'إسناد حفظ جديد',
    exact: true,
  })
  await expect(drawer).toBeVisible()
  return drawer
}
async function chooseSurah(page: Page, drawer: Locator, name: string) {
  const input = drawer.getByRole('textbox', {
    name: 'السورة الجديدة',
    exact: true,
  })
  await input.fill(name)
  await page.getByRole('option', { name, exact: true }).click()
}
for (const width of [390, 1280]) {
  test(`assignment, student dashboard and graded completion work at ${width}px west of UTC`, async ({
    page,
    browser,
  }, testInfo) => {
    const errors: Array<string> = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 844 })
    await useUtcDeadlineBoundary(page)
    const student = await staffPage(page, String(width))
    const drawer = await openDrawer(page)
    await expect(
      drawer.getByRole('button', { name: 'إسناد الحفظ', exact: true }),
    ).toBeDisabled()
    await drawer.getByRole('textbox', { name: 'السورة الجديدة' }).click()
    await expect(
      page.getByRole('option', { name: 'الفاتحة', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('option', { name: 'البقرة', exact: true }),
    ).toHaveCount(0)
    await chooseSurah(page, drawer, 'الكهف')
    const dueAt = await chooseArabicDeadline(page, drawer)
    await clearDeadline(drawer, 'مسح موعد الحفظ')
    await chooseArabicDeadline(page, drawer)
    let start!: () => void, release!: () => void
    const started = new Promise<void>((resolve) => {
      start = resolve
    })
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/_serverFn/**', async (route) => {
      if (
        route.request().method() === 'POST' &&
        route.request().postData()?.includes('surahNumber')
      ) {
        start()
        await gate
      }
      await route.continue()
    })
    await drawer
      .getByRole('button', { name: 'إسناد الحفظ', exact: true })
      .click()
    await started
    await expect(
      drawer.getByRole('textbox', { name: 'السورة الجديدة' }),
    ).toBeDisabled()
    await expect(
      drawer.getByLabel('تاريخ الاستحقاق (اختياري)', { exact: true }),
    ).toBeDisabled()
    await expect(
      drawer.getByRole('button', { name: 'إغلاق محدد الحفظ', exact: true }),
    ).toHaveCount(0)
    await page.keyboard.press('Escape')
    await expect(drawer).toBeVisible()
    release()
    await expect(drawer).not.toBeVisible()
    await page.unroute('**/_serverFn/**')
    await expect(page.getByRole('article')).toHaveCount(2)
    const assignment = await withDatabase(
      databaseUrl,
      async (db) =>
        (
          await db
            .select()
            .from(memorizationAssignments)
            .where(
              and(
                eq(memorizationAssignments.studentId, student.id),
                eq(memorizationAssignments.surahNumber, 18),
              ),
            )
        )[0],
    )
    expect(assignment.dueAt?.getTime()).toBe(dueAt)
    const studentContext = await browser.newContext({
      viewport: { width, height: 844 },
      timezoneId: 'America/Los_Angeles',
    })
    const studentPage = await studentContext.newPage()
    await loginAs(studentPage, student.username, password)
    await expect(
      studentPage.getByText('سور مسجّلة: 1', { exact: true }),
    ).toBeVisible()
    const card = studentPage
      .getByRole('heading', { name: 'ماذا أحفظ؟', exact: true })
      .locator('..')
      .locator('..')
    await expect(
      card.getByText('2 واجبات حفظ مفتوحة', { exact: true }),
    ).toBeVisible()
    await card.getByRole('link', { name: 'الكهف', exact: true }).click()
    await expect(studentPage).toHaveURL(/tab=memorization.*#memorization-/)
    await expect(
      studentPage.locator(`#memorization-${assignment.id}`),
    ).toBeInViewport()
    const due = new Intl.DateTimeFormat('ar', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(dueAt)
    await expect(
      studentPage
        .locator(`#memorization-${assignment.id}`)
        .getByText(`الاستحقاق: ${due}`, { exact: true }),
    ).toBeVisible()
    await expect(
      studentPage.getByRole('button', { name: 'تقييم الحفظ', exact: true }),
    ).toHaveCount(0)
    expect(
      await studentPage.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    if (width === 390)
      await studentPage.screenshot({
        path: testInfo.outputPath('new-memorization-mobile.png'),
      })
    await page
      .locator(`#memorization-${assignment.id}`)
      .getByRole('button', { name: 'تقييم الحفظ', exact: true })
      .click()
    const assessment = page.getByRole('dialog', {
      name: 'تقييم واجب الحفظ',
      exact: true,
    })
    await expect(
      assessment.getByRole('button', { name: 'حفظ تقييم الحفظ', exact: true }),
    ).toBeDisabled()
    await assessment
      .getByRole('radio', { name: 'حفظ متقن', exact: true })
      .check()
    await assessment
      .getByRole('button', { name: 'حفظ تقييم الحفظ', exact: true })
      .click()
    await expect(assessment).not.toBeVisible()
    await expect(page.getByRole('article')).toHaveCount(1)
    await page.getByRole('tab', { name: 'التقدّم', exact: true }).click()
    await expect(
      page
        .getByRole('article')
        .first()
        .getByRole('heading', { name: 'الكهف', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('article').first().getByText('حفظ متقن', { exact: true }),
    ).toBeVisible()
    await gotoApp(studentPage, '/')
    await expect(
      studentPage.getByText('سور مسجّلة: 2', { exact: true }),
    ).toBeVisible()
    await expect(
      studentPage.getByText('1 واجبات حفظ مفتوحة', { exact: true }),
    ).toBeVisible()
    await studentContext.close()
    const optional = await openDrawer(page)
    await chooseSurah(page, optional, 'يس')
    await chooseArabicDeadline(page, optional)
    await clearDeadline(optional, 'مسح موعد الحفظ')
    await optional
      .getByRole('button', { name: 'إسناد الحفظ', exact: true })
      .click()
    await expect(optional).not.toBeVisible()
    await withDatabase(databaseUrl, async (db) => {
      const [undated] = await db
        .select()
        .from(memorizationAssignments)
        .where(
          and(
            eq(memorizationAssignments.studentId, student.id),
            eq(memorizationAssignments.surahNumber, 36),
          ),
        )
      expect(undated.dueAt).toBeNull()
    })
    expect(errors).toEqual([])
  })
}

test('ordinary grading completes matching work and cancellation adds no grade', async ({
  page,
}) => {
  const student = await staffPage(page, 'manual')
  await page.getByRole('tab', { name: 'السور', exact: true }).click()
  await page.getByRole('button', { name: 'إضافة سورة', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'إضافة سورة', exact: true })
  await drawer.getByText('البقرة', { exact: true }).click()
  await drawer.getByText('حفظ متقن', { exact: true }).click()
  await drawer.getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect(drawer).not.toBeVisible()
  await page.getByRole('tab', { name: 'حفظ جديد', exact: true }).click()
  await expect(
    page.getByText('لا توجد واجبات حفظ جديدة حالياً.', { exact: true }),
  ).toBeVisible()
  const assign = await openDrawer(page)
  await chooseSurah(page, assign, 'الكهف')
  await assign.getByRole('button', { name: 'إسناد الحفظ', exact: true }).click()
  await expect(assign).not.toBeVisible()
  await page.getByRole('button', { name: 'إلغاء الواجب', exact: true }).click()
  await page
    .getByRole('button', { name: 'تأكيد إلغاء الواجب', exact: true })
    .click()
  await expect(
    page.getByText('لا توجد واجبات حفظ جديدة حالياً.', { exact: true }),
  ).toBeVisible()
  await withDatabase(databaseUrl, async (db) => {
    const rows = await db
      .select()
      .from(grades)
      .where(eq(grades.studentId, student.id))
    expect(rows.map((r) => r.surahNumber).sort()).toEqual([1, 2])
    const tasks = await db
      .select()
      .from(memorizationAssignments)
      .where(eq(memorizationAssignments.studentId, student.id))
    expect(tasks.find((r) => r.surahNumber === 2)).toMatchObject({
      status: 'closed',
      closingGrade: 'good',
    })
    expect(tasks.find((r) => r.surahNumber === 18)).toMatchObject({
      status: 'cancelled',
      closingGrade: null,
    })
  })
})

test('stale assignment errors preserve the selected surah and date for correction', async ({
  page,
}) => {
  const student = await staffPage(page, 'retry')
  const drawer = await openDrawer(page)
  await chooseSurah(page, drawer, 'الكهف')
  await chooseArabicDeadline(page, drawer)
  const value = await drawer
    .getByLabel('تاريخ الاستحقاق (اختياري)', { exact: true })
    .textContent()
  await withDatabase(databaseUrl, (db) =>
    setGrade(db, teacher, {
      studentId: student.id,
      surahNumber: 18,
      grade: 'medium',
    }),
  )
  await drawer.getByRole('button', { name: 'إسناد الحفظ', exact: true }).click()
  await expect(
    drawer.getByText(
      'هذه السورة مسجّلة للطالب بالفعل. حدّث القائمة واختر سورة جديدة أو أسند مراجعة لها.',
      { exact: true },
    ),
  ).toBeVisible()
  await expect(
    drawer.getByRole('textbox', { name: 'السورة الجديدة' }),
  ).toHaveValue('الكهف')
  await expect(
    drawer.getByLabel('تاريخ الاستحقاق (اختياري)', { exact: true }),
  ).toHaveText(value ?? '')
  await chooseSurah(page, drawer, 'يس')
  await drawer.getByRole('button', { name: 'إسناد الحفظ', exact: true }).click()
  await expect(drawer).not.toBeVisible()
  await expect(
    page.getByRole('article').getByRole('heading', { name: 'يس', exact: true }),
  ).toBeVisible()
})

test('assessment errors retain the selected grade and never add partial progress', async ({
  page,
}) => {
  const student = await staffPage(page, 'stale')
  const [assignment] = await withDatabase(databaseUrl, (db) =>
    db
      .select()
      .from(memorizationAssignments)
      .where(eq(memorizationAssignments.studentId, student.id)),
  )
  await page.getByRole('button', { name: 'تقييم الحفظ', exact: true }).click()
  const dialog = page.getByRole('dialog', {
    name: 'تقييم واجب الحفظ',
    exact: true,
  })
  await dialog.getByRole('radio', { name: 'حفظ متقن', exact: true }).check()
  await withDatabase(databaseUrl, (db) =>
    finishMemorization(db, teacher, { assignmentId: assignment.id }),
  )
  await dialog
    .getByRole('button', { name: 'حفظ تقييم الحفظ', exact: true })
    .click()
  await expect(
    dialog.getByText('واجب الحفظ غير موجود أو لم يعد مفتوحاً. حدّث القائمة.', {
      exact: true,
    }),
  ).toBeVisible()
  await expect(
    dialog.getByRole('radio', { name: 'حفظ متقن', exact: true }),
  ).toBeChecked()
  await withDatabase(databaseUrl, async (db) => {
    expect(
      await db
        .select()
        .from(grades)
        .where(
          and(eq(grades.studentId, student.id), eq(grades.surahNumber, 2)),
        ),
    ).toHaveLength(0)
    expect(
      await db
        .select()
        .from(gradeHistory)
        .where(eq(gradeHistory.studentId, student.id)),
    ).toHaveLength(1)
  })
  await page.keyboard.press('Escape')
  await page.reload()
  await waitForAppReady(page)
  await expect(
    page.getByText('لا توجد واجبات حفظ جديدة حالياً.', { exact: true }),
  ).toBeVisible()
})
