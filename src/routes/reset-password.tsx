import { Link, createFileRoute } from '@tanstack/react-router'
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
import { useAction } from 'convex/react'
import * as React from 'react'
import { api } from '../../convex/_generated/api'
import { extractActionErrorMessage } from '~/lib/convex-errors'

export const Route = createFileRoute('/reset-password')({
  component: ResetPasswordPage,
})

function ResetPasswordPage() {
  const redeem = useAction(api.auth.resetCodes.redeem)
  const [identifier, setIdentifier] = React.useState('')
  const [code, setCode] = React.useState('')
  const [newPassword, setNewPassword] = React.useState('')
  const [confirmPassword, setConfirmPassword] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setErrorMessage(null)

    if (newPassword.length < 8) {
      setErrorMessage('كلمة المرور يجب ألا تقل عن 8 أحرف.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('كلمتا المرور غير متطابقتين.')
      return
    }

    setLoading(true)
    try {
      await redeem({
        identifier,
        code,
        newPassword,
      })
      window.location.assign('/login?reason=passwordReset')
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'رمز غير صالح أو منتهي.'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Container size="xs" py="xl">
      <Paper withBorder radius="xl" p="xl" shadow="sm">
        <Stack gap="lg">
          <div>
            <Title order={1}>إعادة تعيين كلمة المرور</Title>
            <Text c="dimmed" mt="xs">
              أدخل بياناتك والرمز الذي أعطاه لك المشرف ثم اختر كلمة مرور جديدة.
            </Text>
          </div>

          {errorMessage ? (
            <Alert color="red" title="تعذر إعادة التعيين">
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
                autoComplete="username"
              />

              <TextInput
                label="رمز إعادة التعيين"
                placeholder="123456"
                value={code}
                onChange={(event) => setCode(event.currentTarget.value)}
                required
                inputMode="numeric"
                autoComplete="one-time-code"
              />

              <PasswordInput
                label="كلمة المرور الجديدة"
                placeholder="8 أحرف على الأقل"
                value={newPassword}
                onChange={(event) => setNewPassword(event.currentTarget.value)}
                required
                autoComplete="new-password"
              />

              <PasswordInput
                label="تأكيد كلمة المرور"
                placeholder="أعد إدخال كلمة المرور"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.currentTarget.value)}
                required
                autoComplete="new-password"
              />

              <Button type="submit" loading={loading} fullWidth>
                حفظ كلمة المرور
              </Button>
            </Stack>
          </form>

          <Anchor component={Link} to="/login" size="sm">
            العودة إلى تسجيل الدخول
          </Anchor>
        </Stack>
      </Paper>
    </Container>
  )
}
