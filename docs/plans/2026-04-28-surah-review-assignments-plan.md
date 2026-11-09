# Surah Review Assignments — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v1 Surah Review Assignments feature: teachers/admins can assign a memorized surah for a student to review, students see an open-review queue on `/surahs`, and staff close (optionally updating the grade) or cancel assignments from the per-student page.

**Architecture:** New Convex table `surahReviewAssignments` with two indexes; four queries/mutations in `convex/surahReviews.ts` reusing the existing v1 auth helpers (`requireStaffAuthUser`, `requireSelfOrStaffAuthUser`); four new Mantine components (`SurahReviewQueue`, `SurahReviewRow`, `AssignReviewDrawer`, `CloseAssignmentDialog`) in `src/components/surahs/`; both `_protected/surahs.tsx` (read-only queue) and `_protected/staff/students/$studentId.tsx` (editable queue + assign + close + cancel) gain the queue above the existing grade list.

**Tech Stack:** Convex 1.34 with Better Auth, TanStack Router/Query, Mantine v8 (adds `@mantine/dates` for `DatePickerInput`), React 19, TypeScript strict.

**Verification model — important:** This project has no automated test runner (no `npm test`, no Vitest, no Jest). The verification loop is:
1. `npm run lint` (runs `tsc && eslint`) — must pass after every code change.
2. `npx convex dev --once` — pushes schema/function updates to the dev deployment; must succeed for backend changes.
3. Storybook stories — visual verification for components (mandatory because the project has stories for every existing component in `src/components/surahs/`).
4. `npm run dev` (live preview) — manual verification for routes and end-to-end flows. The user handles login when verification needs auth.

**Reference reading before starting backend tasks:** `convex/_generated/ai/guidelines.md` (per `CLAUDE.md`).

**Builds on:** [`2026-04-28-surah-review-assignments-design.md`](./2026-04-28-surah-review-assignments-design.md) — the approved design doc. Read §2 (decisions) and §3 (data layer) before starting backend work; §4 (UI surfaces) before frontend work.

**Convex API style note:** existing project code (`convex/surahGrades.ts`, `convex/auth/resetCodes.ts`) calls `ctx.db.patch`, `ctx.db.delete`, and `ctx.db.insert` with the table name as the first argument: `ctx.db.patch('tableName', id, fields)`. Match that pattern in new code for consistency. `ctx.db.get(id)` takes only the ID.

---

## Phase 1 — Convex backend

### Task 1: Schema — add `surahReviewAssignments` table

Adds the new table. The existing `studentSurahGrades` schema is left untouched. No new auth helpers are needed: v1 already added `requireStaffAuthUser` and `requireSelfOrStaffAuthUser`.

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the table definition**

Replace the contents of `convex/schema.ts` with:

```ts
import { defineSchema, defineTable } from 'convex/server'
import { v } from 'convex/values'

export default defineSchema({
  numbers: defineTable({
    value: v.number(),
  }),
  passwordResetCodes: defineTable({
    userId: v.string(),
    codeHash: v.string(),
    betterAuthToken: v.union(v.null(), v.string()),
    expiresAt: v.number(),
    usedAt: v.union(v.null(), v.number()),
    attempts: v.number(),
    issuedByAdminId: v.string(),
  })
    .index('by_code_hash', ['codeHash'])
    .index('by_user', ['userId']),
  studentSurahGrades: defineTable({
    studentId: v.string(),
    surahNumber: v.number(),
    grade: v.union(
      v.literal('good'),
      v.literal('medium'),
      v.literal('forgotten'),
    ),
    updatedAt: v.number(),
    updatedBy: v.string(),
  })
    .index('by_student', ['studentId'])
    .index('by_student_surah', ['studentId', 'surahNumber']),
  surahReviewAssignments: defineTable({
    studentId: v.string(),
    surahNumber: v.number(),
    status: v.union(
      v.literal('open'),
      v.literal('closed'),
      v.literal('cancelled'),
    ),
    dueAt: v.union(v.null(), v.number()),
    assignedBy: v.string(),
    assignedAt: v.number(),
    closedBy: v.union(v.null(), v.string()),
    closedAt: v.union(v.null(), v.number()),
    closingGrade: v.union(
      v.null(),
      v.literal('good'),
      v.literal('medium'),
      v.literal('forgotten'),
    ),
  })
    .index('by_student_status', ['studentId', 'status'])
    .index('by_student_surah_status', ['studentId', 'surahNumber', 'status']),
})
```

- [ ] **Step 2: Push schema to dev deployment**

```bash
npx convex dev --once
```

Expected: schema deploys successfully and the new table + indexes appear in the Convex dashboard. No TypeScript errors.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "Add surahReviewAssignments table"
```

---

### Task 2: Convex query — `listOpenForStudent`

Returns all `open` assignments for a student, sorted by `dueAt asc nulls last`, then `assignedAt asc`. Self-or-staff authorized. The Convex index gets us by student+status; the multi-key sort happens in JS because Convex indexes do not support nulls-last ordering directly.

**Files:**
- Create: `convex/surahReviews.ts`

- [ ] **Step 1: Create the file with shared validators, helper, and the query**

```ts
import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import {
  requireSelfOrStaffAuthUser,
  requireStaffAuthUser,
} from './auth/helpers'

const gradeValidator = v.union(
  v.literal('good'),
  v.literal('medium'),
  v.literal('forgotten'),
)

function assertSurahNumber(surahNumber: number) {
  if (!Number.isInteger(surahNumber) || surahNumber < 1 || surahNumber > 114) {
    throw new ConvexError('Invalid surah number.')
  }
}

export const listOpenForStudent = query({
  args: {
    studentId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSelfOrStaffAuthUser(ctx, args.studentId)
    const rows = await ctx.db
      .query('surahReviewAssignments')
      .withIndex('by_student_status', (q) =>
        q.eq('studentId', args.studentId).eq('status', 'open'),
      )
      .collect()
    return [...rows].sort((a, b) => {
      if (a.dueAt === null && b.dueAt === null) {
        return a.assignedAt - b.assignedAt
      }
      if (a.dueAt === null) return 1
      if (b.dueAt === null) return -1
      if (a.dueAt !== b.dueAt) return a.dueAt - b.dueAt
      return a.assignedAt - b.assignedAt
    })
  },
})
```

The unused imports (`mutation`, `requireStaffAuthUser`) are added now to avoid noisy diffs in subsequent tasks. They will be used in Tasks 3–5. `gradeValidator` and `assertSurahNumber` are re-declared here (rather than imported from `surahGrades.ts`) per §3.2 of the design doc — duplication is intentional given how small they are.

- [ ] **Step 2: Push and lint**

```bash
npx convex dev --once && npm run lint
```

Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add convex/surahReviews.ts
git commit -m "Add listOpenForStudent query for review assignments"
```

---

### Task 3: Convex mutation — `assign`

Creates a new `open` assignment. Validates: surahNumber range, that a `studentSurahGrades` row exists for `(studentId, surahNumber)` (review-only scope, §2.4), and that no `open` assignment already exists for that pair (§2.5). `dueAt` is optional; when omitted, stored as `null`.

**Files:**
- Modify: `convex/surahReviews.ts`

- [ ] **Step 1: Append the mutation**

Append to `convex/surahReviews.ts`:

```ts
export const assign = mutation({
  args: {
    studentId: v.string(),
    surahNumber: v.number(),
    dueAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    assertSurahNumber(args.surahNumber)

    const grade = await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student_surah', (q) =>
        q.eq('studentId', args.studentId).eq('surahNumber', args.surahNumber),
      )
      .unique()
    if (!grade) {
      throw new ConvexError('Student has not memorized this surah yet.')
    }

    const existingOpen = await ctx.db
      .query('surahReviewAssignments')
      .withIndex('by_student_surah_status', (q) =>
        q
          .eq('studentId', args.studentId)
          .eq('surahNumber', args.surahNumber)
          .eq('status', 'open'),
      )
      .unique()
    if (existingOpen) {
      throw new ConvexError(
        'An open review assignment already exists for this surah.',
      )
    }

    await ctx.db.insert('surahReviewAssignments', {
      studentId: args.studentId,
      surahNumber: args.surahNumber,
      status: 'open',
      dueAt: args.dueAt ?? null,
      assignedBy: String(staff._id),
      assignedAt: Date.now(),
      closedBy: null,
      closedAt: null,
      closingGrade: null,
    })
  },
})
```

- [ ] **Step 2: Push and lint**

```bash
npx convex dev --once && npm run lint
```

Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add convex/surahReviews.ts
git commit -m "Add assign mutation for review assignments"
```

---

### Task 4: Convex mutation — `close`

Closes an `open` assignment. If `newGrade` is provided, upserts the corresponding `studentSurahGrades` row (matching the v1 `setGrade` upsert pattern) and stores it as `closingGrade`. If `newGrade` is omitted, snapshots the current grade for that `(student, surah)` — `null` if the row was admin-deleted between assign and close.

**Files:**
- Modify: `convex/surahReviews.ts`

- [ ] **Step 1: Append the mutation**

Append to `convex/surahReviews.ts`:

```ts
export const close = mutation({
  args: {
    assignmentId: v.id('surahReviewAssignments'),
    newGrade: v.optional(gradeValidator),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    const assignment = await ctx.db.get(args.assignmentId)
    if (!assignment) {
      throw new ConvexError('Assignment not found.')
    }
    if (assignment.status !== 'open') {
      throw new ConvexError('Assignment is not open.')
    }

    const existingGrade = await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student_surah', (q) =>
        q
          .eq('studentId', assignment.studentId)
          .eq('surahNumber', assignment.surahNumber),
      )
      .unique()

    const now = Date.now()
    let closingGrade: 'good' | 'medium' | 'forgotten' | null

    if (args.newGrade !== undefined) {
      if (existingGrade) {
        await ctx.db.patch('studentSurahGrades', existingGrade._id, {
          grade: args.newGrade,
          updatedAt: now,
          updatedBy: String(staff._id),
        })
      } else {
        await ctx.db.insert('studentSurahGrades', {
          studentId: assignment.studentId,
          surahNumber: assignment.surahNumber,
          grade: args.newGrade,
          updatedAt: now,
          updatedBy: String(staff._id),
        })
      }
      closingGrade = args.newGrade
    } else {
      closingGrade = existingGrade?.grade ?? null
    }

    await ctx.db.patch('surahReviewAssignments', args.assignmentId, {
      status: 'closed',
      closedBy: String(staff._id),
      closedAt: now,
      closingGrade,
    })
  },
})
```

- [ ] **Step 2: Push and lint**

```bash
npx convex dev --once && npm run lint
```

Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add convex/surahReviews.ts
git commit -m "Add close mutation for review assignments"
```

---

### Task 5: Convex mutation — `cancel`

Marks an `open` assignment as `cancelled`. Does not touch grades and does not set `closingGrade`.

**Files:**
- Modify: `convex/surahReviews.ts`

- [ ] **Step 1: Append the mutation**

Append to `convex/surahReviews.ts`:

```ts
export const cancel = mutation({
  args: {
    assignmentId: v.id('surahReviewAssignments'),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    const assignment = await ctx.db.get(args.assignmentId)
    if (!assignment) {
      throw new ConvexError('Assignment not found.')
    }
    if (assignment.status !== 'open') {
      throw new ConvexError('Assignment is not open.')
    }

    await ctx.db.patch('surahReviewAssignments', args.assignmentId, {
      status: 'cancelled',
      closedBy: String(staff._id),
      closedAt: Date.now(),
    })
  },
})
```

- [ ] **Step 2: Push and lint**

```bash
npx convex dev --once && npm run lint
```

Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add convex/surahReviews.ts
git commit -m "Add cancel mutation for review assignments"
```

---

## Phase 2 — Frontend components

All four new components live in their own folders under `src/components/surahs/`, mirroring the existing layout (`SurahGradeList/`, `SurahGradeRow/`, etc.). Each folder has:
- `<Component>.tsx` — implementation
- `<Component>.stories.tsx` — Storybook story (every existing component in this folder has one; matching the pattern is mandatory per the v1 design doc §5).
- `index.ts` — re-export

The barrel re-export in `src/components/surahs/index.ts` is updated in Task 11 once all components exist.

### Task 6: `SurahReviewRow` component

Renders a single open review assignment — surah name + number, an assigned-on label (relative time), and an optional due-date pill. In editable mode, also renders **إغلاق** (close) and **إلغاء** (cancel) icon buttons. Overdue rows tint the due pill orange (matches the `forgotten` grade color used elsewhere).

**Files:**
- Create: `src/components/surahs/SurahReviewRow/SurahReviewRow.tsx`
- Create: `src/components/surahs/SurahReviewRow/SurahReviewRow.stories.tsx`
- Create: `src/components/surahs/SurahReviewRow/index.ts`

- [ ] **Step 1: Implementation**

`src/components/surahs/SurahReviewRow/SurahReviewRow.tsx`:

```tsx
import { ActionIcon, Badge, Group, Stack, Text, Tooltip } from '@mantine/core'
import { IconCheck, IconX } from '@tabler/icons-react'
import { formatArabicNumber } from '~/components/home/home-formatters'
import type { Surah } from '~/data/surahs'

export interface SurahReviewRowProps {
  surah: Surah
  assignedAt: number
  dueAt: number | null
  editable?: boolean
  onClose?: () => void
  onCancel?: () => void
}

export function SurahReviewRow({
  surah,
  assignedAt,
  dueAt,
  editable = false,
  onClose,
  onCancel,
}: SurahReviewRowProps) {
  const isOverdue = dueAt !== null && dueAt < startOfTodayMs()

  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Text fw={700}>{surah.nameAr}</Text>
        <Text c="dimmed" size="sm">
          {`سورة رقم ${formatArabicNumber(surah.number)} • ${formatAssignedAt(assignedAt)}`}
        </Text>
        {dueAt !== null ? (
          <Badge
            color={isOverdue ? 'orange' : 'primary'}
            radius="xl"
            variant="light"
            mt={4}
          >
            {`${isOverdue ? 'تأخر — ' : ''}${formatDueDate(dueAt)}`}
          </Badge>
        ) : null}
      </Stack>

      {editable ? (
        <Group gap="xs" wrap="nowrap">
          <Tooltip label="إغلاق">
            <ActionIcon
              variant="light"
              color="teal"
              size="lg"
              radius="xl"
              onClick={onClose}
              aria-label="إغلاق"
            >
              <IconCheck size={18} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="إلغاء">
            <ActionIcon
              variant="light"
              color="gray"
              size="lg"
              radius="xl"
              onClick={onCancel}
              aria-label="إلغاء"
            >
              <IconX size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      ) : null}
    </Group>
  )
}

function startOfTodayMs() {
  const now = new Date()
  return Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  )
}

const dateFormatter = new Intl.DateTimeFormat('ar', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
})

function formatDueDate(ms: number) {
  return `الاستحقاق: ${dateFormatter.format(new Date(ms))}`
}

const relativeFormatter = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' })

function formatAssignedAt(timestamp: number) {
  const diffMs = timestamp - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (Math.abs(diffDays) >= 1) {
    return `أُسند ${relativeFormatter.format(diffDays, 'day')}`
  }
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  if (Math.abs(diffHours) >= 1) {
    return `أُسند ${relativeFormatter.format(diffHours, 'hour')}`
  }
  return 'أُسند الآن'
}
```

- [ ] **Step 2: Index re-export**

`src/components/surahs/SurahReviewRow/index.ts`:

```ts
export { SurahReviewRow } from './SurahReviewRow'
export type { SurahReviewRowProps } from './SurahReviewRow'
```

- [ ] **Step 3: Storybook story**

`src/components/surahs/SurahReviewRow/SurahReviewRow.stories.tsx`:

```tsx
import { SurahReviewRow } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { getSurah } from '~/data/surahs'

const meta = {
  title: 'Surahs/SurahReviewRow',
  component: SurahReviewRow,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SurahReviewRow>

export default meta
type Story = StoryObj<typeof meta>

const now = Date.now()
const oneDay = 1000 * 60 * 60 * 24

export const NoDueDate: Story = {
  args: {
    surah: getSurah(18),
    assignedAt: now - oneDay,
    dueAt: null,
  },
}

export const WithDueDate: Story = {
  args: {
    surah: getSurah(36),
    assignedAt: now - oneDay * 2,
    dueAt: now + oneDay * 5,
  },
}

export const Overdue: Story = {
  args: {
    surah: getSurah(2),
    assignedAt: now - oneDay * 10,
    dueAt: now - oneDay * 2,
  },
}

export const Editable: Story = {
  args: {
    surah: getSurah(67),
    assignedAt: now - oneDay,
    dueAt: now + oneDay * 3,
    editable: true,
    onClose: () => console.log('close clicked'),
    onCancel: () => console.log('cancel clicked'),
  },
}
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 5: Run Storybook and visually verify**

```bash
npm run storybook
```

Open `http://localhost:6006/?path=/story/surahs-surahreviewrow--no-due-date` and confirm all four stories render without console errors. `Overdue` should show an orange "تأخر — الاستحقاق: …" badge. `Editable` should show two icon buttons (check + x).

Stop Storybook (Ctrl-C) when done.

- [ ] **Step 6: Commit**

```bash
git add src/components/surahs/SurahReviewRow/
git commit -m "Add SurahReviewRow component"
```

---

### Task 7: `SurahReviewQueue` component

Wraps a list of `SurahReviewRow` instances behind a section heading "للمراجعة". Renders nothing (no card, no header) when the rows array is empty.

**Files:**
- Create: `src/components/surahs/SurahReviewQueue/SurahReviewQueue.tsx`
- Create: `src/components/surahs/SurahReviewQueue/SurahReviewQueue.stories.tsx`
- Create: `src/components/surahs/SurahReviewQueue/index.ts`

- [ ] **Step 1: Implementation**

`src/components/surahs/SurahReviewQueue/SurahReviewQueue.tsx`:

```tsx
import { Card, Stack, Text } from '@mantine/core'
import { SurahReviewRow } from '../SurahReviewRow'
import { getSurah } from '~/data/surahs'

export interface SurahReviewQueueItem {
  assignmentId: string
  surahNumber: number
  assignedAt: number
  dueAt: number | null
}

export interface SurahReviewQueueProps {
  rows: ReadonlyArray<SurahReviewQueueItem>
  editable?: boolean
  onClose?: (assignmentId: string) => void
  onCancel?: (assignmentId: string) => void
}

export function SurahReviewQueue({
  rows,
  editable = false,
  onClose,
  onCancel,
}: SurahReviewQueueProps) {
  if (rows.length === 0) {
    return null
  }

  return (
    <Stack gap="sm">
      <Text c="primary.7" fw={700} size="sm">
        للمراجعة
      </Text>
      {rows.map((row) => (
        <Card key={row.assignmentId} withBorder radius="lg" p="md">
          <SurahReviewRow
            surah={getSurah(row.surahNumber)}
            assignedAt={row.assignedAt}
            dueAt={row.dueAt}
            editable={editable}
            onClose={() => onClose?.(row.assignmentId)}
            onCancel={() => onCancel?.(row.assignmentId)}
          />
        </Card>
      ))}
    </Stack>
  )
}
```

- [ ] **Step 2: Index re-export**

`src/components/surahs/SurahReviewQueue/index.ts`:

```ts
export { SurahReviewQueue } from './SurahReviewQueue'
export type {
  SurahReviewQueueItem,
  SurahReviewQueueProps,
} from './SurahReviewQueue'
```

- [ ] **Step 3: Storybook story**

`src/components/surahs/SurahReviewQueue/SurahReviewQueue.stories.tsx`:

```tsx
import { SurahReviewQueue } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Surahs/SurahReviewQueue',
  component: SurahReviewQueue,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SurahReviewQueue>

export default meta
type Story = StoryObj<typeof meta>

const now = Date.now()
const oneDay = 1000 * 60 * 60 * 24

export const Empty: Story = {
  args: {
    rows: [],
  },
}

export const ReadOnly: Story = {
  args: {
    rows: [
      {
        assignmentId: 'a1',
        surahNumber: 2,
        assignedAt: now - oneDay * 2,
        dueAt: now - oneDay,
      },
      {
        assignmentId: 'a2',
        surahNumber: 18,
        assignedAt: now - oneDay,
        dueAt: now + oneDay * 4,
      },
      {
        assignmentId: 'a3',
        surahNumber: 36,
        assignedAt: now - oneDay * 3,
        dueAt: null,
      },
    ],
  },
}

export const Editable: Story = {
  args: {
    rows: [
      {
        assignmentId: 'a1',
        surahNumber: 67,
        assignedAt: now - oneDay,
        dueAt: now + oneDay * 2,
      },
    ],
    editable: true,
    onClose: (id) => console.log('close', id),
    onCancel: (id) => console.log('cancel', id),
  },
}
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 5: Verify in Storybook**

```bash
npm run storybook
```

Open `http://localhost:6006/?path=/story/surahs-surahreviewqueue--read-only` and confirm:
- `Empty` renders nothing visible (no header, no card).
- `ReadOnly` shows three rows under "للمراجعة" header, with the overdue row tinted orange.
- `Editable` shows the close/cancel icons.

- [ ] **Step 6: Commit**

```bash
git add src/components/surahs/SurahReviewQueue/
git commit -m "Add SurahReviewQueue component"
```

---

### Task 8: `CloseAssignmentDialog` component

Mantine `Modal` shown when staff click **إغلاق**. Displays the surah name and the current grade, then offers four submit options:
- **إبقاء التقييم الحالي** — submits with `newGrade` omitted (snapshot only).
- Three grade chips — submits with `newGrade` set.

The dialog is fully controlled by the parent: parent decides which assignment is open, parent provides `currentGrade` (which may be `null` if the student has no grade row), and parent handles the actual mutation call.

**Files:**
- Create: `src/components/surahs/CloseAssignmentDialog/CloseAssignmentDialog.tsx`
- Create: `src/components/surahs/CloseAssignmentDialog/CloseAssignmentDialog.stories.tsx`
- Create: `src/components/surahs/CloseAssignmentDialog/index.ts`

- [ ] **Step 1: Implementation**

`src/components/surahs/CloseAssignmentDialog/CloseAssignmentDialog.tsx`:

```tsx
import { Badge, Button, Chip, Group, Modal, Stack, Text } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { SurahGrade } from '~/data/grades'
import type { Surah } from '~/data/surahs'
import { GRADE_COLORS, GRADE_LABELS, GRADE_ORDER } from '~/data/grades'
import { formatArabicNumber } from '~/components/home/home-formatters'

export interface CloseAssignmentDialogProps {
  opened: boolean
  onClose: () => void
  surah: Surah | null
  currentGrade: SurahGrade | null
  onSubmit: (input: { newGrade?: SurahGrade }) => void
}

type Selection = { kind: 'keep' } | { kind: 'change'; grade: SurahGrade }

export function CloseAssignmentDialog({
  opened,
  onClose,
  surah,
  currentGrade,
  onSubmit,
}: CloseAssignmentDialogProps) {
  const [selection, setSelection] = useState<Selection>({ kind: 'keep' })

  useEffect(() => {
    if (opened) {
      setSelection({ kind: 'keep' })
    }
  }, [opened])

  function handleSubmit() {
    if (selection.kind === 'keep') {
      onSubmit({})
    } else {
      onSubmit({ newGrade: selection.grade })
    }
    onClose()
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="إغلاق المراجعة"
      centered
      radius="lg"
    >
      <Stack gap="md">
        {surah ? (
          <Stack gap={2}>
            <Text c="dimmed" size="sm">
              السورة
            </Text>
            <Text fw={700} size="lg">
              {`${surah.nameAr} • ${formatArabicNumber(surah.number)}`}
            </Text>
          </Stack>
        ) : null}

        <Stack gap={4}>
          <Text c="dimmed" size="sm">
            التقييم الحالي
          </Text>
          {currentGrade ? (
            <Badge
              color={GRADE_COLORS[currentGrade]}
              radius="xl"
              variant="light"
              w="fit-content"
            >
              {GRADE_LABELS[currentGrade]}
            </Badge>
          ) : (
            <Text c="dimmed" size="sm">
              لا يوجد تقييم بعد.
            </Text>
          )}
        </Stack>

        <Stack gap="xs">
          <Text c="dimmed" size="sm">
            عند الإغلاق
          </Text>
          <Chip
            checked={selection.kind === 'keep'}
            onChange={() => setSelection({ kind: 'keep' })}
            variant="light"
            color="primary"
          >
            إبقاء التقييم الحالي
          </Chip>
          <Chip.Group
            multiple={false}
            value={selection.kind === 'change' ? selection.grade : null}
            onChange={(value) => {
              if (
                value === 'good' ||
                value === 'medium' ||
                value === 'forgotten'
              ) {
                setSelection({ kind: 'change', grade: value })
              }
            }}
          >
            <Group gap="xs">
              {GRADE_ORDER.map((g) => (
                <Chip key={g} value={g} color={GRADE_COLORS[g]} variant="light">
                  {GRADE_LABELS[g]}
                </Chip>
              ))}
            </Group>
          </Chip.Group>
        </Stack>

        <Group justify="space-between">
          <Button variant="subtle" onClick={onClose}>
            إلغاء
          </Button>
          <Button onClick={handleSubmit}>تأكيد الإغلاق</Button>
        </Group>
      </Stack>
    </Modal>
  )
}
```

- [ ] **Step 2: Index re-export**

`src/components/surahs/CloseAssignmentDialog/index.ts`:

```ts
export { CloseAssignmentDialog } from './CloseAssignmentDialog'
export type { CloseAssignmentDialogProps } from './CloseAssignmentDialog'
```

- [ ] **Step 3: Storybook story**

`src/components/surahs/CloseAssignmentDialog/CloseAssignmentDialog.stories.tsx`:

```tsx
import { Button } from '@mantine/core'
import { useState } from 'react'
import { CloseAssignmentDialog } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { getSurah } from '~/data/surahs'

const meta = {
  title: 'Surahs/CloseAssignmentDialog',
  component: CloseAssignmentDialog,
  parameters: { layout: 'fullscreen' },
  args: {
    opened: false,
    onClose: () => {},
    surah: null,
    currentGrade: null,
    onSubmit: () => {},
  },
} satisfies Meta<typeof CloseAssignmentDialog>

export default meta
type Story = StoryObj<typeof meta>

function Wrapper() {
  const [opened, setOpened] = useState(false)
  return (
    <div style={{ padding: '2rem' }}>
      <Button onClick={() => setOpened(true)}>افتح المربع</Button>
      <CloseAssignmentDialog
        opened={opened}
        onClose={() => setOpened(false)}
        surah={getSurah(36)}
        currentGrade="medium"
        onSubmit={(input) => console.log('submit', input)}
      />
    </div>
  )
}

export const Interactive: Story = {
  render: () => <Wrapper />,
}

function NoGradeWrapper() {
  const [opened, setOpened] = useState(false)
  return (
    <div style={{ padding: '2rem' }}>
      <Button onClick={() => setOpened(true)}>افتح بدون تقييم</Button>
      <CloseAssignmentDialog
        opened={opened}
        onClose={() => setOpened(false)}
        surah={getSurah(112)}
        currentGrade={null}
        onSubmit={(input) => console.log('submit', input)}
      />
    </div>
  )
}

export const NoCurrentGrade: Story = {
  render: () => <NoGradeWrapper />,
}
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 5: Verify in Storybook**

```bash
npm run storybook
```

Open `http://localhost:6006/?path=/story/surahs-closeassignmentdialog--interactive`. Click the button, confirm:
- The dialog shows the surah, "حفظ متوسط" current grade, and the "إبقاء التقييم الحالي" chip is selected by default.
- Clicking a grade chip switches selection (keep gets unchecked).
- Clicking "تأكيد الإغلاق" logs `{}` when keep is selected, `{ newGrade: 'good' }` when a grade is selected.
- `NoCurrentGrade` story shows "لا يوجد تقييم بعد." instead of a badge.

- [ ] **Step 6: Commit**

```bash
git add src/components/surahs/CloseAssignmentDialog/
git commit -m "Add CloseAssignmentDialog component"
```

---

### Task 9: Install `@mantine/dates` and import its CSS

`AssignReviewDrawer` (Task 10) needs `DatePickerInput`, which lives in `@mantine/dates`. Add the package and its peer dependency `dayjs`. Mantine v8 dates uses dayjs internally. The package also ships its own stylesheet that must be imported alongside `@mantine/core/styles.css` — otherwise the date picker renders unstyled.

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src/styles/app.css`

- [ ] **Step 1: Install the package**

```bash
npm install @mantine/dates dayjs
```

Expected: `package.json` gains `@mantine/dates` and `dayjs` under `dependencies`. `package-lock.json` updates. The Mantine version in the new entry must match the existing `@mantine/core` major (`^8`).

- [ ] **Step 2: Add the dates stylesheet import**

In `src/styles/app.css`, add the import directly below the existing `@mantine/core` import:

```css
@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Noto+Serif:wght@400;700;900&display=swap');
@import '@mantine/core/styles.css';
@import '@mantine/dates/styles.css';

html,
body {
  margin: 0;
  min-height: 100%;
  background-color: var(--mantine-color-body);
  color: var(--mantine-color-text);
  font-family: var(--mantine-font-family);
  direction: rtl;
  text-align: start;
}

body {
  min-width: 320px;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

.using-mouse * {
  outline: none !important;
}
```

This is auto-picked up by both `__root.tsx` (which imports `appCss`) and the Storybook preview (which imports `app.css` directly).

- [ ] **Step 3: Verify the install**

```bash
npm run lint
```

Expected: exits 0. (Lint will pass even though no code uses the new package yet.)

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/styles/app.css
git commit -m "Add @mantine/dates dependency for review due-date picker"
```

---

### Task 10: `AssignReviewDrawer` component

Mantine `Drawer` (bottom-anchored, matching `AddSurahDrawer`) for staff to assign a new review. Two stages:
1. **Search** — user picks a surah from the list scoped to `memorizedSurahNumbers \ excludeSurahNumbers` (memorized surahs minus those already on an open assignment).
2. **Date** — selected surah + optional `DatePickerInput` for `dueAt`. Submit calls `onSubmit({ surahNumber, dueAt? })` where `dueAt` is converted to UTC midnight ms.

**Files:**
- Create: `src/components/surahs/AssignReviewDrawer/AssignReviewDrawer.tsx`
- Create: `src/components/surahs/AssignReviewDrawer/AssignReviewDrawer.stories.tsx`
- Create: `src/components/surahs/AssignReviewDrawer/index.ts`

- [ ] **Step 1: Implementation**

`src/components/surahs/AssignReviewDrawer/AssignReviewDrawer.tsx`:

```tsx
import {
  Button,
  Card,
  Drawer,
  Group,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { DatePickerInput } from '@mantine/dates'
import { IconSearch } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import type { Surah } from '~/data/surahs'
import { formatArabicNumber } from '~/components/home/home-formatters'
import { SURAHS } from '~/data/surahs'

export interface AssignReviewDrawerProps {
  opened: boolean
  onClose: () => void
  memorizedSurahNumbers: ReadonlyArray<number>
  excludeSurahNumbers: ReadonlyArray<number>
  onSubmit: (input: { surahNumber: number; dueAt?: number }) => void
}

export function AssignReviewDrawer({
  opened,
  onClose,
  memorizedSurahNumbers,
  excludeSurahNumbers,
  onSubmit,
}: AssignReviewDrawerProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Surah | null>(null)
  const [dueDate, setDueDate] = useState<Date | null>(null)

  const memorizedSet = useMemo(
    () => new Set(memorizedSurahNumbers),
    [memorizedSurahNumbers],
  )
  const excludeSet = useMemo(
    () => new Set(excludeSurahNumbers),
    [excludeSurahNumbers],
  )

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase()
    return SURAHS.filter(
      (s) => memorizedSet.has(s.number) && !excludeSet.has(s.number),
    ).filter((s) => {
      if (!term) return true
      return (
        s.nameAr.includes(term) ||
        s.nameEn.toLowerCase().includes(term) ||
        String(s.number) === term
      )
    })
  }, [search, memorizedSet, excludeSet])

  function handleClose() {
    setSearch('')
    setSelected(null)
    setDueDate(null)
    onClose()
  }

  function handleSubmit() {
    if (!selected) return
    const dueAt = dueDate !== null ? toUtcMidnightMs(dueDate) : undefined
    onSubmit({ surahNumber: selected.number, dueAt })
    handleClose()
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      position="bottom"
      size="80%"
      title="إسناد مراجعة"
      padding="lg"
    >
      <Stack gap="md">
        {!selected ? (
          <>
            <TextInput
              placeholder="ابحث في السور المحفوظة"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />

            <Stack gap="xs" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {candidates.length === 0 ? (
                <Text c="dimmed" ta="center" py="lg">
                  لا توجد سور متاحة للإسناد.
                </Text>
              ) : (
                candidates.map((s) => (
                  <UnstyledButton
                    key={s.number}
                    onClick={() => setSelected(s)}
                    w="100%"
                  >
                    <Card
                      withBorder
                      radius="md"
                      p="sm"
                      styles={(theme) => ({
                        root: {
                          transition:
                            'border-color 120ms ease, background-color 120ms ease',
                          '&:hover': {
                            borderColor: theme.colors.primary[4],
                            backgroundColor: theme.colors.primary[0],
                          },
                        },
                      })}
                    >
                      <Group justify="space-between">
                        <Text fw={600}>{s.nameAr}</Text>
                        <Text c="dimmed" size="sm">
                          {`${formatArabicNumber(s.number)} • ${s.nameEn}`}
                        </Text>
                      </Group>
                    </Card>
                  </UnstyledButton>
                ))
              )}
            </Stack>
          </>
        ) : (
          <Stack gap="md">
            <Stack gap={2}>
              <Text c="dimmed" size="sm">
                السورة المختارة
              </Text>
              <Text fw={700} size="lg">
                {selected.nameAr}
              </Text>
            </Stack>

            <DatePickerInput
              label="تاريخ الاستحقاق (اختياري)"
              placeholder="اختر تاريخًا"
              value={dueDate}
              onChange={(value) => {
                if (value === null) {
                  setDueDate(null)
                } else if (value instanceof Date) {
                  setDueDate(value)
                } else {
                  setDueDate(new Date(value))
                }
              }}
              minDate={new Date()}
              clearable
            />

            <Group justify="space-between">
              <Button variant="subtle" onClick={() => setSelected(null)}>
                اختيار سورة أخرى
              </Button>
              <Button onClick={handleSubmit}>إسناد</Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Drawer>
  )
}

function toUtcMidnightMs(date: Date) {
  return Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  )
}
```

- [ ] **Step 2: Index re-export**

`src/components/surahs/AssignReviewDrawer/index.ts`:

```ts
export { AssignReviewDrawer } from './AssignReviewDrawer'
export type { AssignReviewDrawerProps } from './AssignReviewDrawer'
```

- [ ] **Step 3: Storybook story**

`src/components/surahs/AssignReviewDrawer/AssignReviewDrawer.stories.tsx`:

```tsx
import { Button } from '@mantine/core'
import { useState } from 'react'
import { AssignReviewDrawer } from '.'
import type { Meta, StoryObj } from '@storybook/react-vite'

const meta = {
  title: 'Surahs/AssignReviewDrawer',
  component: AssignReviewDrawer,
  parameters: { layout: 'fullscreen' },
  args: {
    opened: false,
    onClose: () => {},
    memorizedSurahNumbers: [],
    excludeSurahNumbers: [],
    onSubmit: () => {},
  },
} satisfies Meta<typeof AssignReviewDrawer>

export default meta
type Story = StoryObj<typeof meta>

function Wrapper() {
  const [opened, setOpened] = useState(false)
  return (
    <div style={{ padding: '2rem' }}>
      <Button onClick={() => setOpened(true)}>افتح المحدد</Button>
      <AssignReviewDrawer
        opened={opened}
        onClose={() => setOpened(false)}
        memorizedSurahNumbers={[1, 2, 18, 36, 67, 112, 113, 114]}
        excludeSurahNumbers={[2]}
        onSubmit={(input) => console.log('submit', input)}
      />
    </div>
  )
}

export const Interactive: Story = {
  render: () => <Wrapper />,
}
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: exits 0. If TypeScript complains about `DatePickerInput` value typing (Mantine v8's `DatePickerInput` types vary by mode — the default `mode="default"` returns `Date | null`, but TS may widen to `DateValue | null`), the explicit narrowing branch in `onChange` handles all return shapes.

- [ ] **Step 5: Verify in Storybook**

```bash
npm run storybook
```

Open `http://localhost:6006/?path=/story/surahs-assignreviewdrawer--interactive` and confirm:
- The drawer lists 7 surahs (8 memorized minus 1 excluded).
- Searching by Arabic name (e.g. "الفاتحة") narrows the list.
- Selecting a surah moves to the date stage with the date picker.
- Submitting without picking a date logs `{ surahNumber: <n>, dueAt: undefined }`.
- Submitting with a date logs `dueAt: <ms at UTC midnight>`.

- [ ] **Step 6: Commit**

```bash
git add src/components/surahs/AssignReviewDrawer/
git commit -m "Add AssignReviewDrawer component"
```

---

### Task 11: Barrel re-export update

Adds the four new components to `src/components/surahs/index.ts`. Even though the routes import directly from sub-paths today (matching the v1 pattern), the barrel is the canonical re-export point and is listed in the design doc §6 (Modified files).

**Files:**
- Modify: `src/components/surahs/index.ts`

- [ ] **Step 1: Update the barrel**

Replace the contents of `src/components/surahs/index.ts` with:

```ts
export { SurahGradeList } from './SurahGradeList'
export { AddSurahDrawer } from './AddSurahDrawer'
export type { AddSurahDrawerProps } from './AddSurahDrawer'
export { SurahGradeRow } from './SurahGradeRow'
export { StudentsPicker } from './StudentsPicker'
export type { StudentSummary, StudentsPickerProps } from './StudentsPicker'
export { SurahReviewQueue } from './SurahReviewQueue'
export type {
  SurahReviewQueueItem,
  SurahReviewQueueProps,
} from './SurahReviewQueue'
export { SurahReviewRow } from './SurahReviewRow'
export type { SurahReviewRowProps } from './SurahReviewRow'
export { AssignReviewDrawer } from './AssignReviewDrawer'
export type { AssignReviewDrawerProps } from './AssignReviewDrawer'
export { CloseAssignmentDialog } from './CloseAssignmentDialog'
export type { CloseAssignmentDialogProps } from './CloseAssignmentDialog'
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/surahs/index.ts
git commit -m "Re-export review-assignment components from surahs barrel"
```

---

## Phase 3 — Wire the routes

### Task 12: Student route — `/_protected/surahs.tsx`

Adds the read-only `SurahReviewQueue` above the existing `SurahGradeList`. The queue prefetch joins the existing one in the route loader. When there are no open assignments, the queue renders nothing — the page looks identical to today.

**Files:**
- Modify: `src/routes/_protected/surahs.tsx`

- [ ] **Step 1: Replace the file**

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { Box, Container, Stack, Text, Title, useMantineTheme } from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMemo } from 'react'
import { api } from '../../../convex/_generated/api'
import { currentUserQuery } from '~/lib/auth-queries'
import {
  BottomNav,
  HomeTopBar,
  createHomeDashboardData,
} from '~/components/home'
import { SurahGradeList } from '~/components/surahs/SurahGradeList'
import { SurahReviewQueue } from '~/components/surahs/SurahReviewQueue'

export const Route = createFileRoute('/_protected/surahs')({
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(currentUserQuery)
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.surahGrades.listForStudent, { studentId: me.id }),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.surahReviews.listOpenForStudent, {
          studentId: me.id,
        }),
      ),
    ])
  },
  component: StudentSurahsPage,
})

function StudentSurahsPage() {
  const theme = useMantineTheme()
  const { data: me } = useSuspenseQuery(currentUserQuery)
  const { data: rows } = useSuspenseQuery(
    convexQuery(api.surahGrades.listForStudent, { studentId: me.id }),
  )
  const { data: openAssignments } = useSuspenseQuery(
    convexQuery(api.surahReviews.listOpenForStudent, { studentId: me.id }),
  )
  const homeDashboardData = useMemo(
    () => createHomeDashboardData(me.displayName),
    [me.displayName],
  )

  return (
    <Box
      style={{
        backgroundColor: theme.other.semanticColors.background,
        minHeight: '100vh',
      }}
    >
      <HomeTopBar
        brandMarkText={homeDashboardData.brandMarkText}
        brandName={homeDashboardData.brandName}
        notificationLabel={homeDashboardData.notificationLabel}
      />

      <Container
        size="xl"
        px={{ base: 'lg', sm: 'xl' }}
        py={{ base: 'lg', sm: 'xl' }}
        style={{ paddingBottom: '9rem' }}
      >
        <Stack gap="xl">
          <Stack gap="xs">
            <Text c="primary.6" fw={700} size="sm">
              حفظي
            </Text>
            <Title order={1}>السور التي حفظتها</Title>
            <Text c="dimmed">
              قائمة السور التي درستها مع آخر تقييم سجّله معلمك.
            </Text>
          </Stack>

          <SurahReviewQueue
            rows={openAssignments.map((a) => ({
              assignmentId: String(a._id),
              surahNumber: a.surahNumber,
              assignedAt: a.assignedAt,
              dueAt: a.dueAt,
            }))}
          />

          <SurahGradeList
            rows={rows.map((row) => ({
              surahNumber: row.surahNumber,
              grade: row.grade,
              updatedAt: row.updatedAt,
            }))}
            emptyMessage="لم تبدأ في حفظ أي سورة بعد. تواصل مع معلمك."
          />
        </Stack>
      </Container>

      <BottomNav
        activeItemId="surahs"
        items={homeDashboardData.bottomNavItems}
      />
    </Box>
  )
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Live-preview verification (student view, no assignments)**

```bash
npm run dev
```

Once the dev server is running, navigate to `/surahs` as a student. With **no** open review assignments, the page should look identical to today (just the grade list). Pause for the user to log in if a login screen appears — see the `feedback_auth_login` memory.

Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add src/routes/_protected/surahs.tsx
git commit -m "Render review queue on student surahs route"
```

---

### Task 13: Staff route — `/_protected/staff/students/$studentId.tsx`

Wires the editable queue, the assign drawer, the close dialog, and the cancel mutation onto the per-student grading page. The route loader prefetches `listOpenForStudent` alongside `listForStudent` and `listAllStudents`.

The page state machine:
- Two error message slots remain consolidated into one (existing `errorMessage`); any review mutation that throws surfaces here.
- New state: `assignDrawerOpen: boolean`; `closingAssignmentId: Id<'surahReviewAssignments'> | null` (controls `CloseAssignmentDialog.opened`).

**Files:**
- Modify: `src/routes/_protected/staff/students/$studentId.tsx`

- [ ] **Step 1: Replace the file**

```tsx
// src/routes/_protected/staff/students/$studentId.tsx
import { createFileRoute } from '@tanstack/react-router'
import {
  Avatar,
  Box,
  Button,
  Container,
  Group,
  Notification,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { IconClipboardPlus } from '@tabler/icons-react'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../../../../convex/_generated/api'
import type { Id } from '../../../../../convex/_generated/dataModel'
import { currentUserQuery } from '~/lib/auth-queries'
import { extractActionErrorMessage } from '~/lib/convex-errors'
import {
  BottomNav,
  HomeTopBar,
  createHomeDashboardData,
} from '~/components/home'
import { SurahGradeList } from '~/components/surahs/SurahGradeList'
import { AddSurahDrawer } from '~/components/surahs/AddSurahDrawer'
import { SurahReviewQueue } from '~/components/surahs/SurahReviewQueue'
import { AssignReviewDrawer } from '~/components/surahs/AssignReviewDrawer'
import { CloseAssignmentDialog } from '~/components/surahs/CloseAssignmentDialog'
import { getSurah } from '~/data/surahs'

export const Route = createFileRoute('/_protected/staff/students/$studentId')({
  loader: async ({ context, params }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(
        convexQuery(api.surahGrades.listAllStudents, {}),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.surahGrades.listForStudent, {
          studentId: params.studentId,
        }),
      ),
      context.queryClient.ensureQueryData(
        convexQuery(api.surahReviews.listOpenForStudent, {
          studentId: params.studentId,
        }),
      ),
    ])
  },
  component: StaffStudentGradingPage,
})

function StaffStudentGradingPage() {
  const theme = useMantineTheme()
  const { studentId } = Route.useParams()
  const { data: me } = useSuspenseQuery(currentUserQuery)
  const { data: students } = useSuspenseQuery(
    convexQuery(api.surahGrades.listAllStudents, {}),
  )
  const { data: rows } = useSuspenseQuery(
    convexQuery(api.surahGrades.listForStudent, { studentId }),
  )
  const { data: openAssignments } = useSuspenseQuery(
    convexQuery(api.surahReviews.listOpenForStudent, { studentId }),
  )

  const setGrade = useMutation(api.surahGrades.setGrade)
  const assignReview = useMutation(api.surahReviews.assign)
  const closeReview = useMutation(api.surahReviews.close)
  const cancelReview = useMutation(api.surahReviews.cancel)

  const [addSurahOpen, setAddSurahOpen] = useState(false)
  const [assignDrawerOpen, setAssignDrawerOpen] = useState(false)
  const [closingAssignmentId, setClosingAssignmentId] =
    useState<Id<'surahReviewAssignments'> | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const homeDashboardData = useMemo(
    () => createHomeDashboardData(me.displayName),
    [me.displayName],
  )

  const student = students.find((s) => s.id === studentId)

  const closingAssignment = useMemo(
    () =>
      closingAssignmentId
        ? openAssignments.find((a) => a._id === closingAssignmentId) ?? null
        : null,
    [closingAssignmentId, openAssignments],
  )
  const closingSurah = closingAssignment
    ? getSurah(closingAssignment.surahNumber)
    : null
  const closingCurrentGrade = closingAssignment
    ? rows.find((r) => r.surahNumber === closingAssignment.surahNumber)?.grade ??
      null
    : null

  async function handleChangeGrade(
    surahNumber: number,
    grade: 'good' | 'medium' | 'forgotten',
  ) {
    setErrorMessage(null)
    try {
      await setGrade({ studentId, surahNumber, grade })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر حفظ التقييم.'))
    }
  }

  async function handleAddSurah(input: {
    surahNumber: number
    grade: 'good' | 'medium' | 'forgotten'
  }) {
    setErrorMessage(null)
    try {
      await setGrade({ studentId, ...input })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر إضافة السورة.'))
    }
  }

  async function handleAssignReview(input: {
    surahNumber: number
    dueAt?: number
  }) {
    setErrorMessage(null)
    try {
      await assignReview({ studentId, ...input })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر إسناد المراجعة.'))
    }
  }

  async function handleCloseAssignment(input: {
    newGrade?: 'good' | 'medium' | 'forgotten'
  }) {
    if (!closingAssignmentId) return
    setErrorMessage(null)
    try {
      await closeReview({
        assignmentId: closingAssignmentId,
        ...(input.newGrade !== undefined ? { newGrade: input.newGrade } : {}),
      })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر إغلاق المراجعة.'))
    }
  }

  async function handleCancelAssignment(assignmentId: string) {
    if (!window.confirm('هل تريد إلغاء هذه المراجعة؟')) return
    setErrorMessage(null)
    try {
      await cancelReview({
        assignmentId: assignmentId as Id<'surahReviewAssignments'>,
      })
    } catch (error) {
      setErrorMessage(extractActionErrorMessage(error, 'تعذر إلغاء المراجعة.'))
    }
  }

  return (
    <Box
      style={{
        backgroundColor: theme.other.semanticColors.background,
        minHeight: '100vh',
      }}
    >
      <HomeTopBar
        brandMarkText={homeDashboardData.brandMarkText}
        brandName={homeDashboardData.brandName}
        notificationLabel={homeDashboardData.notificationLabel}
      />

      <Container
        size="xl"
        px={{ base: 'lg', sm: 'xl' }}
        py={{ base: 'lg', sm: 'xl' }}
        style={{ paddingBottom: '9rem' }}
      >
        <Stack gap="xl">
          <Group wrap="nowrap" align="flex-start">
            <Avatar color="primary" radius="xl" size={56}>
              {getInitials(student?.displayName ?? '')}
            </Avatar>
            <Stack gap={4} style={{ minWidth: 0 }}>
              <Text c="primary.6" fw={700} size="sm">
                تقييم الطالب
              </Text>
              <Title order={1} lineClamp={1}>
                {student?.displayName ?? 'طالب غير معروف'}
              </Title>
              <Text c="dimmed" size="sm">
                {student?.username ? `@${student.username}` : ''}
              </Text>
            </Stack>
          </Group>

          {errorMessage ? (
            <Notification
              color="red"
              title="حدث خطأ"
              onClose={() => setErrorMessage(null)}
            >
              {errorMessage}
            </Notification>
          ) : null}

          <Group justify="flex-end">
            <Button
              leftSection={<IconClipboardPlus size={16} />}
              onClick={() => setAssignDrawerOpen(true)}
              variant="light"
            >
              إسناد مراجعة
            </Button>
          </Group>

          <SurahReviewQueue
            rows={openAssignments.map((a) => ({
              assignmentId: String(a._id),
              surahNumber: a.surahNumber,
              assignedAt: a.assignedAt,
              dueAt: a.dueAt,
            }))}
            editable
            onClose={(assignmentId) =>
              setClosingAssignmentId(
                assignmentId as Id<'surahReviewAssignments'>,
              )
            }
            onCancel={handleCancelAssignment}
          />

          <SurahGradeList
            rows={rows.map((r) => ({
              surahNumber: r.surahNumber,
              grade: r.grade,
              updatedAt: r.updatedAt,
            }))}
            emptyMessage="لم يبدأ هذا الطالب الحفظ بعد. أضف أول سورة."
            editable
            onChangeGrade={handleChangeGrade}
            onAddSurah={() => setAddSurahOpen(true)}
          />
        </Stack>
      </Container>

      <AddSurahDrawer
        opened={addSurahOpen}
        onClose={() => setAddSurahOpen(false)}
        excludeSurahNumbers={rows.map((r) => r.surahNumber)}
        onSubmit={handleAddSurah}
      />

      <AssignReviewDrawer
        opened={assignDrawerOpen}
        onClose={() => setAssignDrawerOpen(false)}
        memorizedSurahNumbers={rows.map((r) => r.surahNumber)}
        excludeSurahNumbers={openAssignments.map((a) => a.surahNumber)}
        onSubmit={handleAssignReview}
      />

      <CloseAssignmentDialog
        opened={closingAssignmentId !== null}
        onClose={() => setClosingAssignmentId(null)}
        surah={closingSurah}
        currentGrade={closingCurrentGrade}
        onSubmit={handleCloseAssignment}
      />

      <BottomNav
        activeItemId="home"
        items={homeDashboardData.bottomNavItems}
      />
    </Box>
  )
}

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()
  return initials || '؟'
}
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Live-preview verification — full happy path**

```bash
npm run dev
```

Sign in as a teacher or admin, open `/staff/students/<some-student-id>`. Pause for the user to log in if needed.

Verify the following flow end-to-end:
1. Page loads with the existing grade list (today's behaviour).
2. Click **إسناد مراجعة** → drawer opens, lists only surahs the student has memorized.
3. Pick a surah, leave the date empty, click **إسناد** → drawer closes, the queue appears above the grade list with the new row showing "أُسند الآن" and no due-date pill.
4. Click **إسناد مراجعة** again → the surah just assigned is no longer in the picker (excludeSurahNumbers).
5. Re-open the drawer with a different surah, set a future date, submit → row appears with the due-date pill in primary color.
6. Click the **X** (cancel) icon on a row → a confirmation prompt appears; clicking OK removes it from the queue, clicking Cancel leaves it in place.
7. Click the **✓** (close) icon → close dialog opens with current grade visible.
8. Click "تأكيد الإغلاق" with "إبقاء التقييم الحالي" selected → row disappears from queue, grade list unchanged.
9. Repeat 2/3, then close again with a different grade chip selected → row disappears AND the matching surah's grade in the list updates.
10. Try to assign the same surah twice while one is open — `assign` should throw, the error notification surfaces "An open review assignment already exists for this surah." (or its cleaned form).

Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
git add src/routes/_protected/staff/students/\$studentId.tsx
git commit -m "Wire review-assignment surfaces on staff student page"
```

---

## Phase 4 — Final verification

### Task 14: Full lint + build sweep

A final cross-cutting check before declaring the feature done.

- [ ] **Step 1: Lint everything**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 2: Production build**

```bash
npm run build
```

Expected: succeeds (vite build + `tsc --noEmit`).

- [ ] **Step 3: Push final convex schema/state**

```bash
npx convex dev --once
```

Expected: deployment is up-to-date.

- [ ] **Step 4: No commit needed for this task** (verification only).

---

## Out of scope (per design doc §5)

These are explicitly NOT implemented in this plan:
- Notifications (in-app, email, push) for new or overdue assignments.
- Closed/cancelled assignment history view.
- Per-assignment notes or teacher comments.
- Bulk assign (multi-surah selection in one drawer submission).
- Recurring assignments.
- Assigning surahs the student has not yet memorized.
- Time-of-day precision on due dates.
- Student self-completion or "ready for review" submit step.
- Auto-cancel of overdue assignments.
- Bottom-nav badge / counter for open assignments.
- Stats summary card.
