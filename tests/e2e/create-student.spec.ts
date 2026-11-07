import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { eq, inArray, like, sql } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { account, user } from '../../src/server/db/schema/auth'
import { createAccount } from '../../src/server/services/accounts.server'
import { gotoApp, loginAs } from './helpers/navigation'
import type { Page } from '@playwright/test'

const env = parseEnv(readFileSync('.env.local', 'utf8'))
const databaseUrl = env.DATABASE_URL ?? ''
if (!['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname))
  throw new Error('Student creation browser fixtures require local PostgreSQL.')
const password = env.DEV_SEED_PASSWORD ?? ''
if (!password) throw new Error('Set DEV_SEED_PASSWORD for local accounts.')
const prefix = `create.${Date.now()}`
const existingEmail = `${prefix}.owner@example.com`
let teacherUsername = ''

test.beforeAll(async () => {
  await withDatabase(databaseUrl, async (db) => {
    const teacher = await createAccount(
      db,
      {
        username: `${prefix}.teacher`,
        displayName: 'معلم الإنشاء',
        email: null,
        password,
      },
      ['teacher'],
    )
    teacherUsername = teacher.username
    await createAccount(
      db,
      {
        username: `${prefix}.existing`,
        displayName: 'طالب موجود',
        email: existingEmail,
        password,
      },
      ['student'],
    )
  })
})
test.afterAll(async () => {
  await withDatabase(databaseUrl, async (db) => {
    await db.delete(user).where(like(user.username, `${prefix}.%`))
  })
})

async function openDrawer(page: Page) {
  await loginAs(page, teacherUsername, password)
  await gotoApp(page, '/staff/students')
  await page.getByRole('button', { name: 'طالب جديد', exact: true }).click()
  const drawer = page.getByRole('dialog', { name: 'إضافة طالب جديد' })
  await expect(drawer).toBeVisible()
  return {
    drawer,
    name: drawer.getByLabel('الاسم الكامل'),
    username: drawer.getByRole('textbox', {
      name: 'اسم المستخدم',
      exact: true,
    }),
    email: drawer.getByLabel('البريد الإلكتروني (اختياري)'),
    password: drawer.getByRole('textbox', {
      name: 'كلمة المرور',
      exact: true,
    }),
    submit: drawer.getByRole('button', { name: 'إنشاء الحساب', exact: true }),
  }
}

for (const width of [390, 1280]) {
  test(`student conflicts stay inside the drawer and allow correction at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 })
    const errors: Array<string> = []
    page.on('pageerror', (error) => errors.push(error.message))
    const usernames = [`${prefix}.fixed.${width}`, `${prefix}.email.${width}`]
    const form = await openDrawer(page)
    await form.name.fill(`Correction ${width}`)
    await form.username.fill(` ${prefix.toUpperCase()}.EXISTING `)
    await form.password.fill(password)
    await form.submit.click()
    await expect(form.drawer.getByRole('alert')).toContainText(
      'اسم المستخدم مستخدم بالفعل. اختر اسم مستخدم آخر.',
    )
    await expect(form.name).toHaveValue(`Correction ${width}`)
    await expect(form.username).toHaveValue(` ${prefix.toUpperCase()}.EXISTING `)
    await expect(form.password).toHaveValue(password)
    await expect(form.submit).toBeEnabled()
    await withDatabase(databaseUrl, async (db) => {
      expect(
        await db.select().from(user).where(eq(user.name, `Correction ${width}`)),
      ).toHaveLength(0)
    })
    await form.username.fill(usernames[0])
    await form.submit.click()
    await expect(form.drawer).not.toBeVisible()
    await expect(
      page.getByText(`Correction ${width}`, { exact: true }),
    ).toBeVisible()

    await page.getByRole('button', { name: 'طالب جديد', exact: true }).click()
    await expect(form.drawer.getByRole('alert')).toHaveCount(0)
    await expect(form.name).toHaveValue('')
    await expect(form.username).toHaveValue('')
    await expect(form.password).toHaveValue('')
    await form.name.fill(`Email correction ${width}`)
    await form.username.fill(usernames[1])
    await form.email.fill(existingEmail.toUpperCase())
    await form.password.fill(password)
    await form.submit.click()
    await expect(form.drawer.getByRole('alert')).toContainText(
      'البريد الإلكتروني مستخدم بالفعل. أدخل بريدًا آخر أو اتركه فارغًا.',
    )
    await expect(form.email).toHaveValue(existingEmail.toUpperCase())
    await expect(form.username).toHaveValue(usernames[1])
    await expect(form.password).toHaveValue(password)
    await form.email.fill('')
    await form.submit.click()
    await expect(form.drawer).not.toBeVisible()
    await expect(
      page.getByText(`Email correction ${width}`, { exact: true }),
    ).toBeVisible()
    await withDatabase(databaseUrl, async (db) => {
      const created = await db
        .select()
        .from(user)
        .where(inArray(user.username, usernames))
      expect(created).toHaveLength(2)
      expect(
        await db
          .select()
          .from(account)
          .where(
            inArray(
              account.userId,
              created.map((row) => row.id),
            ),
          ),
      ).toHaveLength(2)
    })
    expect(errors).toEqual([])
  })
}

test('unexpected database rejection is sanitized inside the drawer and dismissal resets errors', async ({
  page,
}) => {
  const errors: Array<string> = []
  page.on('pageerror', (error) => errors.push(error.message))
  const rejected = `${prefix}.rejected`
  await withDatabase(databaseUrl, (db) =>
    db.execute(
      sql.raw(
        `alter table "user" add constraint qa_private_creation_detail check (username <> '${rejected}')`,
      ),
    ),
  )
  try {
    const form = await openDrawer(page)
    await form.name.fill('Rejected student')
    await form.username.fill(rejected)
    await form.password.fill(password)
    await form.submit.click()
    const alert = form.drawer.getByRole('alert')
    await expect(alert).toContainText('تعذر إتمام العملية. حاول مرة أخرى.')
    await expect(alert).not.toContainText(
      /qa_private_creation_detail|insert into|23514/,
    )
    await expect(form.name).toHaveValue('Rejected student')
    await expect(form.username).toHaveValue(rejected)
    await withDatabase(databaseUrl, async (db) => {
      expect(
        await db.select().from(user).where(eq(user.username, rejected)),
      ).toHaveLength(0)
    })
    await form.drawer
      .getByRole('button', { name: 'إغلاق إضافة طالب', exact: true })
      .click()
    await expect(form.drawer).not.toBeVisible()
    await expect(page.getByRole('alert')).toHaveCount(0)
    await page.getByRole('button', { name: 'طالب جديد', exact: true }).click()
    await expect(form.drawer.getByRole('alert')).toHaveCount(0)
    await expect(form.name).toHaveValue('')
    await expect(form.password).toHaveValue('')
    expect(errors).toEqual([])
  } finally {
    await withDatabase(databaseUrl, (db) =>
      db.execute(
        sql`alter table "user" drop constraint if exists qa_private_creation_detail`,
      ),
    )
  }
})
