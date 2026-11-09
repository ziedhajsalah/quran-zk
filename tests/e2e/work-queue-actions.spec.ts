import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { eq, inArray } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import {
  gradeHistory,
  grades,
  memorizationAssignments,
  reviews,
} from '../../src/server/db/schema/app'
import { createAccount } from '../../src/server/services/accounts.server'
import { rescheduleAssignment } from '../../src/server/services/assignment-deadline.server'
import { setGrade } from '../../src/server/services/grades.server'
import { gotoApp, loginAs } from './helpers/navigation'
import type { Actor } from '../../src/server/auth-guards.server'

test.use({ timezoneId: 'America/Los_Angeles' })
const env = parseEnv(readFileSync('.env.local', 'utf8'))
const url = env.DATABASE_URL ?? ''
if (!['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('Queue action fixtures require local PostgreSQL.')
const password = env.DEV_SEED_PASSWORD ?? ''
if (!password) throw new Error('Set DEV_SEED_PASSWORD for local fixtures.')
const ids: Array<string> = []
const students = new Map<number, Actor>()
let teacher: Actor
const now = new Date()
const overdue = new Date(
  Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
    86400000,
)
function definition(requestUrl: string) {
  return Buffer.from(
    decodeURIComponent(new URL(requestUrl).pathname.split('/').at(-1) ?? ''),
    'base64url',
  ).toString()
}
test.beforeAll(async () => {
  await withDatabase(url, async (db) => {
    const prefix = `queue.actions.${Date.now()}`
    teacher = await createAccount(
      db,
      {
        username: `${prefix}.t`,
        displayName: 'معلم التقييم المباشر',
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
          displayName: `طالب التقييم ${width}`,
          email: null,
          password,
        },
        ['student'],
      )
      ids.push(student.id)
      students.set(width, student)
      for (let number = 1; number <= 24; number++) {
        await setGrade(db, teacher, {
          studentId: student.id,
          surahNumber: number,
          grade: 'good',
        })
        await db.insert(reviews).values({
          id: `${student.id}-r${String(number).padStart(2, '0')}`,
          studentId: student.id,
          surahNumber: number,
          assignedAt: now,
          dueAt: overdue,
        })
      }
      for (const number of [100, 101])
        await db.insert(memorizationAssignments).values({
          id: `${student.id}-m${number}`,
          studentId: student.id,
          surahNumber: number,
          assignedAt: now,
          dueAt: overdue,
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
  test(`staff assess, advance, reschedule and cancel directly without losing queue position at ${width}px`, async ({
    page,
  }, testInfo) => {
    const student = students.get(width)!
    await page.setViewportSize({ width, height: 844 })
    await page.emulateMedia({ colorScheme: width === 1280 ? 'dark' : 'light' })
    await loginAs(page, teacher.username, password)
    const path = `/staff/work?q=${student.username}&kind=review&deadline=overdue&readiness=all`
    await gotoApp(page, path)
    const rows = page.getByRole('article')
    await expect(rows).toHaveCount(20)
    await page.getByRole('button', { name: 'التالي', exact: true }).click()
    await expect(rows).toHaveCount(4)
    const pageTwo = page.getByText('الصفحة 2', { exact: true })
    await expect(pageTwo).toBeVisible()
    await rows
      .first()
      .getByRole('button', { name: 'إتمام المراجعة', exact: true })
      .click()
    let dialog = page.getByRole('dialog', {
      name: 'إتمام المراجعة',
      exact: true,
    })
    await expect(dialog).toContainText(student.displayName)
    await expect(dialog).toContainText('الأنبياء')
    await expect(dialog).toContainText('التقييم الحالي: حفظ متقن')
    await expect(
      dialog.getByRole('button', { name: 'حفظ التقييم', exact: true }),
    ).toBeDisabled()
    await dialog.getByRole('radio', { name: 'حفظ متوسط', exact: true }).check()
    // Fail the mutation before sending it; preserve the chosen grade and target.
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
      dialog.getByRole('radio', { name: 'حفظ متوسط', exact: true }),
    ).toBeChecked()
    await expect(dialog).toContainText('الأنبياء')
    await page.unroute('**/_serverFn/**')
    // Keep a retry pending to verify the target cannot be dismissed or submitted twice.
    let requested = 0
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    await page.route('**/_serverFn/**', async (route) => {
      const fn = definition(route.request().url())
      if (fn.includes('reviews.ts') && fn.includes('close')) {
        requested++
        await held
      }
      await route.continue()
    })
    await dialog
      .getByRole('button', { name: 'حفظ والتالي', exact: true })
      .click()
    try {
      await expect.poll(() => requested).toBe(1)
      await expect(
        dialog.getByRole('textbox', {
          name: 'ملاحظات التقييم (اختياري)',
          exact: true,
        }),
      ).toBeDisabled()
      await expect(
        dialog.getByRole('radio', { name: 'حفظ متوسط', exact: true }),
      ).toBeDisabled()
      await expect(
        dialog.getByRole('button', { name: 'حفظ والتالي', exact: true }),
      ).toBeDisabled()
      await page.keyboard.press('Escape')
      await expect(dialog).toBeVisible()
    } finally {
      release()
    }
    await expect(dialog).toContainText('الحج')
    await page.unroute('**/_serverFn/**')
    await expect(
      dialog.getByRole('radio', { name: 'حفظ متوسط', exact: true }),
    ).not.toBeChecked()
    await dialog
      .getByRole('radio', { name: 'الإبقاء على التقييم الحالي', exact: true })
      .check()
    await dialog
      .getByRole('button', { name: 'حفظ التقييم', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(rows).toHaveCount(2)
    await expect(pageTwo).toBeVisible()
    await expect(page).toHaveURL(`http://localhost:3000${path}`)
    await rows
      .first()
      .getByRole('button', { name: 'تعديل الموعد', exact: true })
      .click()
    dialog = page.getByRole('dialog', {
      name: 'تعديل موعد الواجب',
      exact: true,
    })
    await expect(dialog).toContainText(student.displayName)
    await dialog
      .getByRole('button', { name: 'مسح موعد الواجب', exact: true })
      .click()
    // Another teacher changes the deadline after this dialog opened.
    await withDatabase(url, (db) =>
      rescheduleAssignment(db, teacher, 'review', {
        assignmentId: `${student.id}-r23`,
        dueAt: overdue.getTime() - 86400000,
        expectedDueAt: overdue.getTime(),
      }),
    )
    await dialog
      .getByRole('button', { name: 'حفظ الموعد', exact: true })
      .click()
    await expect(dialog).toContainText('تغيّر موعد الواجب')
    await expect(
      dialog.getByLabel('تاريخ استحقاق الواجب', { exact: true }),
    ).toHaveText('دون موعد محدد')
    await dialog
      .getByRole('button', { name: 'إغلاق تعديل الموعد', exact: true })
      .click()
    await page
      .getByRole('button', { name: 'تحديث القائمة', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'تحديث القائمة', exact: true }),
    ).toBeEnabled()
    // The earlier deadline moves this work before page two's cursor; refresh invalidates both pages.
    await expect(rows).toHaveCount(1)
    await page.getByRole('button', { name: 'السابق', exact: true }).click()
    await expect(rows.first()).toContainText('المؤمنون')
    await rows
      .first()
      .getByRole('button', { name: 'تعديل الموعد', exact: true })
      .click()
    dialog = page.getByRole('dialog', {
      name: 'تعديل موعد الواجب',
      exact: true,
    })
    await expect(dialog).toContainText('المؤمنون')
    await dialog
      .getByRole('button', { name: 'مسح موعد الواجب', exact: true })
      .click()
    await dialog
      .getByRole('button', { name: 'حفظ الموعد', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button', { name: 'التالي', exact: true }).click()

    await expect(rows).toHaveCount(1)
    await expect(pageTwo).toBeVisible()
    await rows
      .getByRole('button', { name: 'إلغاء الواجب', exact: true })
      .click()
    dialog = page.getByRole('dialog', { name: 'إلغاء الواجب', exact: true })
    await expect(dialog).toContainText(student.displayName)
    await dialog
      .getByRole('button', { name: 'تأكيد إلغاء الواجب', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(rows).toHaveCount(0)
    await expect(pageTwo).toBeVisible()
    await page.getByRole('button', { name: 'السابق', exact: true }).click()
    await expect(rows).toHaveCount(20)
    await page.getByRole('textbox', { name: 'نوع الواجب', exact: true }).click()
    await page.getByRole('option', { name: 'حفظ جديد', exact: true }).click()
    await expect(rows).toHaveCount(2)
    await rows
      .first()
      .getByRole('button', { name: 'تقييم الحفظ', exact: true })
      .click()
    dialog = page.getByRole('dialog', { name: 'تقييم واجب الحفظ', exact: true })
    await expect(dialog).toContainText(student.displayName)
    await expect(dialog).toContainText('غير مسجّل')
    await expect(
      dialog.getByRole('radio', {
        name: 'الإبقاء على التقييم الحالي',
        exact: true,
      }),
    ).toHaveCount(0)
    await dialog.getByRole('radio', { name: 'حفظ متقن', exact: true }).check()
    await dialog
      .getByRole('button', { name: 'حفظ التقييم', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(rows).toHaveCount(1)
    await rows
      .getByRole('button', { name: 'تعديل الموعد', exact: true })
      .click()
    dialog = page.getByRole('dialog', {
      name: 'تعديل موعد الواجب',
      exact: true,
    })
    await dialog
      .getByRole('button', { name: 'مسح موعد الواجب', exact: true })
      .click()
    await dialog
      .getByRole('button', { name: 'حفظ الموعد', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(rows).toHaveCount(0)
    await page
      .getByRole('textbox', { name: 'موعد الاستحقاق', exact: true })
      .click()
    await page.getByRole('option', { name: 'دون موعد', exact: true }).click()
    await expect(rows).toHaveCount(1)
    await rows
      .getByRole('button', { name: 'إلغاء الواجب', exact: true })
      .click()
    dialog = page.getByRole('dialog', { name: 'إلغاء الواجب', exact: true })
    await page.screenshot({
      path: testInfo.outputPath(`queue-cancel-${width}.png`),
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await dialog
      .getByRole('button', { name: 'تأكيد إلغاء الواجب', exact: true })
      .click()
    await expect(dialog).toHaveCount(0)
    await expect(rows).toHaveCount(0)
    await withDatabase(url, async (db) => {
      const savedReviews = await db
        .select()
        .from(reviews)
        .where(eq(reviews.studentId, student.id))
      expect(savedReviews.find((row) => row.surahNumber === 21)).toMatchObject({
        status: 'closed',
        closingGrade: 'medium',
      })
      expect(savedReviews.find((row) => row.surahNumber === 22)).toMatchObject({
        status: 'closed',
        closingGrade: 'good',
      })
      expect(savedReviews.find((row) => row.surahNumber === 23)).toMatchObject({
        status: 'open',
        dueAt: null,
      })
      expect(savedReviews.find((row) => row.surahNumber === 24)).toMatchObject({
        status: 'cancelled',
        closingGrade: null,
      })
      const savedMemorization = await db
        .select()
        .from(memorizationAssignments)
        .where(eq(memorizationAssignments.studentId, student.id))
      expect(
        savedMemorization.find((row) => row.surahNumber === 100),
      ).toMatchObject({ status: 'closed', closingGrade: 'good' })
      expect(
        savedMemorization.find((row) => row.surahNumber === 101),
      ).toMatchObject({ status: 'cancelled', closingGrade: null, dueAt: null })
      const events = await db
        .select()
        .from(gradeHistory)
        .where(eq(gradeHistory.studentId, student.id))
      expect(events.filter((row) => row.surahNumber === 21)).toHaveLength(2)
      expect(events.filter((row) => row.surahNumber === 22)).toHaveLength(1)
      expect(events.filter((row) => row.surahNumber === 100)).toHaveLength(1)
      expect(events.filter((row) => row.surahNumber === 101)).toHaveLength(0)
      expect(
        (
          await db.select().from(grades).where(eq(grades.studentId, student.id))
        ).find((row) => row.surahNumber === 100)?.grade,
      ).toBe('good')
    })
  })
}
