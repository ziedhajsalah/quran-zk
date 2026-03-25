"use node";

import process from 'node:process'
import { createClerkClient } from '@clerk/backend'
import { v } from 'convex/values'
import { internal } from '../_generated/api'
import { action } from '../_generated/server'
import { normalizeEmail, normalizeRoles, normalizeUsername } from './utils'
import { roleValidator, userStatusValidator } from './validators'
import type { Doc } from '../_generated/dataModel'
import type { ActionCtx } from '../_generated/server'

type PublicUser = Pick<
  Doc<'users'>,
  | '_id'
  | 'clerkUserId'
  | 'username'
  | 'displayName'
  | 'email'
  | 'roles'
  | 'status'
  | 'isAdmin'
  | 'isTeacher'
  | 'isStudent'
>

function getClerkClient() {
  const secretKey = process.env.CLERK_SECRET_KEY
  if (!secretKey) {
    throw new Error('Missing CLERK_SECRET_KEY environment variable.')
  }
  return createClerkClient({ secretKey })
}

async function requireAdminActor(ctx: ActionCtx): Promise<Doc<'users'>> {
  const identity = await ctx.auth.getUserIdentity()
  if (!identity) {
    throw new Error('Not authenticated')
  }

  const byToken = await ctx.runQuery(internal.auth.users.getByTokenIdentifier, {
    tokenIdentifier: identity.tokenIdentifier,
  })

  const currentUser =
    byToken ??
    (await ctx.runQuery(internal.auth.users.getByClerkUserId, {
      clerkUserId: identity.subject,
    }))

  if (!currentUser || currentUser.status !== 'active' || !currentUser.isAdmin) {
    throw new Error('Unauthorized')
  }
  return currentUser
}

export const adminCreate = action({
  args: {
    username: v.string(),
    displayName: v.string(),
    email: v.union(v.string(), v.null()),
    password: v.string(),
    roles: v.array(roleValidator),
  },
  handler: async (ctx, args): Promise<PublicUser> => {
    const actor = await requireAdminActor(ctx)
    const clerkClient = getClerkClient()

    const normalizedUsername = normalizeUsername(args.username)
    const normalizedRoles = normalizeRoles(args.roles)
    const normalizedEmail = normalizeEmail(args.email)

    const existingUsername = await ctx.runQuery(
      internal.auth.users.getByUsernameCanonical,
      {
        usernameCanonical: normalizedUsername.usernameCanonical,
      },
    )
    if (existingUsername) {
      throw new Error('Username is already in use.')
    }

    if (normalizedEmail.emailLower) {
      const existingEmail = await ctx.runQuery(internal.auth.users.getByEmailLower, {
        emailLower: normalizedEmail.emailLower,
      })
      if (existingEmail) {
        throw new Error('Email is already in use.')
      }
    }

    const clerkUser = await clerkClient.users.createUser({
      username: normalizedUsername.username,
      password: args.password,
      firstName: args.displayName,
      emailAddress: normalizedEmail.email ? [normalizedEmail.email] : undefined,
    })

    try {
      return await ctx.runMutation(internal.auth.users.upsertMirroredUser, {
        clerkUserId: clerkUser.id,
        tokenIdentifier: null,
        username: normalizedUsername.username,
        displayName: args.displayName,
        email: normalizedEmail.email,
        roles: normalizedRoles,
        status: 'active',
        createdBy: actor._id,
      })
    } catch (error) {
      await clerkClient.users.deleteUser(clerkUser.id)
      throw error
    }
  },
})

export const adminUpdate = action({
  args: {
    userId: v.id('users'),
    username: v.string(),
    displayName: v.string(),
    email: v.union(v.string(), v.null()),
    roles: v.array(roleValidator),
  },
  handler: async (ctx, args): Promise<PublicUser> => {
    await requireAdminActor(ctx)
    const clerkClient = getClerkClient()

    const targetUser: Doc<'users'> | null = await ctx.runQuery(
      internal.auth.users.getById,
      {
      userId: args.userId,
      },
    )
    if (!targetUser) {
      throw new Error('User not found.')
    }

    const normalizedUsername = normalizeUsername(args.username)
    const normalizedRoles = normalizeRoles(args.roles)
    const normalizedEmail = normalizeEmail(args.email)

    const conflictingUsername = await ctx.runQuery(
      internal.auth.users.getByUsernameCanonical,
      {
        usernameCanonical: normalizedUsername.usernameCanonical,
      },
    )
    if (conflictingUsername && conflictingUsername._id !== targetUser._id) {
      throw new Error('Username is already in use.')
    }

    if (normalizedEmail.emailLower) {
      const conflictingEmail = await ctx.runQuery(internal.auth.users.getByEmailLower, {
        emailLower: normalizedEmail.emailLower,
      })
      if (conflictingEmail && conflictingEmail._id !== targetUser._id) {
        throw new Error('Email is already in use.')
      }
    }

    if (
      targetUser.isAdmin &&
      targetUser.status === 'active' &&
      !normalizedRoles.includes('admin')
    ) {
      const activeAdminCount = await ctx.runQuery(
        internal.auth.users.getActiveAdminCount,
        {},
      )
      if (activeAdminCount <= 1) {
        throw new Error('At least one active admin must remain.')
      }
    }

    const clerkUser = await clerkClient.users.getUser(targetUser.clerkUserId)

    await clerkClient.users.updateUser(targetUser.clerkUserId, {
      username: normalizedUsername.username,
      firstName: args.displayName,
    })

    const currentEmails = clerkUser.emailAddresses

    if (!normalizedEmail.email && currentEmails.length > 0) {
      for (const emailAddress of currentEmails) {
        await clerkClient.emailAddresses.deleteEmailAddress(emailAddress.id)
      }
    }

    if (
      normalizedEmail.email &&
      !currentEmails.some(
        (emailAddress) =>
          emailAddress.emailAddress.toLowerCase() === normalizedEmail.emailLower,
      )
    ) {
      const createdEmail = await clerkClient.emailAddresses.createEmailAddress({
        userId: targetUser.clerkUserId,
        emailAddress: normalizedEmail.email,
      })
      await clerkClient.emailAddresses.updateEmailAddress(createdEmail.id, {
        verified: true,
        primary: true,
      })

      for (const emailAddress of currentEmails) {
        await clerkClient.emailAddresses.deleteEmailAddress(emailAddress.id)
      }
    }

    return await ctx.runMutation(internal.auth.users.upsertMirroredUser, {
      clerkUserId: targetUser.clerkUserId,
      tokenIdentifier: targetUser.tokenIdentifier,
      username: normalizedUsername.username,
      displayName: args.displayName,
      email: normalizedEmail.email,
      roles: normalizedRoles,
      status: targetUser.status,
      createdBy: targetUser.createdBy,
    })
  },
})

export const adminResetPassword = action({
  args: {
    userId: v.id('users'),
    password: v.string(),
  },
  handler: async (ctx, args): Promise<{ success: true }> => {
    await requireAdminActor(ctx)
    const clerkClient = getClerkClient()

    const targetUser = await ctx.runQuery(internal.auth.users.getById, {
      userId: args.userId,
    })
    if (!targetUser) {
      throw new Error('User not found.')
    }

    await clerkClient.users.updateUser(targetUser.clerkUserId, {
      password: args.password,
      signOutOfOtherSessions: true,
    })

    return { success: true }
  },
})

export const adminSetStatus = action({
  args: {
    userId: v.id('users'),
    status: userStatusValidator,
  },
  handler: async (ctx, args): Promise<PublicUser> => {
    const actor = await requireAdminActor(ctx)
    const clerkClient = getClerkClient()

    const targetUser = await ctx.runQuery(internal.auth.users.getById, {
      userId: args.userId,
    })
    if (!targetUser) {
      throw new Error('User not found.')
    }

    if (
      targetUser.isAdmin &&
      targetUser.status === 'active' &&
      args.status === 'disabled'
    ) {
      const activeAdminCount = await ctx.runQuery(
        internal.auth.users.getActiveAdminCount,
        {},
      )
      if (activeAdminCount <= 1) {
        throw new Error('At least one active admin must remain.')
      }
    }

    if (args.status === 'disabled') {
      await clerkClient.users.banUser(targetUser.clerkUserId)
    } else {
      await clerkClient.users.unbanUser(targetUser.clerkUserId)
    }

    return await ctx.runMutation(internal.auth.users.updateUserStatus, {
      userId: args.userId,
      status: args.status,
      actorUserId: actor._id,
    })
  },
})
