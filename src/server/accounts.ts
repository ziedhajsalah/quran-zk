import { z } from 'zod'

export const roleSchema = z.enum(['admin', 'teacher', 'student'])
export type AppRole = z.infer<typeof roleSchema>
export const usernameSchema = z
  .string()
  .trim()
  .regex(
    /^[A-Za-z0-9._-]{3,32}$/,
    'اسم المستخدم يجب أن يكون بين 3 و32 حرفاً لاتينياً أو رقماً.',
  )
  .transform((value) => value.toLowerCase())
export const passwordSchema = z
  .string()
  .min(8, 'كلمة المرور يجب ألا تقل عن 8 أحرف.')
  .max(128)
export const accountInput = z.object({
  username: usernameSchema,
  displayName: z.string().trim().min(1).max(200),
  email: z
    .union([z.string().trim().email(), z.literal(''), z.null()])
    .transform((value) => (value ? value.toLowerCase() : null)),
  password: passwordSchema,
})
export function roles(raw: string | null | undefined): Array<AppRole> {
  return (raw ?? '')
    .split(',')
    .filter(
      (value): value is AppRole =>
        value === 'admin' || value === 'teacher' || value === 'student',
    )
}
export function serializeUser(value: {
  id: string
  name: string
  username?: string | null
  email: string
  role?: string | null
  banned?: boolean | null
}) {
  const parsed = roles(value.role)
  return {
    id: value.id,
    username: value.username ?? '',
    displayName: value.name,
    email: value.email.endsWith('@auth.local.invalid') ? null : value.email,
    roles: parsed,
    status: value.banned ? 'disabled' : 'active',
    isAdmin: parsed.includes('admin'),
    isTeacher: parsed.includes('teacher'),
    isStudent: parsed.includes('student'),
  }
}
