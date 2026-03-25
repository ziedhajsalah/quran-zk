import { paginationOptsValidator } from 'convex/server'
import { v } from 'convex/values'
import {
  internalMutation,
  internalQuery,
  mutation,
  query,
} from '../_generated/server'
import { buildRoleFlags, buildUserRecord } from './utils'
import { roleValidator, userStatusValidator } from './validators'
import type { Doc, Id } from '../_generated/dataModel'
import type { MutationCtx, QueryCtx } from '../_generated/server'

type ReaderCtx = QueryCtx | MutationCtx

function serializeUser(user: Doc<'users'>) {
  return {
    _id: user._id,
    clerkUserId: user.clerkUserId,
    username: user.username,
    displayName: user.displayName,
    email: user.email,
    roles: user.roles,
    status: user.status,
    isAdmin: user.isAdmin,
    isTeacher: user.isTeacher,
    isStudent: user.isStudent,
  }
}

async function findUserByIdentity(
  ctx: ReaderCtx,
  identity: { tokenIdentifier: string; subject: string },
) {
  const byToken = await ctx.db
    .query('users')
    .withIndex('by_tokenIdentifier', (q) =>
      q.eq('tokenIdentifier', identity.tokenIdentifier),
    )
    .unique()

  if (byToken) {
    return byToken
  }

  return await ctx.db
    .query('users')
    .withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', identity.subject))
    .unique()
}

async function requireCurrentUser(ctx: ReaderCtx) {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Not authenticated')
  }

  const user = await findUserByIdentity(ctx, {
    tokenIdentifier: identity.tokenIdentifier,
    subject: identity.subject,
  })

  if (!user) {
    throw new Error('Unauthorized')
  }

  if (user.status !== 'active') {
    throw new Error('Account disabled')
  }

  return { identity, user }
}

async function requireAdminUser(ctx: ReaderCtx) {
  const result = await requireCurrentUser(ctx)
  if (!result.user.isAdmin) {
    throw new Error('Unauthorized')
  }
  return result
}

async function ensureUniqueIdentityFields(
  ctx: MutationCtx,
  args: {
    userId: Id<'users'> | null
    usernameCanonical: string
    emailLower: string | null
  },
) {
  const existingUsername = await ctx.db
    .query('users')
    .withIndex('by_usernameCanonical', (q) =>
      q.eq('usernameCanonical', args.usernameCanonical),
    )
    .unique()

  if (existingUsername && existingUsername._id !== args.userId) {
    throw new Error('Username is already in use.')
  }

  if (args.emailLower) {
    const existingEmail = await ctx.db
      .query('users')
      .withIndex('by_emailLower', (q) => q.eq('emailLower', args.emailLower))
      .unique()

    if (existingEmail && existingEmail._id !== args.userId) {
      throw new Error('Email is already in use.')
    }
  }
}

export const current = query({
  args: {},
  handler: async (ctx) => {
    const { user } = await requireCurrentUser(ctx)
    return serializeUser(user)
  },
})

export const syncSessionUser = mutation({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity()
    if (!identity) {
      throw new Error('Not authenticated')
    }

    const byToken = await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', identity.tokenIdentifier),
      )
      .unique()

    if (byToken) {
      if (byToken.status !== 'active') {
        throw new Error('Account disabled')
      }
      return serializeUser(byToken)
    }

    const byClerkUserId = await ctx.db
      .query('users')
      .withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', identity.subject))
      .unique()

    if (!byClerkUserId) {
      throw new Error('Unauthorized')
    }

    if (byClerkUserId.status !== 'active') {
      throw new Error('Account disabled')
    }

    await ctx.db.patch('users', byClerkUserId._id, {
      tokenIdentifier: identity.tokenIdentifier,
    })

    return serializeUser({
      ...byClerkUserId,
      tokenIdentifier: identity.tokenIdentifier,
    })
  },
})

export const adminList = query({
  args: {
    paginationOpts: paginationOptsValidator,
    search: v.optional(v.string()),
    status: v.optional(userStatusValidator),
  },
  handler: async (ctx, args) => {
    await requireAdminUser(ctx)

    const search = args.search?.trim()

    if (search) {
      return await ctx.db
        .query('users')
        .withSearchIndex('search_searchText', (q) => {
          const searchQuery = q.search('searchText', search)
          return args.status
            ? searchQuery.eq('status', args.status)
            : searchQuery
        })
        .paginate(args.paginationOpts)
    }

    if (args.status) {
      const status = args.status
      return await ctx.db
        .query('users')
        .withIndex('by_status', (q) => q.eq('status', status))
        .order('desc')
        .paginate(args.paginationOpts)
    }

    return await ctx.db.query('users').order('desc').paginate(args.paginationOpts)
  },
})

export const bootstrapAdmin = mutation({
  args: {
    clerkUserId: v.string(),
    username: v.string(),
    displayName: v.string(),
    email: v.union(v.string(), v.null()),
  },
  handler: async (ctx, args) => {
    const existingUsers = await ctx.db.query('users').take(1)
    if (existingUsers.length > 0) {
      throw new Error('Bootstrap is only available before any user exists.')
    }

    const userRecord = buildUserRecord({
      clerkUserId: args.clerkUserId,
      tokenIdentifier: null,
      username: args.username,
      displayName: args.displayName,
      email: args.email,
      roles: ['admin'],
      status: 'active',
    })

    await ensureUniqueIdentityFields(ctx, {
      userId: null,
      usernameCanonical: userRecord.usernameCanonical,
      emailLower: userRecord.emailLower,
    })

    const userId = await ctx.db.insert('users', {
      ...userRecord,
      createdBy: null,
      disabledAt: null,
      disabledBy: null,
    })

    const created = await ctx.db.get('users', userId)
    if (!created) {
      throw new Error('Failed to create bootstrap admin.')
    }

    return serializeUser(created)
  },
})

export const getByTokenIdentifier = internalQuery({
  args: {
    tokenIdentifier: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_tokenIdentifier', (q) =>
        q.eq('tokenIdentifier', args.tokenIdentifier),
      )
      .unique()
  },
})

export const getByClerkUserId = internalQuery({
  args: {
    clerkUserId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', args.clerkUserId))
      .unique()
  },
})

export const getByUsernameCanonical = internalQuery({
  args: {
    usernameCanonical: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_usernameCanonical', (q) =>
        q.eq('usernameCanonical', args.usernameCanonical),
      )
      .unique()
  },
})

export const getByEmailLower = internalQuery({
  args: {
    emailLower: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query('users')
      .withIndex('by_emailLower', (q) => q.eq('emailLower', args.emailLower))
      .unique()
  },
})

export const getById = internalQuery({
  args: {
    userId: v.id('users'),
  },
  handler: async (ctx, args) => {
    return await ctx.db.get('users', args.userId)
  },
})

export const getActiveAdminCount = internalQuery({
  args: {},
  handler: async (ctx) => {
    let count = 0
    for await (const _user of ctx.db
      .query('users')
      .withIndex('by_isAdmin_and_status', (q) =>
        q.eq('isAdmin', true).eq('status', 'active'),
      )) {
      count += 1
    }
    return count
  },
})

export const upsertMirroredUser = internalMutation({
  args: {
    clerkUserId: v.string(),
    tokenIdentifier: v.union(v.string(), v.null()),
    username: v.string(),
    displayName: v.string(),
    email: v.union(v.string(), v.null()),
    roles: v.array(roleValidator),
    status: userStatusValidator,
    createdBy: v.union(v.id('users'), v.null()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('users')
      .withIndex('by_clerkUserId', (q) => q.eq('clerkUserId', args.clerkUserId))
      .unique()

    const record = buildUserRecord({
      clerkUserId: args.clerkUserId,
      tokenIdentifier: args.tokenIdentifier ?? existing?.tokenIdentifier ?? null,
      username: args.username,
      displayName: args.displayName,
      email: args.email,
      roles: args.roles,
      status: args.status,
    })

    await ensureUniqueIdentityFields(ctx, {
      userId: existing?._id ?? null,
      usernameCanonical: record.usernameCanonical,
      emailLower: record.emailLower,
    })

    if (existing) {
      await ctx.db.patch('users', existing._id, {
        ...record,
        disabledAt: record.status === 'disabled' ? existing.disabledAt : null,
        disabledBy: record.status === 'disabled' ? existing.disabledBy : null,
      })
      const updated = await ctx.db.get('users', existing._id)
      if (!updated) {
        throw new Error('Failed to update user.')
      }
      return serializeUser(updated)
    }

    const userId = await ctx.db.insert('users', {
      ...record,
      createdBy: args.createdBy,
      disabledAt: record.status === 'disabled' ? Date.now() : null,
      disabledBy: record.status === 'disabled' ? args.createdBy : null,
    })

    const created = await ctx.db.get('users', userId)
    if (!created) {
      throw new Error('Failed to create user.')
    }

    return serializeUser(created)
  },
})

export const updateUserStatus = internalMutation({
  args: {
    userId: v.id('users'),
    status: userStatusValidator,
    actorUserId: v.union(v.id('users'), v.null()),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db.get('users', args.userId)
    if (!user) {
      throw new Error('User not found.')
    }

    const timestamp = args.status === 'disabled' ? Date.now() : null

    await ctx.db.patch('users', args.userId, {
      status: args.status,
      disabledAt: timestamp,
      disabledBy: args.status === 'disabled' ? args.actorUserId : null,
    })

    const updated = await ctx.db.get('users', args.userId)
    if (!updated) {
      throw new Error('Failed to update user status.')
    }

    return serializeUser(updated)
  },
})

export const touchRoleFlags = internalMutation({
  args: {
    userId: v.id('users'),
    roles: v.array(roleValidator),
  },
  handler: async (ctx, args) => {
    const roleFlags = buildRoleFlags(args.roles)
    await ctx.db.patch('users', args.userId, roleFlags)
  },
})
