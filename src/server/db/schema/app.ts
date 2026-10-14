import { sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { user } from './auth'

export const gradeEnum = pgEnum('surah_grade', ['good', 'medium', 'forgotten'])
export const reviewStatus = pgEnum('review_status', [
  'open',
  'closed',
  'cancelled',
])
const time = (name: string) => timestamp(name, { withTimezone: true })
const student = () =>
  text('student_id')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' })
const actor = (name: string) =>
  text(name).references(() => user.id, { onDelete: 'set null' })
export const grades = pgTable(
  'student_surah_grades',
  {
    id: text('id').primaryKey(),
    studentId: student(),
    surahNumber: integer('surah_number').notNull(),
    grade: gradeEnum('grade').notNull(),
    updatedAt: time('updated_at').notNull(),
    updatedBy: actor('updated_by'),
  },
  (t) => [
    uniqueIndex('grade_student_surah_unique').on(t.studentId, t.surahNumber),
    check('grade_surah_range', sql`${t.surahNumber} between 1 and 114`),
  ],
)
export const reviews = pgTable(
  'surah_review_assignments',
  {
    id: text('id').primaryKey(),
    studentId: student(),
    surahNumber: integer('surah_number').notNull(),
    status: reviewStatus('status').notNull().default('open'),
    dueAt: time('due_at'),
    assignedBy: actor('assigned_by'),
    assignedAt: time('assigned_at').notNull(),
    closedBy: actor('closed_by'),
    closedAt: time('closed_at'),
    closingGrade: gradeEnum('closing_grade'),
  },
  (t) => [
    uniqueIndex('review_open_unique')
      .on(t.studentId, t.surahNumber)
      .where(sql`${t.status} = 'open'`),
    index('review_student_status_due_idx').on(t.studentId, t.status, t.dueAt),
    check('review_surah_range', sql`${t.surahNumber} between 1 and 114`),
  ],
)
export const notes = pgTable(
  'student_notes',
  {
    id: text('id').primaryKey(),
    studentId: student(),
    authorId: actor('author_id'),
    body: text('body').notNull(),
    createdAt: time('created_at').notNull(),
    editedAt: time('edited_at'),
  },
  (t) => [
    index('note_student_created_idx').on(t.studentId, t.createdAt),
    check(
      'note_body_length',
      sql`char_length(trim(${t.body})) between 1 and 2000`,
    ),
  ],
)
export const resetCodes = pgTable(
  'password_reset_codes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    expiresAt: time('expires_at').notNull(),
    usedAt: time('used_at'),
    attempts: integer('attempts').notNull().default(0),
    issuedByAdminId: actor('issued_by_admin_id'),
  },
  (t) => [
    uniqueIndex('reset_unused_user_unique')
      .on(t.userId)
      .where(sql`${t.usedAt} is null`),
    check('reset_attempts_range', sql`${t.attempts} between 0 and 5`),
  ],
)

export const authRateLimits = pgTable(
  "auth_rate_limits",
  {
    key: text("key").primaryKey(),
    count: integer("count").notNull(),
    windowStart: time("window_start").notNull().defaultNow(),
  },
  (t) => [
    index("auth_rate_limits_window_idx").on(t.windowStart),
    check("auth_rate_limits_positive_count", sql`${t.count} > 0`),
  ],
);
