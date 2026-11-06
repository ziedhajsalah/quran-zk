import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { inArray } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import { createAccount } from '../../src/server/services/accounts.server'
import { setGrade } from '../../src/server/services/grades.server'
import { assignReview } from '../../src/server/services/reviews.server'

const env = parseEnv(readFileSync('.env.local', 'utf8'))
const databaseUrl = env.DATABASE_URL ?? ''
if (!['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname))
  throw new Error('Dashboard browser fixtures require local PostgreSQL.')
const password = env.DEV_SEED_PASSWORD
if (!password)
  throw new Error('Set DEV_SEED_PASSWORD for local dashboard fixtures.')
const ids: Array<string> = []
let teacherName: string
let adminName: string
const students = new Map<number, string>()
test.beforeAll(async () => {
  await withDatabase(databaseUrl, async (db) => {
    const prefix = `staffdash.${Date.now()}`
    teacherName = `${prefix}.teacher`
    adminName = `${prefix}.admin`
    const teacher = await createAccount(
      db,
      {
        username: teacherName,
        displayName: 'معلم المتابعة',
        email: null,
        password,
      },
      ['teacher', 'student'],
    )
    ids.push(teacher.id)
    const admin = await createAccount(
      db,
      {
        username: adminName,
        displayName: 'مشرف المتابعة',
        email: null,
        password,
      },
      ['admin'],
    )
    ids.push(admin.id)
    const date = new Date()
    const today = Date.UTC(
      date.getUTCFullYear(),
      date.getUTCMonth(),
      date.getUTCDate(),
    )
    for (const width of [390, 1280]) {
      const username = `${prefix}.${width}`
      const student = await createAccount(
        db,
        {
          username,
          displayName: `طالب المتابعة ${width}`,
          email: null,
          password,
        },
        ['student'],
      )
      ids.push(student.id)
      students.set(width, username)
      await setGrade(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'forgotten',
      })
      await assignReview(db, teacher, {
        studentId: student.id,
        surahNumber: 1,
        dueAt: today - 86400000 * 2,
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

for (const width of [390, 1280]) {
  test(`staff attention links and mutation refresh work at ${width}px`, async ({
    page,
  }) => {
    const errors: Array<string> = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/login')
    await page.getByLabel('البريد الإلكتروني أو اسم المستخدم').fill(teacherName)
    await page.getByLabel('كلمة المرور').fill(password)
    await page
      .getByRole('button', { name: 'تسجيل الدخول', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'متابعة الطلاب', exact: true }),
    ).toBeVisible()
    const card = page
      .getByRole('article')
      .filter({ hasText: `@${students.get(width)}` })
    await expect(card).toBeVisible()
    await expect(card.getByText(/مراجعات متأخرة/)).toBeVisible()
    await expect(card.getByText(/سور تحتاج مراجعة/)).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)
    if (width === 390)
      await page.screenshot({
        path: '/private/tmp/quran-teacher-dashboard-mobile.png',
        fullPage: true,
      })
    await card
      .getByRole('link', { name: 'ملاحظات الطالب', exact: true })
      .click()
    await expect(
      page.getByRole('tab', { name: 'الملاحظات', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await page.reload()
    await expect(
      page.getByRole('tab', { name: 'الملاحظات', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('link', { name: 'الرئيسية', exact: true }).click()
    await card.getByRole('link', { name: 'تقييمات السور', exact: true }).click()
    await expect(
      page.getByRole('tab', { name: 'السور', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await expect(page.getByText('يحتاج مراجعة', { exact: true })).toBeVisible()
    await page.getByRole('link', { name: 'الرئيسية', exact: true }).click()
    await card
      .getByRole('link', { name: 'مراجعات الطالب', exact: true })
      .click()
    await expect(
      page.getByRole('tab', { name: 'المراجعات', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await page.getByRole('button', { name: 'إغلاق', exact: true }).click()
    await page.getByText('حفظ متقن', { exact: true }).click()
    await page
      .getByRole('button', { name: 'تأكيد الإغلاق', exact: true })
      .click()
    await expect(
      page.getByRole('button', { name: 'إغلاق', exact: true }),
    ).toHaveCount(0)
    await page.getByRole('link', { name: 'الرئيسية', exact: true }).click()
    await expect(card).toHaveCount(0)
    expect(errors).toEqual([])
  })
}

test('admins see the staff dashboard and students retain their private dashboard', async ({
  page,
  browser,
}) => {
  await page.goto('/login')
  await page.getByLabel('البريد الإلكتروني أو اسم المستخدم').fill(adminName)
  await page.getByLabel('كلمة المرور').fill(password)
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'متابعة الطلاب', exact: true }),
  ).toBeVisible()
  const studentContext = await browser.newContext()
  try {
    const student = await studentContext.newPage()
    await student.goto('/login')
    await student
      .getByLabel('البريد الإلكتروني أو اسم المستخدم')
      .fill(students.get(390)!)
    await student.getByLabel('كلمة المرور').fill(password)
    await student
      .getByRole('button', { name: 'تسجيل الدخول', exact: true })
      .click()
    await expect(
      student.getByRole('heading', { name: 'تقدم الحفظ', exact: true }),
    ).toBeVisible()
    await expect(
      student.getByRole('heading', { name: 'متابعة الطلاب', exact: true }),
    ).toHaveCount(0)
    await student.goto('/staff/students')
    await expect(student).toHaveURL('http://localhost:3000/')
  } finally {
    await studentContext.close()
  }
})
