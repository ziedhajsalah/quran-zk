import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import {
  Alert,
  Anchor,
  Button,
  Container,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import * as React from 'react'
import { authClient } from '~/lib/auth-client'
import { fetchAppSession } from '~/lib/auth'

type LoginSearch = {
  redirect?: string
  reason?: 'auth' | 'unauthorized' | 'passwordReset'
}

export const Route = createFileRoute('/login')({
  validateSearch: (search): LoginSearch => ({
    redirect:
      typeof search.redirect === 'string' && search.redirect.startsWith('/')
        ? search.redirect
        : undefined,
    reason:
      search.reason === 'auth' ||
      search.reason === 'unauthorized' ||
      search.reason === 'passwordReset'
        ? search.reason
        : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const session = await fetchAppSession()
    if (session.currentUser) {
      throw redirect({
        to: search.redirect ?? '/',
      })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const search = Route.useSearch()
  const [identifier, setIdentifier] = React.useState('')
  const [password, setPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setLoading(true)
    setErrorMessage(null)

    try {
      const normalizedIdentifier = identifier.trim()
      const result = normalizedIdentifier.includes('@')
        ? await authClient.signIn.email({
            email: normalizedIdentifier,
            password,
          })
        : await authClient.signIn.username({
            username: normalizedIdentifier,
            password,
          })

      if (result.error) {
        setErrorMessage(result.error.message ?? 'فشل تسجيل الدخول. تحقق من البيانات.')
        return
      }

      window.location.assign(search.redirect ?? '/')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'فشل تسجيل الدخول. تحقق من البيانات.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container size="xs" py="xl">
      <Paper withBorder radius="xl" p="xl" shadow="sm">
        <Stack gap="lg">
          <div>
            <Title order={1}>تسجيل الدخول</Title>
            <Text c="dimmed" mt="xs">
              سجّل الدخول باستخدام البريد الإلكتروني أو اسم المستخدم وكلمة
              المرور. إنشاء الحسابات واستعادة كلمات المرور تتم من خلال الإدارة.
            </Text>
          </div>

          {search.reason === 'unauthorized' ? (
            <Alert color="orange" title="هذا الحساب غير مفعّل داخل التطبيق">
              تم التعرّف على جلستك، لكن هذا الحساب لا يملك وصولًا نشطًا داخل
              التطبيق. تواصل مع الإدارة أو سجّل الخروج ثم جرّب حسابًا آخر.
            </Alert>
          ) : null}

          {search.reason === 'auth' ? (
            <Alert color="blue" title="يلزم تسجيل الدخول">
              يجب تسجيل الدخول أولًا للوصول إلى هذه الصفحة.
            </Alert>
          ) : null}

          {search.reason === 'passwordReset' ? (
            <Alert color="teal" title="تم تحديث كلمة المرور">
              تم تغيير كلمة المرور بنجاح. سجّل الدخول بكلمة المرور الجديدة.
            </Alert>
          ) : null}

          {errorMessage ? (
            <Alert color="red" title="تعذر تسجيل الدخول">
              {errorMessage}
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit}>
            <Stack gap="md">
              <TextInput
                label="البريد الإلكتروني أو اسم المستخدم"
                placeholder="name@example.com أو username"
                value={identifier}
                onChange={(event) => setIdentifier(event.currentTarget.value)}
                required
              />

              <PasswordInput
                label="كلمة المرور"
                placeholder="أدخل كلمة المرور"
                value={password}
                onChange={(event) => setPassword(event.currentTarget.value)}
                required
              />

              <Button type="submit" loading={loading} fullWidth>
                تسجيل الدخول
              </Button>
            </Stack>
          </form>

          <Anchor component={Link} to="/reset-password" size="sm">
            نسيت كلمة المرور؟
          </Anchor>
        </Stack>
      </Paper>
    </Container>
  )
}
