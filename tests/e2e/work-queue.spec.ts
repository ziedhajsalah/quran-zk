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
function rpcDefinition(requestUrl: string) {
  const encoded = new URL(requestUrl).pathname.split('/').at(-1) ?? ''
  return Buffer.from(decodeURIComponent(encoded), 'base64url').toString()
}
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
    await page.emulateMedia({ colorScheme: width === 1280 ? 'dark' : 'light' })
    await loginAs(page, teacher.username, password)
    await page
      .getByRole('link', { name: 'قائمة الواجبات', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: 'قائمة الواجبات', exact: true }),
    ).toBeVisible()
    await page.getByLabel('البحث عن طالب').fill(student.username)
    let searchRequested = false
    let releaseSearch!: () => void
    const searchHeld = new Promise<void>((resolve) => {
      releaseSearch = resolve
    })
    const navigationEndpoint = '**/_serverFn/**'
    await page.route(navigationEndpoint, async (route) => {
      if (rpcDefinition(route.request().url()).includes('fetchAppSession')) {
        searchRequested = true
        await searchHeld
      }
      await route.continue()
    })
    const submitting = page
      .getByRole('button', { name: 'بحث', exact: true })
      .click()
    try {
      await expect.poll(() => searchRequested).toBe(true)
      await expect(
        page.getByRole('textbox', { name: 'نوع الواجب', exact: true }),
      ).toBeDisabled()
      await expect(
        page.getByRole('button', { name: 'التالي', exact: true }),
      ).toBeDisabled()
    } finally {
      releaseSearch()
    }
    await submitting
    await expect
      .poll(() => new URL(page.url()).searchParams.get('q'))
      .toBe(student.username)
    await page.unroute(navigationEndpoint)
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
    await page.screenshot({
      path: testInfo.outputPath(
        width === 390 ? 'work-queue-mobile.png' : 'work-queue-dark.png',
      ),
      fullPage: true,
    })
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    // Hold the lazy memorization read to expose hash scrolling before data mounts.
    let requested = false
    let release!: () => void
    const held = new Promise<void>((resolve) => {
      release = resolve
    })
    const endpoint = '**/_serverFn/**'
    await page.route(endpoint, async (route) => {
      const encoded =
        new URL(route.request().url()).pathname.split('/').at(-1) ?? ''
      const definition = Buffer.from(
        decodeURIComponent(encoded),
        'base64url',
      ).toString()
      if (
        definition.includes('memorization.ts') &&
        definition.includes('listOpenForStudent')
      ) {
        requested = true
        await held
      }
      await route.continue()
    })
    const opening = rows.getByRole('link', { name: 'فتح الواجب' }).click()
    try {
      await expect.poll(() => requested).toBe(true)
      await expect(
        page.getByRole('heading', { name: 'واجبات الحفظ الجديد', exact: true }),
      ).toBeVisible()
    } finally {
      release()
    }
    await opening
    await expect(page).toHaveURL(
      new RegExp(`tab=memorization#memorization-${student.id}-m3$`),
    )
    const linked = page.locator(`[id="memorization-${student.id}-m3"]`)
    await expect(linked).toBeVisible()
    await expect(linked).toBeInViewport()
    await page.unroute(endpoint)
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

test('server-rendered search preserves filters without JavaScript and inactive controls are disabled', async ({
  page,
  browser,
}) => {
  await loginAs(page, teacher.username, password)
  const context = await browser.newContext({
    javaScriptEnabled: false,
    storageState: await page.context().storageState(),
  })
  try {
    const native = await context.newPage()
    const student = fixtures.get(1280)!
    await native.goto(
      `/staff/work?q=${student.username}&kind=memorization&deadline=all&readiness=not-ready`,
    )
    await expect(native.getByRole('article').first()).toBeVisible()
    await expect(
      native
        .getByRole('article')
        .first()
        .getByRole('button', { name: 'تقييم الحفظ', exact: true }),
    ).toBeDisabled()
    await expect(
      native
        .getByRole('article')
        .first()
        .getByRole('button', { name: 'تعديل الموعد', exact: true }),
    ).toBeDisabled()
    await expect(
      native
        .getByRole('article')
        .first()
        .getByRole('button', { name: 'إلغاء الواجب', exact: true }),
    ).toBeDisabled()
    await expect(
      native.getByRole('textbox', { name: 'نوع الواجب', exact: true }),
    ).toBeDisabled()
    await native.getByLabel('البحث عن طالب').fill('no-matching-native-search')
    await native.getByRole('button', { name: 'بحث', exact: true }).click()
    const address = new URL(native.url())
    expect(address.searchParams.get('q')).toBe('no-matching-native-search')
    expect(address.searchParams.get('kind')).toBe('memorization')
    expect(address.searchParams.get('deadline')).toBe('all')
    expect(address.searchParams.get('readiness')).toBe('not-ready')
    await expect(
      native.getByText('لا توجد واجبات تطابق البحث والفلاتر.'),
    ).toBeVisible()
    await native.goto(`/staff/students/${student.id}?tab=memorization`)
    await expect(
      native.getByRole('heading', { name: student.displayName, exact: true }),
    ).toBeVisible()
    await expect(native.locator('article button:enabled')).toHaveCount(0)
    await expect(
      native.getByRole('button', { name: 'إسناد حفظ جديد', exact: true }),
    ).toBeDisabled()
  } finally {
    await context.close()
  }
})

test('memorization errors stay in the panel, retry works and ordinary grading refreshes the queue', async ({
  page,
}) => {
  const student = fixtures.get(1280)!
  await loginAs(page, teacher.username, password)
  await gotoApp(
    page,
    `/staff/work?q=${student.username}&kind=memorization&deadline=overdue`,
  )
  await expect(page.getByRole('article')).toHaveCount(1)
  const endpoint = '**/_serverFn/**'
  await page.route(endpoint, async (route) => {
    const definition = rpcDefinition(route.request().url())
    if (
      definition.includes('memorization.ts') &&
      definition.includes('listOpenForStudent')
    )
      await route.abort()
    else await route.continue()
  })
  await page.getByRole('link', { name: 'فتح الواجب', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: student.displayName, exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText('تعذر تحميل واجبات الحفظ', { exact: true }),
  ).toBeVisible({ timeout: 20000 })
  await expect(
    page.getByRole('tab', { name: 'السور', exact: true }),
  ).toBeEnabled()
  await page.unroute(endpoint)
  await page
    .getByRole('button', { name: 'إعادة المحاولة', exact: true })
    .click()
  await expect(
    page.locator(`[id="memorization-${student.id}-m0"]`),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'السور', exact: true }).click()
  await page.getByRole('button', { name: 'إضافة سورة', exact: true }).click()
  await page.getByRole('button', { name: /الروم/ }).click()
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'إضافة سورة', exact: true }),
  ).toHaveCount(0)
  await page.goBack()
  await expect(page).toHaveURL(/\/staff\/work\?/)
  await expect(
    page.getByText('لا توجد واجبات تطابق البحث والفلاتر.'),
  ).toBeVisible()
})
