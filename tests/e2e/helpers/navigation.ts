import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'

export async function waitForAppReady(page: Page) {
  // Server-rendered controls can be visible before React attaches handlers.
  await expect(page.locator('body')).toHaveAttribute('data-app-ready', 'true')
}

export async function gotoApp(page: Page, path: string) {
  await page.goto(path)
  await waitForAppReady(page)
}

export async function loginAs(page: Page, username: string, password: string) {
  await gotoApp(page, '/login')
  await page.getByLabel('البريد الإلكتروني أو اسم المستخدم').fill(username)
  await page.getByLabel('كلمة المرور').fill(password)
  await page.getByRole('button', { name: 'تسجيل الدخول', exact: true }).click()
  // Login navigates to a new document; do not accept the old login page's ready flag.
  await expect(page).toHaveURL('http://localhost:3000/')
  await waitForAppReady(page)
}
