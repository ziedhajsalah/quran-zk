import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'
import { roleValidator, userStatusValidator } from './auth/validators'

// The schema is entirely optional.
// You can delete this file (schema.ts) and the
// app will continue to work.
// The schema provides more precise TypeScript types.
export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  users: defineTable({
    clerkUserId: v.string(),
    tokenIdentifier: v.union(v.string(), v.null()),
    username: v.string(),
    usernameCanonical: v.string(),
    displayName: v.string(),
    email: v.union(v.string(), v.null()),
    emailLower: v.union(v.string(), v.null()),
    roles: v.array(roleValidator),
    isAdmin: v.boolean(),
    isTeacher: v.boolean(),
    isStudent: v.boolean(),
    status: userStatusValidator,
    searchText: v.string(),
    createdBy: v.union(v.id('users'), v.null()),
    disabledAt: v.union(v.number(), v.null()),
    disabledBy: v.union(v.id('users'), v.null()),
  })
    .index('by_tokenIdentifier', ['tokenIdentifier'])
    .index('by_clerkUserId', ['clerkUserId'])
    .index('by_usernameCanonical', ['usernameCanonical'])
    .index('by_emailLower', ['emailLower'])
    .index('by_status', ['status'])
    .index('by_isAdmin_and_status', ['isAdmin', 'status'])
    .searchIndex('search_searchText', {
      searchField: 'searchText',
      filterFields: ['status'],
    }),
})
