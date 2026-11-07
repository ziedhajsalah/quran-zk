import { readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'
import { expect, test } from '@playwright/test'
import { inArray } from 'drizzle-orm'
import { withDatabase } from '../../src/server/db.server'
import { user } from '../../src/server/db/schema/auth'
import { createAccount } from '../../src/server/services/accounts.server'
import { contrastRatio } from '../contrast'
import { gotoApp, loginAs } from './helpers/navigation'
import type { Locator } from '@playwright/test'

const env = parseEnv(readFileSync('.env.local', 'utf8'))
const databaseUrl = env.DATABASE_URL ?? ''
if (!['localhost', '127.0.0.1'].includes(new URL(databaseUrl).hostname))
  throw new Error('Contrast browser tests require local PostgreSQL.')
const password = env.DEV_SEED_PASSWORD
if (!password) throw new Error('Set DEV_SEED_PASSWORD for local fixtures.')
const schemes = ['light', 'dark'] as const
const widths = [390, 1280]
const ids: Array<string> = []
const teachers = new Map<string, string>()
let studentName: string

// One account per test keeps logins below the per-account sign-in limit.
test.beforeAll(async () => {
  await withDatabase(databaseUrl, async (db) => {
    const prefix = `contrast.${Date.now().toString(36)}`
    studentName = `${prefix}.student`
    const student = await createAccount(
      db,
      {
        username: studentName,
        displayName: 'طالب التباين',
        email: null,
        password,
      },
      ['student'],
    )
    ids.push(student.id)
    for (const scheme of schemes)
      for (const width of widths) {
        const username = `${prefix}.${scheme}.${width}`
        const teacher = await createAccount(
          db,
          { username, displayName: 'معلم التباين', email: null, password },
          ['teacher'],
        )
        ids.push(teacher.id)
        teachers.set(`${scheme}:${width}`, username)
      }
  })
})

test.afterAll(async () => {
  if (ids.length)
    await withDatabase(databaseUrl, async (db) => {
      await db.delete(user).where(inArray(user.id, ids))
    })
})

async function measureText(locator: Locator, pseudo: string | null = null) {
  await expect(locator).toBeVisible()
  // Measure settled UI, not the opacity of an opening drawer/dialog transition.
  await locator
    .page()
    .waitForFunction(() =>
      document
        .getAnimations()
        .every(
          (animation) =>
            animation.playState !== 'running' ||
            animation.effect?.getComputedTiming().iterations === Infinity,
        ),
    )
  // A transition can still be at its opacity: 0 start frame before it runs.
  await locator.evaluate(
    (element) =>
      new Promise<void>((resolve) => {
        const opaque = () => {
          for (let node: Element | null = element; node; node = node.parentElement)
            if (getComputedStyle(node).opacity !== '1') return false
          return true
        }
        const poll = () => (opaque() ? resolve() : requestAnimationFrame(poll))
        poll()
      }),
  )
  const colors = await locator.evaluate((element, pseudoElement) => {
    function rgba(value: string) {
      // color-mix() glass surfaces compute to color(srgb r g b / a), 0–1 channels.
      if (value.startsWith('color(srgb ')) {
        const channels = value.match(/[\d.]+/g)!.map(Number)
        return [...channels.slice(0, 3).map((c) => c * 255), channels[3] ?? 1]
      }
      if (!value.startsWith('rgb'))
        throw new Error(`Unsupported color: ${value}`)
      const channels = value.match(/[\d.]+/g)!.map(Number)
      return [...channels.slice(0, 3), channels[3] ?? 1]
    }
    const ancestors: Array<Element> = []
    for (let node: Element | null = element; node; node = node.parentElement)
      ancestors.unshift(node)
    let background = [255, 255, 255]
    for (const node of ancestors) {
      const style = getComputedStyle(node)
      if (style.backgroundImage !== 'none' || style.opacity !== '1')
        throw new Error(
          'This contrast helper only measures flat, fully opaque text containers.',
        )
      const layer = rgba(style.backgroundColor)
      background = background.map(
        (channel, index) => layer[index] * layer[3] + channel * (1 - layer[3]),
      )
    }
    const foreground = rgba(getComputedStyle(element, pseudoElement).color)
    if (foreground[3] !== 1) throw new Error('Expected opaque enabled text.')
    return { foreground: foreground.slice(0, 3), background }
  }, pseudo)
  return {
    ...colors,
    ratio: contrastRatio(colors.foreground, colors.background),
  }
}

for (const scheme of schemes) {
  for (const width of widths) {
    test(`enabled secondary text meets AA in ${scheme} at ${width}px`, async ({
      page,
    }, testInfo) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' })
      await page.setViewportSize({ width, height: 844 })
      const measurements: Array<object> = []
      async function check(
        locator: Locator,
        label: string,
        pseudo: string | null = null,
      ) {
        const measurement = await measureText(locator, pseudo)
        measurements.push({ label, ...measurement })
        expect(
          measurement.ratio,
          `${label}: ${JSON.stringify(measurement)}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
      const teacherName = teachers.get(`${scheme}:${width}`)!
      await loginAs(page, teacherName, password)
      await expect(page.locator('html')).toHaveAttribute(
        'data-mantine-color-scheme',
        scheme,
      )
      await check(
        page.getByText(
          'نظرة على جميع الطلاب النشطين في المدرسة، لمساعدتك على تحديد من يحتاج إلى دعم اليوم.',
        ),
        'dashboard instructions',
      )
      await check(
        page.getByText('أهلاً بك، معلم التباين', { exact: true }),
        'dashboard accent greeting',
      )
      await check(
        page.getByRole('link', { name: 'عرض جميع الطلاب', exact: true }),
        'dashboard accent link',
      )
      // The top bar and bottom nav stay light glass in both schemes.
      await check(
        page.locator('header').getByText('قر', { exact: true }),
        'top bar brand mark',
      )
      await check(
        page.getByText('الملف الشخصي', { exact: true }),
        'inactive bottom nav label',
      )

      await gotoApp(page, '/profile')
      await check(
        page.getByText(
          'هنا تجد المعلومات الأساسية المرتبطة بحسابك داخل التطبيق.',
        ),
        'profile instructions',
      )
      await check(
        page.getByText(`@${teacherName}`, { exact: true }).first(),
        'profile username on paper',
      )
      for (const label of [
        'الاسم الكامل',
        'اسم المستخدم',
        'البريد الإلكتروني',
        'حالة الحساب',
      ])
        await check(
          page.getByText(label, { exact: true }),
          `profile field: ${label}`,
        )

      await gotoApp(page, '/staff/students')
      await check(
        page.getByText('اختر طالبًا لعرض السور التي حفظها وتقييمه.'),
        'staff instructions',
      )
      await check(
        page.getByText('إدارة الطلاب', { exact: true }),
        'staff accent eyebrow',
      )
      const student = page
        .getByRole('button')
        .filter({ hasText: `@${studentName}` })
      const username = student.getByText(`@${studentName}`, { exact: true })
      await check(username, 'student username: normal')
      await student.hover()
      await check(username, 'student username: hover')
      await student.focus()
      await check(username, 'student username: focus')

      await page.getByRole('button', { name: 'طالب جديد', exact: true }).click()
      const drawer = page.getByRole('dialog')
      const input = drawer.getByLabel('اسم المستخدم', { exact: false })
      await check(
        drawer.locator('label').filter({ hasText: 'اسم المستخدم' }),
        'input label',
      )
      await check(
        drawer.getByText('٣ إلى ٣٢ حرفًا، أحرف لاتينية وأرقام و . _ -'),
        'input description',
      )
      await check(input, 'input placeholder: normal', '::placeholder')
      await input.hover()
      await check(input, 'input placeholder: hover', '::placeholder')
      await input.focus()
      await check(input, 'input placeholder: focus', '::placeholder')
      await input.fill('contrast.preview')
      await check(input, 'enabled input value')
      await expect(
        drawer.getByRole('button', { name: 'إنشاء الحساب', exact: true }),
      ).toBeDisabled()
      await page.keyboard.press('Escape')
      await expect(drawer).not.toBeVisible()

      await student.click()
      await page.getByRole('tab', { name: 'الملاحظات', exact: true }).click()
      await page.getByRole('button', { name: /إضافة ملاحظة/ }).click()
      const note = page.getByRole('dialog')
      const textarea = note.getByPlaceholder('اكتب ملاحظة...')
      await check(textarea, 'textarea placeholder', '::placeholder')
      await textarea.fill('معاينة التباين فقط')
      await check(textarea, 'textarea value')
      await check(note.getByText(/\/ 2000$/), 'note character count')
      await note.getByRole('button', { name: 'إلغاء', exact: true }).click()
      await expect(note).not.toBeVisible()
      await testInfo.attach('rendered-contrast', {
        body: JSON.stringify({ scheme, width, measurements }, null, 2),
        contentType: 'application/json',
      })
    })
  }
}
