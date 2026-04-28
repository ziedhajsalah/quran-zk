import {
  Button,
  Drawer,
  PasswordInput,
  Stack,
  TextInput,
} from '@mantine/core'
import { useState } from 'react'

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

  function handleClose() {
    if (submitting) return
    setUsername('')
    setDisplayName('')
    setEmail('')
    setPassword('')
    onClose()
  }

  async function handleSubmit() {
    if (submitting) return
    setSubmitting(true)
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
    >
      <Stack gap="md">
        <TextInput
          label="الاسم الكامل"
          placeholder="مثال: أحمد محمد"
          value={displayName}
          onChange={(e) => setDisplayName(e.currentTarget.value)}
          required
        />
        <TextInput
          label="اسم المستخدم"
          placeholder="ahmed.mohamed"
          description="٣ إلى ٣٢ حرفًا، أحرف لاتينية وأرقام و . _ -"
          value={username}
          onChange={(e) => setUsername(e.currentTarget.value)}
          required
        />
        <TextInput
          label="البريد الإلكتروني (اختياري)"
          placeholder="student@example.com"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.currentTarget.value)}
        />
        <PasswordInput
          label="كلمة المرور"
          description="٨ أحرف على الأقل"
          value={password}
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
