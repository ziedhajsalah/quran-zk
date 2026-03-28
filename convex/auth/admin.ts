import { v } from 'convex/values'
import { action, internalAction } from '../_generated/server'
import { components } from '../_generated/api'
import { authComponent, createAuth } from '../auth'
import { requireAdminAuthUser, serializeAuthUser } from './helpers'
import {
  buildStoredEmail,
  normalizeDisplayName,
  normalizeRoles,
  normalizeUsername,
  parseStoredRoles,
} from './utils'
import { roleValidator, userStatusValidator } from './validators'

async function listAllUsers(
  auth: ReturnType<typeof createAuth>,
  headers: Headers,
) {
  const users: Array<Awaited<ReturnType<typeof auth.api.getUser>>> = []
  let offset = 0
  let total = 0

  do {
    const result = await auth.api.listUsers({
      query: {
        limit: 100,
        offset,
      },
      headers,
    })
    users.push(...result.users)
    total = result.total
    offset += result.users.length
  } while (offset < total)

  return users
}

async function ensureAnotherActiveAdminExists(
  auth: ReturnType<typeof createAuth>,
  headers: Headers,
  excludedUserId: string,
) {
  const users = await listAllUsers(auth, headers)
  const hasAnotherAdmin = users.some((user) => {
    if (user.id === excludedUserId || user.banned) {
      return false
    }

    return parseStoredRoles(user.role).includes('admin')
  })

  if (!hasAnotherAdmin) {
    throw new Error('At least one active admin must remain.')
  }
}

export const adminCreate = action({
  args: {
    username: v.string(),
    displayName: v.string(),
    email: v.union(v.string(), v.null()),
    password: v.string(),
    roles: v.array(roleValidator),
  },
  handler: async (ctx, args) => {
    await requireAdminAuthUser(ctx)
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

    const normalizedUsername = normalizeUsername(args.username)
    const normalizedDisplayName = normalizeDisplayName(args.displayName)
    const normalizedRoles = normalizeRoles(args.roles)
    const email = buildStoredEmail(normalizedUsername.username, args.email)

    const created = await auth.api.createUser({
      body: {
        email,
        password: args.password,
        name: normalizedDisplayName,
        role: normalizedRoles,
        data: {
          username: normalizedUsername.username,
        },
      },
      headers,
    })

    return serializeAuthUser(created.user)
  },
})

export const adminUpdate = action({
  args: {
    userId: v.string(),
    username: v.string(),
    displayName: v.string(),
    email: v.union(v.string(), v.null()),
    roles: v.array(roleValidator),
  },
  handler: async (ctx, args) => {
    await requireAdminAuthUser(ctx)
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

    const existing = await auth.api.getUser({
      query: {
        id: args.userId,
      },
      headers,
    })

    const normalizedUsername = normalizeUsername(args.username)
    const normalizedDisplayName = normalizeDisplayName(args.displayName)
    const normalizedRoles = normalizeRoles(args.roles)
    const email = buildStoredEmail(normalizedUsername.username, args.email)

    const existingRoles = parseStoredRoles(existing.role)
    if (
      !existing.banned &&
      existingRoles.includes('admin') &&
      !normalizedRoles.includes('admin')
    ) {
      await ensureAnotherActiveAdminExists(auth, headers, existing.id)
    }

    await auth.api.adminUpdateUser({
      body: {
        userId: args.userId,
        data: {
          email,
          name: normalizedDisplayName,
          username: normalizedUsername.username,
        },
      },
      headers,
    })

    await auth.api.setRole({
      body: {
        userId: args.userId,
        role: normalizedRoles,
      },
      headers,
    })

    const updated = await auth.api.getUser({
      query: {
        id: args.userId,
      },
      headers,
    })

    return serializeAuthUser(updated)
  },
})

export const adminResetPassword = action({
  args: {
    userId: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: true }> => {
    await requireAdminAuthUser(ctx)
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

    const result = await auth.api.setUserPassword({
      body: {
        userId: args.userId,
        newPassword: args.password,
      },
      headers,
    })

    if (!result.status) {
      throw new Error('Failed to reset password.')
    }

    return { success: true }
  },
})

export const adminSetStatus = action({
  args: {
    userId: v.string(),
    status: userStatusValidator,
  },
  handler: async (ctx, args) => {
    await requireAdminAuthUser(ctx)
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

    const existing = await auth.api.getUser({
      query: {
        id: args.userId,
      },
      headers,
    })

    if (
      args.status === 'disabled' &&
      !existing.banned &&
      parseStoredRoles(existing.role).includes('admin')
    ) {
      await ensureAnotherActiveAdminExists(auth, headers, existing.id)
    }

    if (args.status === 'disabled') {
      await auth.api.banUser({
        body: {
          userId: args.userId,
          banReason: 'Account disabled',
        },
        headers,
      })
      await auth.api.revokeUserSessions({
        body: {
          userId: args.userId,
        },
        headers,
      })
    } else {
      await auth.api.unbanUser({
        body: {
          userId: args.userId,
        },
        headers,
      })
    }

    const updated = await auth.api.getUser({
      query: {
        id: args.userId,
      },
      headers,
    })

    return serializeAuthUser(updated)
  },
})

export const bootstrapAdmin = internalAction({
  args: {
    username: v.string(),
    password: v.string(),
    displayName: v.string(),
    email: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const existingUsers = await ctx.runQuery(components.betterAuth.adapter.findMany, {
      model: 'user',
      where: [],
      paginationOpts: {
        numItems: 1,
        cursor: null,
      },
    })

    if (existingUsers.page.length > 0) {
      throw new Error('Bootstrap is only available before any user exists.')
    }

    const normalizedUsername = normalizeUsername(args.username)
    const normalizedDisplayName = normalizeDisplayName(args.displayName)
    const email = buildStoredEmail(normalizedUsername.username, args.email)
    const auth = createAuth(ctx, { disableSignUp: false })

    const created = await auth.api.signUpEmail({
      body: {
        email,
        password: args.password,
        name: normalizedDisplayName,
        username: normalizedUsername.username,
      },
    })

    if (!created.user) {
      throw new Error('Failed to create bootstrap admin.')
    }

    await ctx.runMutation(components.betterAuth.adapter.updateOne, {
      input: {
        model: 'user',
        where: [
          {
            field: '_id',
            value: created.user.id,
          },
        ],
        update: {
          role: 'admin',
          banned: false,
          banReason: null,
          banExpires: null,
        },
      },
    })

    const user = await authComponent.getAnyUserById(ctx, created.user.id)
    if (!user) {
      throw new Error('Failed to load bootstrap admin.')
    }

    return serializeAuthUser(user)
  },
})
