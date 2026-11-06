import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { inArray } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import { reviews } from '../../src/server/db/schema/app'
import { createAccount } from '../../src/server/services/accounts.server'
import { setGrade } from '../../src/server/services/grades.server'
import { assignReview } from '../../src/server/services/reviews.server'
import type { Page } from '@playwright/test'

test.use({ timezoneId: 'America/Los_Angeles' })
const env = parseEnv(readFileSync('.env.local', 'utf8'))
const databaseUrl = env.DATABASE_URL ?? ''
if (!['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname))
  throw new Error('History browser fixtures require local PostgreSQL.')
const password = env.DEV_SEED_PASSWORD ?? ''
if (!password)
  throw new Error('Set DEV_SEED_PASSWORD for local history fixtures.')
const ids: Array<string> = []
let teacherName: string, studentName: string, liveStudentId: string
let studentId: string
const closedAt = Date.UTC(2026, 10, 6)

test.beforeAll(async () => {
  await withDatabase(databaseUrl, async (db) => {
    const prefix = `history.${Date.now()}`
    teacherName = `${prefix}.teacher`
    studentName = `${prefix}.student`
    const teacher = await createAccount(
      db,
      {
        username: teacherName,
        displayName: 'معلم السجل',
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
        displayName: 'طالب السجل',
        email: null,
        password,
      },
      ['student'],
    )
    ids.push(student.id)
    studentId = student.id
    const liveStudent = await createAccount(
      db,
      {
        username: `${prefix}.live`,
        displayName: 'طالب سجل مباشر',
        email: null,
        password,
      },
      ['student'],
    )
    ids.push(liveStudent.id)
    liveStudentId = liveStudent.id
    await setGrade(db, teacher, {
      studentId: student.id,
      surahNumber: 1,
      grade: 'good',
    })
    await db.insert(reviews).values(
      Array.from({ length: 24 }, (_, i) => ({
        id: `${prefix}-history-${String(i).padStart(2, '0')}`,
        studentId: student.id,
        surahNumber: 1,
        assignedAt: new Date(closedAt - 86400000 * 3),
        dueAt: new Date(closedAt),
        closedAt: new Date(closedAt - i * 86400000),
        status: i === 23 ? ('cancelled' as const) : ('closed' as const),
        closingGrade: i === 23 ? null : ('medium' as const),
      })),
    )
    // A different student's record must never appear in the self history view.
    await db.insert(reviews).values({
      id: `${prefix}-private`,
      studentId: liveStudent.id,
      surahNumber: 114,
      assignedAt: new Date(closedAt),
      closedAt: new Date(closedAt),
      status: 'cancelled',
    })
    for (const surahNumber of [1, 2]) {
      await setGrade(db, teacher, {
        studentId: liveStudent.id,
        surahNumber,
        grade: 'forgotten',
      })
      await assignReview(db, teacher, {
        studentId: liveStudent.id,
        surahNumber,
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
async function login(page: Page, username: string) {
  await page.goto('/login')
  await page.getByLabel('البريد الإلكتروني أو اسم المستخدم').fill(username)
  await page.getByLabel('كلمة المرور').fill(password)
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click()
  await expect(page).toHaveURL('http://localhost:3000/')
}

for (const width of [390, 1280]) {
  test(`student history filters and pagination work at ${width}px west of UTC`, async ({
    page,
  }) => {
    const errors: Array<string> = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 844 })
    await login(page, studentName)
    await page.goto('/surahs?tab=history')
    await expect(
      page.getByRole('tab', { name: 'السجل', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('article')).toHaveCount(20)
    const date = new Intl.DateTimeFormat('ar', {
      dateStyle: 'medium',
      timeZone: 'UTC',
    }).format(closedAt)
    await expect(
      page
        .getByRole('article')
        .first()
        .getByText(`أُنجزت في: ${date}`, { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('article').first().getByText('حفظ متوسط', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('الناس', { exact: true })).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    if (width === 390)
      await page.screenshot({
        path: '/private/tmp/quran-review-history-mobile.png',
        fullPage: false,
      })
    await page.getByRole('button', { name: 'الأقدم', exact: true }).click()
    await expect(page.getByRole('article')).toHaveCount(4)
    await expect(
      page.getByRole('button', { name: 'الأقدم', exact: true }),
    ).toBeDisabled()
    await page.getByRole('button', { name: 'الأحدث', exact: true }).click()
    await expect(page.getByRole('article')).toHaveCount(20)
    await page
      .getByRole('textbox', { name: 'حالة المراجعة', exact: true })
      .click()
    await page.getByRole('option', { name: 'ملغاة', exact: true }).click()
    await expect(page.getByRole('article')).toHaveCount(1)
    await expect(
      page.getByText('التقييم عند الإغلاق:', { exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: 'الأحدث', exact: true }),
    ).toBeDisabled()
    await page
      .getByRole('textbox', { name: 'حالة المراجعة', exact: true })
      .click()
    await page.getByRole('option', { name: 'مكتملة', exact: true }).click()
    await expect(page.getByRole('article')).toHaveCount(20)
    await page.getByRole('button', { name: 'الأقدم', exact: true }).click()
    await expect(page.getByRole('article')).toHaveCount(3)
    await page.reload()
    await expect(
      page.getByRole('tab', { name: 'السجل', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByRole('article')).toHaveCount(20)
    expect(errors).toEqual([])
  })
}

test('staff see the same saved grade and fresh close/cancel records without losing history', async ({
  page,
}) => {
  await login(page, teacherName)
  await page.goto(`/staff/students/${studentId}?tab=history`)
  await expect(page.getByRole('article')).toHaveCount(20)
  await expect(
    page.getByRole('article').first().getByText('حفظ متوسط', { exact: true }),
  ).toBeVisible()
  await page.goto(`/staff/students/${liveStudentId}?tab=history`)
  await expect(page.getByRole('article')).toHaveCount(1)
  await page.getByRole('tab', { name: 'المراجعات', exact: true }).click()
  await page.getByRole('button', { name: 'إغلاق', exact: true }).first().click()
  await page.getByText('حفظ متقن', { exact: true }).click()
  await page.getByRole('button', { name: 'تأكيد الإغلاق', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'إغلاق', exact: true }),
  ).toHaveCount(1)
  await page.getByRole('tab', { name: 'السجل', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(page.getByText('حفظ متقن', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'المراجعات', exact: true }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'إغلاق', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('tab', { name: 'السجل', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(3)
  await page
    .getByRole('textbox', { name: 'حالة المراجعة', exact: true })
    .click()
  await page.getByRole('option', { name: 'ملغاة', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(2)
})
