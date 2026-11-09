import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { inArray } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import { createAccount } from '../../src/server/services/accounts.server'
import { setGrade } from '../../src/server/services/grades.server'
import { assignReview } from '../../src/server/services/reviews.server'
import { addNote } from '../../src/server/services/notes.server'
import { gotoApp, loginAs, waitForAppReady } from './helpers/navigation'

const env = parseEnv(readFileSync('.env.local', 'utf8'))
const password = process.env.DEV_SEED_PASSWORD ?? env.DEV_SEED_PASSWORD
const databaseUrl = env.DATABASE_URL ?? ''
const target = new URL(databaseUrl)
if (!['localhost', '127.0.0.1'].includes(target.hostname))
  throw new Error('Dashboard browser fixtures require local PostgreSQL.')
if (!password)
  throw new Error('Set DEV_SEED_PASSWORD for local dashboard browser fixtures.')
const ids: Array<string> = []
const usernames = new Map<number, string>()
test.beforeAll(async () => {
  await withDatabase(databaseUrl, async (db) => {
    const prefix = `dash.${Date.now()}`
    const teacher = await createAccount(
      db,
      {
        username: `${prefix}.teacher`,
        displayName: 'معلم لوحة التحكم',
        email: null,
        password,
      },
      ['teacher'],
    )
    ids.push(teacher.id)
    const actor = teacher
    for (const width of [390, 1280]) {
      const username = `${prefix}.${width}`
      const student = await createAccount(
        db,
        { username, displayName: 'طالب لوحة التحكم', email: null, password },
        ['student'],
      )
      ids.push(student.id)
      usernames.set(width, username)
      await setGrade(db, actor, {
        studentId: student.id,
        surahNumber: 1,
        grade: 'medium',
      })
      await assignReview(db, actor, {
        studentId: student.id,
        surahNumber: 1,
        dueAt: Date.UTC(2026, 0, 1),
      })
      await addNote(db, actor, {
        studentId: student.id,
        body: 'واصل المراجعة يومياً.',
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
  test(`student dashboard uses real data and section links at ${width}px`, async ({
    page,
  }) => {
    const errors: Array<string> = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.setViewportSize({ width, height: 844 })
    await loginAs(page, usernames.get(width)!, password)
    await expect(page).toHaveURL('http://localhost:3000/')
    await expect(
      page.getByRole('heading', { name: 'تقدم الحفظ' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'ماذا أراجع اليوم؟' }),
    ).toBeVisible()
    await expect(
      page.getByRole('heading', { name: 'آخر ملاحظات المعلم' }),
    ).toBeVisible()
    await expect(
      page.getByText('واصل المراجعة يومياً.', { exact: true }),
    ).toBeVisible()
    await expect(page.getByText('دروسي', { exact: true })).toHaveCount(0)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true)

    await page.getByRole('link', { name: 'عرض تقييمات السور' }).click()
    await expect(
      page.getByRole('tab', { name: 'السور', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await page.reload()
    await waitForAppReady(page)
    await expect(
      page.getByRole('tab', { name: 'السور', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await page.goBack()
    await waitForAppReady(page)
    await expect(
      page.getByRole('heading', { name: 'تقدم الحفظ' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'الفاتحة', exact: true }).click()
    await expect(page).toHaveURL(/tab=reviews.*#review-/)
    await expect(
      page.getByRole('tab', { name: 'المراجعات', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await expect(page.locator('[id^="review-"]').first()).toBeInViewport()
    await gotoApp(page, '/')
    await page.getByRole('link', { name: 'عرض كل الملاحظات' }).click()
    await expect(
      page.getByRole('tab', { name: 'الملاحظات', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await expect(
      page.getByText('واصل المراجعة يومياً.', { exact: true }),
    ).toBeVisible()
    expect(errors).toEqual([])
  })
}
