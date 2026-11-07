import {
  Alert,
  Button,
  Drawer,
  PasswordInput,
  Stack,
  TextInput,
} from '@mantine/core'
import { useState } from 'react'
import { extractActionErrorMessage } from '~/lib/action-errors'

export interface CreateStudentDrawerProps {
  opened: boolean
  onClose: () => void
  onSubmit: (input: {
    username: string
    displayName: string
    email: string | null
    password: string
  }) => Promise<void>
}

export function CreateStudentDrawer({
  opened,
  onClose,
  onSubmit,
}: CreateStudentDrawerProps) {
  const [username, setUsername] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleClose() {
    if (submitting) return
    setUsername('')
    setDisplayName('')
    setEmail('')
    setPassword('')
    setError(null)
    onClose()
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
    setError(null)
    try {
      await onSubmit({
        username: username.trim(),
        displayName: displayName.trim(),
        email: email.trim() ? email.trim() : null,
        password,
      })
      setUsername('')
      setDisplayName('')
      setEmail('')
      setPassword('')
      onClose()
    } catch (cause) {
      setError(
        extractActionErrorMessage(cause, 'تعذر إنشاء الحساب. حاول مرة أخرى.'),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit =
    username.trim().length >= 3 &&
    displayName.trim().length > 0 &&
    password.length >= 8

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      position="bottom"
      size="80%"
      title="إضافة طالب جديد"
      padding="lg"
      withCloseButton={!submitting}
      closeOnEscape={!submitting}
      closeOnClickOutside={!submitting}
      closeButtonProps={{ 'aria-label': 'إغلاق إضافة طالب' }}
    >
      <Stack gap="md">
        {error ? (
          <Alert color="red" title="تعذر إنشاء الحساب" role="alert">
            {error}
          </Alert>
        ) : null}
        <TextInput
          label="الاسم الكامل"
          placeholder="مثال: أحمد محمد"
          value={displayName}
          disabled={submitting}
          onChange={(e) => setDisplayName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="اسم المستخدم"
          placeholder="ahmed.mohamed"
          description="٣ إلى ٣٢ حرفًا، أحرف لاتينية وأرقام و . _ -"
          value={username}
          disabled={submitting}
          onChange={(e) => setUsername(e.currentTarget.value)}
          required
        />
        <TextInput
          label="البريد الإلكتروني (اختياري)"
          placeholder="student@example.com"
          type="email"
          value={email}
          disabled={submitting}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        <PasswordInput
          label="كلمة المرور"
          description="٨ أحرف على الأقل"
          value={password}
          disabled={submitting}
          onChange={(e) => setPassword(e.currentTarget.value)}
          required
        />
        <Button
          onClick={handleSubmit}
          loading={submitting}
          disabled={!canSubmit}
        >
          إنشاء الحساب
        </Button>
      </Stack>
    </Drawer>
  )
}
