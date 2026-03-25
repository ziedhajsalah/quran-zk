import type { AppRole, UserStatus } from './validators'

const USERNAME_PATTERN = /^[A-Za-z0-9._-]{3,32}$/

export function normalizeUsername(username: string) {
  const value = username.trim()
  if (!USERNAME_PATTERN.test(value)) {
    throw new Error(
      'Username must be 3-32 characters and use only Latin letters, numbers, dots, underscores, or hyphens.',
    )
  }
  return {
    username: value,
    usernameCanonical: value.toLowerCase(),
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

export function buildSearchText(input: {
  username: string
  displayName: string
  email: string | null
}) {
  return [input.username, input.displayName, input.email ?? '']
    .join(' ')
    .trim()
}

export function buildUserRecord(input: {
  clerkUserId: string
  tokenIdentifier: string | null
  username: string
  displayName: string
  email: string | null
  roles: Array<AppRole>
  status: UserStatus
}) {
  const normalizedUsername = normalizeUsername(input.username)
  const normalizedDisplayName = normalizeDisplayName(input.displayName)
  const normalizedEmail = normalizeEmail(input.email)
  const normalizedRoles = normalizeRoles(input.roles)

  return {
    clerkUserId: input.clerkUserId,
    tokenIdentifier: input.tokenIdentifier,
    username: normalizedUsername.username,
    usernameCanonical: normalizedUsername.usernameCanonical,
    displayName: normalizedDisplayName,
    email: normalizedEmail.email,
    emailLower: normalizedEmail.emailLower,
    roles: normalizedRoles,
    status: input.status,
    searchText: buildSearchText({
      username: normalizedUsername.usernameCanonical,
      displayName: normalizedDisplayName,
      email: normalizedEmail.emailLower,
    }),
    ...buildRoleFlags(normalizedRoles),
  }
}
