import { v } from 'convex/values'

export const roles = ['admin', 'teacher', 'student'] as const
export type AppRole = (typeof roles)[number]

export const userStatuses = ['active', 'disabled'] as const
export type UserStatus = (typeof userStatuses)[number]

export const roleValidator = v.union(
  v.literal('admin'),
  v.literal('teacher'),
  v.literal('student'),
)

export const userStatusValidator = v.union(
  v.literal('active'),
  v.literal('disabled'),
)
