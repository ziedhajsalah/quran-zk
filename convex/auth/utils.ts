import type { AppRole } from './validators'

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/
const PLACEHOLDER_EMAIL_DOMAIN = 'auth.local.invalid'

export function normalizeUsername(username: string) {
  const value = username.trim()
  if (!USERNAME_PATTERN.test(value)) {
    throw new Error(
      'Username must be 3-32 characters and use only Latin letters, numbers, dots, underscores, or hyphens.',
    )
  }
  const usernameCanonical = value.toLowerCase()
  return {
    username: usernameCanonical,
    usernameCanonical,
  }
}

export function normalizeDisplayName(displayName: string) {
  const value = displayName.trim()
  if (!value) {
    throw new Error('Display name is required.')
  }
  return value
}

export function normalizeEmail(email: string | null | undefined) {
  const value = email?.trim() ?? ''
  if (!value) {
    return {
      email: null,
      emailLower: null,
    }
  }
  return {
    email: value,
    emailLower: value.toLowerCase(),
  }
}

export function buildStoredEmail(username: string, email: string | null | undefined) {
  const normalizedEmail = normalizeEmail(email)
  if (normalizedEmail.email) {
    return normalizedEmail.emailLower
  }

  const normalizedUsername = normalizeUsername(username)
  return `${normalizedUsername.usernameCanonical}@${PLACEHOLDER_EMAIL_DOMAIN}`
}

export function normalizeRoles(roleValues: Array<AppRole>) {
  const deduped = [...new Set(roleValues)].sort()
  if (deduped.length === 0) {
    throw new Error('At least one role is required.')
  }
  if (deduped.length > 3) {
    throw new Error('A user can have at most three roles.')
  }
  return deduped
}

export function buildRoleFlags(roleValues: Array<AppRole>) {
  return {
    isAdmin: roleValues.includes('admin'),
    isTeacher: roleValues.includes('teacher'),
    isStudent: roleValues.includes('student'),
  }
}

export function parseStoredRoles(rawRoles: string | null | undefined) {
  if (!rawRoles) {
    return [] satisfies Array<AppRole>
  }

  return rawRoles
    .split(',')
    .map((value) => value.trim())
    .filter((value): value is AppRole =>
      value === 'admin' || value === 'teacher' || value === 'student',
    )
}

export function displayAuthEmail(email: string | null | undefined) {
  if (!email) {
    return null
  }

  return email.endsWith(`@${PLACEHOLDER_EMAIL_DOMAIN}`) ? null : email
}
