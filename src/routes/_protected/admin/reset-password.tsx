import { createFileRoute } from '@tanstack/react-router'
import {
  Alert,
  Button,
  CopyButton,
  Container,
  Group,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { useAction } from 'convex/react'
import * as React from 'react'
import { api } from '../../../../convex/_generated/api'
import { extractActionErrorMessage } from '~/lib/convex-errors'

export const Route = createFileRoute('/_protected/admin/reset-password')({
  component: AdminResetPasswordPage,
})

type IssuedCode = {
  code: string
  expiresAt: number
}

function AdminResetPasswordPage() {
  const issue = useAction(api.auth.resetCodes.adminIssue)
  const [identifier, setIdentifier] = React.useState('')
  const [loading, setLoading] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [issued, setIssued] = React.useState<IssuedCode | null>(null)

  React.useEffect(() => {
    return () => {
      setIssued(null)
    }
  }, [])

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setErrorMessage(null)
    setLoading(true)
    try {
      const result = await issue({ identifier: identifier.trim() })
      setIssued({ code: result.code, expiresAt: result.expiresAt })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر إصدار الرمز.'))
    } finally {
      setLoading(false)
    }
  }

  function handleIssueAnother() {
    setIssued(null)
    setIdentifier('')
    setErrorMessage(null)
  }

  return (
    <Container size="xs" py="xl">
      <Paper withBorder radius="xl" p="xl" shadow="sm">
        <Stack gap="lg">
          <div>
            <Title order={1}>إعادة تعيين كلمة مرور مستخدم</Title>
            <Text c="dimmed" mt="xs">
              أدخل البريد الإلكتروني أو اسم المستخدم الخاص بالمستخدم ليصدر له رمز
              إعادة تعيين صالح لمدة محدودة.
            </Text>
          </div>

          {issued ? (
            <IssuedCodeBlock issued={issued} onIssueAnother={handleIssueAnother} />
          ) : (
            <>
              {errorMessage ? (
                <Alert color="red" title="تعذر إصدار الرمز">
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

                  <Button type="submit" loading={loading} fullWidth>
                    إصدار الرمز
                  </Button>
                </Stack>
              </form>
            </>
          )}
        </Stack>
      </Paper>
    </Container>
  )
}

function IssuedCodeBlock({
  issued,
  onIssueAnother,
}: {
  issued: IssuedCode
  onIssueAnother: () => void
}) {
  const expirationLabel = formatExpiration(issued.expiresAt)

  return (
    <Stack gap="lg">
      <Alert color="teal" title="تم إصدار الرمز">
        انسخ الرمز الآن وأرسله للمستخدم. لن يُعرض مرة أخرى.
      </Alert>

      <Paper withBorder radius="lg" p="lg" bg="var(--mantine-color-gray-0)">
        <Stack gap="sm" align="center">
          <Text c="dimmed" fw={600} size="sm">
            رمز إعادة التعيين
          </Text>
          <Text
            fw={700}
            size="2.5rem"
            style={{ letterSpacing: '0.5rem', fontFamily: 'monospace' }}
          >
            {issued.code}
          </Text>
          <CopyButton value={issued.code} timeout={2000}>
            {({ copied, copy }) => (
              <Button
                variant={copied ? 'filled' : 'light'}
                color={copied ? 'teal' : 'primary'}
                onClick={copy}
              >
                {copied ? 'تم النسخ' : 'نسخ الرمز'}
              </Button>
            )}
          </CopyButton>
        </Stack>
      </Paper>

      <Stack gap="xs">
        <Text c="dimmed" size="sm">
          <Text component="span" fw={700}>
            صالح حتى:{' '}
          </Text>
          {expirationLabel}
        </Text>
        <Alert color="orange" title="تنبيه">
          الرمز يُعرض لمرة واحدة فقط. إذا فُقد، أصدر رمزًا جديدًا (سيُلغي الرمز
          السابق).
        </Alert>
      </Stack>

      <Group justify="flex-end">
        <Button variant="subtle" onClick={onIssueAnother}>
          إصدار رمز لمستخدم آخر
        </Button>
      </Group>
    </Stack>
  )
}

function formatExpiration(expiresAt: number) {
  const date = new Date(expiresAt)
  const time = date.toLocaleTimeString('ar', {
    hour: '2-digit',
    minute: '2-digit',
  })
  const minutesLeft = Math.max(0, Math.round((expiresAt - Date.now()) / 60000))
  return `${time} (بعد ${minutesLeft} دقيقة)`
}
