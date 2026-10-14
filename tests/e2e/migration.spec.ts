import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const password =
  process.env.DEV_SEED_PASSWORD ??
  readFileSync('.env.local', 'utf8').match(/^DEV_SEED_PASSWORD=(.+)$/m)?.[1]
if (!password)
  throw new Error('Set DEV_SEED_PASSWORD for the seeded local accounts.')
async function goto(page: Page, path: string) {
  await page.goto(path)
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true')
}
async function login(page: Page, username: string) {
  await goto(page, '/login')
  await page.getByLabel('البريد الإلكتروني أو اسم المستخدم').fill(username)
  await page.getByLabel('كلمة المرور').fill(password!)
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click()
  await expect(page).toHaveURL('http://localhost:3000/')
}

test('anonymous redirects, disabled signup, and local-only redirect validation', async ({
  page,
  request,
}) => {
  await goto(page, '/staff/students')
  await expect(page).toHaveURL(/\/login/)
  const response = await request.post('/api/auth/sign-up/email', {
    data: { name: 'public', email: 'public@example.com', password },
    headers: { origin: 'http://localhost:3000' },
  })
  expect(response.status()).toBeGreaterThanOrEqual(400)
  const adminApi = await request.post('/api/auth/admin/create-user', {
    data: {},
  })
  expect(adminApi.status()).toBe(404)
  await goto(page, '/login?redirect=%2F%2Fevil.example')
  await expect(
    page.getByRole('heading', { name: 'تسجيل الدخول', exact: true }),
  ).toBeVisible()
})

test('teacher and student flows work with SQL, no old backend network or hydration errors', async ({
  browser,
}) => {
  const staffContext = await browser.newContext()
  const studentContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  })
  const staff = await staffContext.newPage()
  const student = await studentContext.newPage()
  const errors: Array<string> = []
  const forbiddenRequests: Array<string> = []
  for (const page of [staff, student]) {
    page.on('pageerror', (error) => errors.push(error.message))
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('request', (request) => {
      if (/convex\.(cloud|site)/.test(request.url()))
        forbiddenRequests.push(request.url())
    })
  }
  await login(staff, 'qa.teacher.oct13')
  await goto(staff, '/staff/students')
  await expect(staff.getByText('طالب الاختبار', { exact: true })).toBeVisible()
  await staff.getByText('طالب الاختبار', { exact: true }).click()
  await expect(
    staff.getByRole('heading', { name: 'طالب الاختبار', exact: true }),
  ).toBeVisible()
  await staff.getByRole('tab', { name: 'الملاحظات', exact: true }).click()
  await staff.getByRole('button', { name: /إضافة ملاحظة/ }).click()
  const body = `ملاحظة الترحيل ${Date.now()}`
  await staff.getByRole('textbox').fill(body)
  await staff.getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect(staff.getByText(body, { exact: true })).toBeVisible()
  await login(student, 'qa.student.oct13')
  await goto(student, '/surahs')
  await student.getByRole('tab', { name: 'الملاحظات', exact: true }).click()
  await expect(student.getByText(body, { exact: true })).toBeVisible()
  expect(
    await student.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
  await goto(student, '/staff/students')
  await expect(student).toHaveURL('http://localhost:3000/')
  await goto(student, '/profile')
  await expect(
    student.getByText('@qa.student.oct13', { exact: true }).first(),
  ).toBeVisible()
  await student.getByRole('button', { name: 'تسجيل الخروج' }).click()
  await expect(student).toHaveURL(/\/login/)
  await goto(student, '/surahs')
  await expect(student).toHaveURL(/\/login/)
  expect(forbiddenRequests).toEqual([])
  expect(errors).toEqual([])
  await staffContext.close()
  await studentContext.close()
})

test('admin-issued reset works signed out, revokes sessions and rejects replay', async ({
  browser,
}) => {
  const context = await browser.newContext()
  const admin = await context.newPage()
  await login(admin, 'qa.admin.oct13')
  await goto(admin, '/admin/reset-password')
  await admin
    .getByLabel('البريد الإلكتروني أو اسم المستخدم')
    .fill('qa.student.oct13')
  await admin.getByRole('button', { name: 'إصدار الرمز', exact: true }).click()
  await expect(admin.getByText('تم إصدار الرمز', { exact: true })).toBeVisible()
  const code = await admin
    .locator('p')
    .filter({ hasText: /^\d{6}$/ })
    .innerText()
  const studentContext = await browser.newContext()
  const student = await studentContext.newPage()
  await login(student, 'qa.student.oct13')
  const publicContext = await browser.newContext()
  const reset = await publicContext.newPage()
  const resetConsoleErrors: Array<string> = []
  reset.on('console', (message) => {
    if (message.type() === 'error') resetConsoleErrors.push(message.text())
  })
  await goto(reset, '/reset-password')
  await reset
    .getByLabel('البريد الإلكتروني أو اسم المستخدم')
    .fill('qa.student.oct13')
  await reset.getByLabel('رمز إعادة التعيين').fill(code)
  await reset.getByLabel('كلمة المرور الجديدة').fill(password)
  await reset.getByLabel('تأكيد كلمة المرور').fill(password)
  await reset.getByRole('button', { name: 'حفظ كلمة المرور' }).click()
  await expect(reset).toHaveURL(/reason=passwordReset/)
  await goto(student, '/profile')
  await expect(student).toHaveURL(/\/login/)
  await login(reset, 'qa.student.oct13')
  await goto(reset, '/reset-password')
  await reset
    .getByLabel('البريد الإلكتروني أو اسم المستخدم')
    .fill('qa.student.oct13')
  await reset.getByLabel('رمز إعادة التعيين').fill(code)
  await reset.getByLabel('كلمة المرور الجديدة').fill(password)
  await reset.getByLabel('تأكيد كلمة المرور').fill(password)
  await reset.getByRole('button', { name: 'حفظ كلمة المرور' }).click()
  await expect(
    reset.getByText('رمز غير صالح أو منتهي.', { exact: true }),
  ).toBeVisible()
  expect(resetConsoleErrors).toEqual([])
  await context.close()
  await studentContext.close()
  await publicContext.close()
})

test('teacher creates a student, grades a surah, closes and cancels reviews, and edits/deletes a note', async ({
  page,
}) => {
  const username = `qa.e2e.${Date.now()}`
  const displayName = `طالب ترحيل ${Date.now()}`
  await login(page, 'qa.teacher.oct13')
  await goto(page, '/staff/students')
  await page.getByRole('button', { name: 'طالب جديد', exact: true }).click()
  await page.getByLabel('الاسم الكامل').fill(displayName)
  await page.getByLabel('اسم المستخدم', { exact: false }).fill(username)
  await page.getByLabel('كلمة المرور').fill(password)
  const pendingMutation = page.waitForRequest(
    (request) =>
      request.method() === 'POST' && request.url().includes('_serverFn'),
  )
  await page.getByRole('button', { name: 'إنشاء الحساب' }).click()
  const mutation = await pendingMutation
  await expect(page.getByText(displayName, { exact: true })).toBeVisible()
  const wrongMethod = await page.request.get(mutation.url(), {
    headers: { 'x-tsr-serverFn': 'true' },
  })
  expect(wrongMethod.status()).toBe(405)
  const wrongOrigin = await page.request.post(mutation.url(), {
    data: mutation.postData()!,
    headers: {
      'content-type': 'application/json',
      'x-tsr-serverFn': 'true',
      origin: 'https://untrusted.example',
    },
  })
  expect(await wrongOrigin.text()).toContain('غير مصرح لك بهذه العملية.')
  await expect(page.getByText(displayName, { exact: true })).toBeVisible()
  await page.getByText(displayName, { exact: true }).click()
  await expect(
    page.getByRole('heading', { name: displayName, exact: true }),
  ).toBeVisible()
  await page.getByRole('tab', { name: 'السور', exact: true }).click()
  await page.getByRole('button', { name: 'إضافة سورة', exact: true }).click()
  await page.getByRole('button', { name: /الفاتحة/ }).click()
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect(page.getByText('الفاتحة', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'المراجعات', exact: true }).click()
  await page.getByRole('button', { name: 'إسناد مراجعة', exact: true }).click()
  await page.getByRole('button', { name: /الفاتحة/ }).click()
  await page.getByRole('button', { name: 'إسناد', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'إغلاق', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'إغلاق', exact: true }).click()
  await page.getByText('حفظ متوسط', { exact: true }).click()
  await page.getByRole('button', { name: 'تأكيد الإغلاق' }).click()
  await expect(
    page.getByRole('button', { name: 'إغلاق', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('tab', { name: 'السور', exact: true }).click()
  await expect(page.getByText('حفظ متوسط', { exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'المراجعات', exact: true }).click()
  await page.getByRole('button', { name: 'إسناد مراجعة', exact: true }).click()
  await page.getByRole('button', { name: /الفاتحة/ }).click()
  await page.getByRole('button', { name: 'إسناد', exact: true }).click()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'إلغاء', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'إغلاق', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('tab', { name: 'الملاحظات', exact: true }).click()
  await page.getByRole('button', { name: 'إضافة ملاحظة', exact: true }).click()
  await page.getByRole('textbox').fill('ملاحظة مؤقتة')
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect(page.getByText('ملاحظة مؤقتة', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'خيارات', exact: true }).click()
  await page.getByRole('menuitem', { name: 'تعديل', exact: true }).click()
  await page.getByRole('textbox').fill('ملاحظة معدلة')
  await page.getByRole('button', { name: 'حفظ', exact: true }).click()
  await expect(page.getByText('ملاحظة معدلة', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'خيارات', exact: true }).click()
  await page.getByRole('menuitem', { name: 'حذف', exact: true }).click()
  await page.getByRole('button', { name: 'حذف', exact: true }).click()
  await expect(page.getByText('ملاحظة معدلة', { exact: true })).toHaveCount(0)
})

test('session cookie attributes, origin rejection and logout revocation', async ({
  page,
  baseURL,
}) => {
  const origin = baseURL!
  await login(page, 'qa.student.oct13')
  const cookie = (await page.context().cookies()).find((value) =>
    value.name.includes('session_token'),
  )
  expect(cookie).toBeDefined()
  expect(cookie!.secure).toBe(origin.startsWith('https:'))
  expect(cookie!.httpOnly).toBe(true)
  expect(cookie!.sameSite).toBe('Lax')
  const headers = { cookie: `${cookie!.name}=${cookie!.value}` }
  const before = await page.request.get('/api/auth/get-session', { headers })
  expect((await before.json()).user).toBeTruthy()
  const foreign = await page.request.post('/api/auth/sign-in/username', {
    headers: { origin: 'https://untrusted.example' },
    data: { username: 'qa.student.oct13', password },
  })
  expect(foreign.status()).toBe(403)
  await goto(page, '/profile')
  await page.getByRole('button', { name: 'تسجيل الخروج' }).click()
  await expect(page).toHaveURL(/\/login/)
  const after = await page.request.get('/api/auth/get-session', { headers })
  expect(await after.json()).toBeNull()
})
