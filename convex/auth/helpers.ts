import { authComponent } from '../auth'
import { buildRoleFlags, displayAuthEmail, parseStoredRoles } from './utils'
import type { ActionCtx, MutationCtx, QueryCtx } from '../_generated/server'

type ReaderCtx = QueryCtx | MutationCtx | ActionCtx

type SerializedAuthUserInput = {
  _id?: string | null
  id?: string | null
  name: string
  email: string | null
  username?: string | null
  role?: string | null
  banned?: boolean | null
}

export function serializeAuthUser(user: SerializedAuthUserInput) {
  const roles = parseStoredRoles(user.role)
  const status = user.banned ? 'disabled' : 'active'
  const id = user.id ?? user._id

  if (!id) {
    throw new Error('Auth user is missing an identifier.')
  }

  return {
    id: String(id),
    username: user.username ?? '',
    displayName: user.name,
    email: displayAuthEmail(user.email),
    roles,
    status,
    ...buildRoleFlags(roles),
  }
}

export async function requireCurrentAuthUser(ctx: ReaderCtx) {
  const user = await authComponent.safeGetAuthUser(ctx)
  if (!user) {
    throw new Error('Not authenticated')
  }

  if (user.banned) {
    throw new Error('Account disabled')
  }

  return user
}

export async function requireAdminAuthUser(ctx: ReaderCtx) {
  const user = await requireCurrentAuthUser(ctx)
  if (!parseStoredRoles(user.role).includes('admin')) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireStaffAuthUser(ctx: ReaderCtx) {
  const user = await requireCurrentAuthUser(ctx)
  const roles = parseStoredRoles(user.role)
  if (!roles.includes('admin') && !roles.includes('teacher')) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireSelfOrStaffAuthUser(
  ctx: ReaderCtx,
  studentId: string,
) {
  const user = await requireCurrentAuthUser(ctx)
  if (String(user._id) === studentId) {
    return user
  }
  const roles = parseStoredRoles(user.role)
  if (!roles.includes('admin') && !roles.includes('teacher')) {
    throw new Error('Unauthorized')
  }
  return user
}
