import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { eq, inArray } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import { reviews } from '../../src/server/db/schema/app'
import { createAccount } from '../../src/server/services/accounts.server'
import { removeGrade, setGrade } from '../../src/server/services/grades.server'
import { assignReview } from '../../src/server/services/reviews.server'
import { gotoApp, loginAs } from './helpers/navigation'
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
  throw new Error('Batch browser fixtures require local PostgreSQL.')
const password = env.DEV_SEED_PASSWORD ?? ''
if (!password)
  throw new Error('Set DEV_SEED_PASSWORD for local batch fixtures.')
const ids: Array<string> = []
const students = new Map<string, string>()
let teacher: Actor, admin: Actor

test.beforeAll(async () => {
  await withDatabase(databaseUrl, async (db) => {
    const prefix = `batch.${Date.now()}`
    teacher = await createAccount(
      db,
      {
        username: `${prefix}.teacher`,
        displayName: 'معلم الدفعة',
        email: null,
        password,
      },
      ['teacher'],
    )
    ids.push(teacher.id)
    admin = await createAccount(
      db,
      {
        username: `${prefix}.admin`,
        displayName: 'مشرف الدفعة',
        email: null,
        password,
      },
      ['admin'],
    )
    ids.push(admin.id)
    for (const key of ['390', '1280', 'race', 'retry']) {
      const student = await createAccount(
        db,
        {
          username: `${prefix}.${key}`,
          displayName: `طالب الدفعة ${key}`,
          email: null,
          password,
        },
        ['student'],
      )
      ids.push(student.id)
      students.set(key, student.id)
      for (const surahNumber of [1, 2, 18, 36])
        await setGrade(db, teacher, {
          studentId: student.id,
          surahNumber,
          grade: 'medium',
        })
      await assignReview(db, teacher, {
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
async function openDrawer(page: Page, key: string) {
  await loginAs(page, teacher.username, password)
  await gotoApp(page, `/staff/students/${students.get(key)}`)
  await page.getByRole('button', { name: 'إسناد مراجعة', exact: true }).click()
  const drawer = page.getByRole('dialog', {
    name: 'إسناد مراجعات',
    exact: true,
  })
  await expect(drawer).toBeVisible()
  return drawer
}
async function selectTwo(drawer: Locator) {
  await expect(drawer.getByRole('checkbox', { name: /البقرة/ })).toHaveCount(0)
  await expect(drawer.getByRole('checkbox', { name: /آل عمران/ })).toHaveCount(
    0,
  )
  await expect(
    drawer.getByRole('button', { name: 'متابعة', exact: true }),
  ).toBeDisabled()
  await drawer.getByRole('textbox', { name: 'البحث في السور' }).fill('الفاتحة')
  await drawer.getByRole('checkbox', { name: /الفاتحة/ }).check()
  await drawer.getByRole('textbox', { name: 'البحث في السور' }).fill('18')
  await drawer.getByRole('button', { name: 'تحديد النتائج المعروضة' }).click()
  await drawer.getByRole('textbox', { name: 'البحث في السور' }).fill('')
  await expect(drawer.getByRole('checkbox', { name: /الفاتحة/ })).toBeChecked()
  await expect(drawer.getByRole('checkbox', { name: /الكهف/ })).toBeChecked()
  await expect(drawer.getByRole('checkbox', { name: /يس/ })).not.toBeChecked()
  await drawer.getByRole('button', { name: 'متابعة', exact: true }).click()
}
for (const width of [390, 1280]) {
  test(`batch selection, shared date and pending state work at ${width}px`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await useUtcDeadlineBoundary(page)
    const drawer = await openDrawer(page, String(width))
    await selectTwo(drawer)
    await drawer.getByRole('button', { name: 'تعديل الاختيار' }).click()
    await expect(drawer.getByRole('checkbox', { name: /الكهف/ })).toBeChecked()
    await drawer.getByRole('button', { name: 'متابعة', exact: true }).click()
    const dueAt = await chooseArabicDeadline(page, drawer)
    await clearDeadline(drawer, 'مسح موعد المراجعة')
    await chooseArabicDeadline(page, drawer)
    if (width === 390)
      await page.screenshot({
        path: testInfo.outputPath('batch-confirmation-mobile.png'),
      })
    let release!: () => void
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const serverFunctions = /_serverFn/
    await page.route(serverFunctions, async (route) => {
      if (
        route.request().method() === 'POST' &&
        route.request().postData()?.includes('surahNumbers')
      )
        await gate
      await route.continue()
    })
    try {
      const request = page.waitForRequest(
        (value) =>
          value.method() === 'POST' &&
          Boolean(value.postData()?.includes('surahNumbers')),
      )
      await drawer.getByRole('button', { name: 'إسناد', exact: true }).click()
      await request
      await expect(
        drawer.getByRole('button', { name: 'إسناد', exact: true }),
      ).toBeDisabled()
      await expect(
        drawer.getByRole('button', { name: 'تعديل الاختيار' }),
      ).toBeDisabled()
      await expect(
        drawer.getByRole('button', { name: 'إغلاق محدد المراجعات' }),
      ).toHaveCount(0)
    } finally {
      release()
    }
    await expect(drawer).not.toBeVisible()
    await page.unroute(serverFunctions)
    await expect(
      page.getByText('تم إسناد المراجعات', { exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('button', { name: 'إغلاق', exact: true }),
    ).toHaveCount(3)
    const rows = await withDatabase(databaseUrl, (db) =>
      db
        .select()
        .from(reviews)
        .where(eq(reviews.studentId, students.get(String(width))!)),
    )
    expect(rows).toHaveLength(3)
    expect(
      rows
        .filter((row) => [1, 18].includes(row.surahNumber))
        .every((row) => row.dueAt?.getTime() === dueAt),
    ).toBe(true)
    expect(rows.find((row) => row.surahNumber === 2)?.dueAt).toBeNull()
    await page
      .getByRole('button', { name: 'إسناد مراجعة', exact: true })
      .click()
    await expect(drawer.getByRole('checkbox')).toHaveCount(1)
    await expect(drawer.getByRole('checkbox', { name: /يس/ })).not.toBeChecked()
    await drawer.getByRole('checkbox', { name: /يس/ }).check()
    await drawer.getByRole('button', { name: 'متابعة', exact: true }).click()
    await chooseArabicDeadline(page, drawer)
    await clearDeadline(drawer, 'مسح موعد المراجعة')
    await drawer.getByRole('button', { name: 'إسناد', exact: true }).click()
    await expect(drawer).not.toBeVisible()
    await withDatabase(databaseUrl, async (db) => {
      const undatedRows = await db
        .select()
        .from(reviews)
        .where(eq(reviews.studentId, students.get(String(width))!))
      expect(
        undatedRows.find((row) => row.surahNumber === 36)?.dueAt,
      ).toBeNull()
    })
  })
}

test('reports a review assigned by another request while confirmation was open', async ({
  page,
}) => {
  const drawer = await openDrawer(page, 'race')
  await selectTwo(drawer)
  await withDatabase(databaseUrl, (db) =>
    assignReview(db, admin, {
      studentId: students.get('race')!,
      surahNumber: 1,
    }),
  )
  await drawer.getByRole('button', { name: 'إسناد', exact: true }).click()
  await expect(drawer).not.toBeVisible()
  await expect(
    page.getByText(/تم تجاوز.*سور لديها مراجعات مفتوحة/),
  ).toBeVisible()
  const rows = await withDatabase(databaseUrl, (db) =>
    db
      .select()
      .from(reviews)
      .where(eq(reviews.studentId, students.get('race')!)),
  )
  expect(rows).toHaveLength(3)
  expect(rows.filter((row) => row.surahNumber === 1)).toHaveLength(1)
})

test('retains selection and date after a real server rejection and can retry', async ({
  page,
}) => {
  const drawer = await openDrawer(page, 'retry')
  await selectTwo(drawer)
  const dueAt = await chooseArabicDeadline(page, drawer)
  const dateText = await drawer
    .getByLabel('تاريخ الاستحقاق (اختياري)', { exact: true })
    .innerText()
  await withDatabase(databaseUrl, (db) =>
    removeGrade(db, admin, {
      studentId: students.get('retry')!,
      surahNumber: 18,
    }),
  )
  await drawer.getByRole('button', { name: 'إسناد', exact: true }).click()
  await expect(drawer.getByRole('alert')).toContainText('لم تُضف أي مراجعات.')
  await expect(drawer.getByText('الفاتحة', { exact: true })).toBeVisible()
  await expect(drawer.getByText('الكهف', { exact: true })).toBeVisible()
  await expect(
    drawer.getByLabel('تاريخ الاستحقاق (اختياري)', { exact: true }),
  ).toHaveText(dateText)
  const before = await withDatabase(databaseUrl, (db) =>
    db
      .select()
      .from(reviews)
      .where(eq(reviews.studentId, students.get('retry')!)),
  )
  expect(before).toHaveLength(1)
  await withDatabase(databaseUrl, (db) =>
    setGrade(db, teacher, {
      studentId: students.get('retry')!,
      surahNumber: 18,
      grade: 'medium',
    }),
  )
  await drawer.getByRole('button', { name: 'إسناد', exact: true }).click()
  await expect(drawer).not.toBeVisible()
  const after = await withDatabase(databaseUrl, (db) =>
    db
      .select()
      .from(reviews)
      .where(eq(reviews.studentId, students.get('retry')!)),
  )
  expect(after).toHaveLength(3)
  expect(
    after
      .filter((row) => [1, 18].includes(row.surahNumber))
      .every((row) => row.dueAt?.getTime() === dueAt),
  ).toBe(true)
})
