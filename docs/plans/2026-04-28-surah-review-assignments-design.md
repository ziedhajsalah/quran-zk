# Surah Review Assignments — Design

**Status:** Approved, ready for implementation
**Date:** 2026-04-28
**Author:** Brainstormed in session
**Builds on:** [`2026-04-28-surah-memorization-grades-design.md`](./2026-04-28-surah-memorization-grades-design.md)

## 1. Context

The v1 surah-grades feature lets staff record a per-surah grade
(`good` / `medium` / `forgotten`) for each student. The `forgotten`
grade is rendered as **"يحتاج مراجعة"** on the student's view, but
there is no way for a teacher to *direct* a student to specifically
review a surah — there is only a passive grade.

Goal of this layer: give teachers an explicit "go review surah X"
action that creates a tracked assignment, surfaces it in the student's
view as a queue, and is closed by the teacher (optionally updating the
underlying grade at close).

## 2. Decisions

Each decision below was chosen during brainstorming. Alternatives are
recorded for context.

### 2.1 Standalone assignment concept, not a grade flag

A review assignment is a separate row with its own lifecycle, not a
boolean on `studentSurahGrades`. Reasoning: a student can be told to
review a surah they currently hold at `good` without us downgrading
that grade. Conflating the two would force every "needs review" signal
through the grade column.

Rejected: re-using the `forgotten` grade as the assignment signal
(same data, just better wording); a boolean
`isAssignedForReview` on the existing grade row.

### 2.2 Teacher-only lifecycle: `open` → `closed`/`cancelled`

The teacher creates and closes assignments. The student never writes.
Closing is the normal terminal state and represents "we reviewed it
together." `cancelled` is the abnormal terminal state and represents
"we won't do this — wrong assignment / no longer needed."

Rejected:
- Two-step (student submits, teacher reviews) — adds a state and a
  student-write surface for no observed benefit at this scale.
- Student self-completes — undermines the teacher-as-authority model
  inherited from v1.
- No explicit close — would leave the queue indefinitely growing or
  rely on grade changes as the implicit close, which is fragile.

### 2.3 Closing optionally updates the grade; always snapshots it

When the teacher closes an open assignment, they may either keep the
existing grade or set a new one in the same dialog. The assignment
records `closingGrade` either way (snapshot at close). If a new grade
is provided, the corresponding `studentSurahGrades` row is updated
inside the same mutation.

Rationale: closing matches the natural workflow ("we just reviewed it,
here's where the student is now") without forcing a grade change every
time. The snapshot keeps the assignment self-contained as a historical
record.

Rejected:
- Closing always updates the grade — friction in cases where the
  teacher wants to confirm the grade is unchanged.
- Closing is fully independent of the grade — loses the natural
  "review session ⇒ grade update" flow we want to encourage.

### 2.4 Review-only picker scope

The assign-picker only lists surahs that already exist on the student's
`studentSurahGrades` list. The literal product ask is "review", and v1
is intentionally narrow. Removing the filter later is a one-line
change if teachers actually need to assign new surahs through this
surface.

Rejected (deferred): allow assigning any of the 114 surahs.

### 2.5 At most one `open` assignment per `(student, surah)`

Stacking assignments doesn't reflect any realistic teacher workflow we
expect. Keeping the rule "queue item ↔ surah" simplifies the data
model, the UX, and the "I want to assign this" check. Multiple closed
or cancelled rows for the same `(student, surah)` are allowed —
those are history.

Uniqueness is enforced in the `assign` mutation, not at the index
level (Convex has no unique constraint).

Rejected: arbitrary stacking, with the queue showing duplicates.

### 2.6 Optional date-only due date

A due date is optional on `assign`. When set, it is stored as a
millisecond epoch at day precision (UTC midnight on the chosen day).
Overdue items are highlighted in the UI but not auto-cancelled, and we
do not send notifications.

Rejected:
- No due date at all — teachers reasonably want to set one when
  organizing the next session.
- Required due date — adds friction and forces a decision the teacher
  may not have.
- Time-of-day precision — out of scope; v1 is calendar-day.

### 2.7 Authority: any staff member can assign / close / cancel

Matches the flat-staff model already established in v1: any teacher
or admin can act on any student. Revisited if/when teacher-student
isolation becomes a real concern.

### 2.8 Minimal row metadata; no notes field

`notes` is intentionally omitted, mirroring the v1 design's same
choice. Defer until there is a real product ask.

### 2.9 No closed-assignment history view in v1

Closed and cancelled assignments stay in the database but no UI
surfaces them. The future generic activity-log feature is meant to
cover history across the app; building a parallel history view now is
wasted work.

## 3. Data layer (Convex)

### 3.1 Schema

```ts
// convex/schema.ts (additions)
surahReviewAssignments: defineTable({
  studentId: v.string(),
  surahNumber: v.number(),                      // 1–114
  status: v.union(
    v.literal('open'),
    v.literal('closed'),
    v.literal('cancelled'),
  ),
  dueAt: v.union(v.null(), v.number()),         // ms epoch, UTC midnight
  assignedBy: v.string(),
  assignedAt: v.number(),
  closedBy: v.union(v.null(), v.string()),
  closedAt: v.union(v.null(), v.number()),
  closingGrade: v.union(                        // snapshot at close
    v.null(),
    v.literal('good'),
    v.literal('medium'),
    v.literal('forgotten'),
  ),
})
  .index('by_student_status', ['studentId', 'status'])
  .index('by_student_surah_status', ['studentId', 'surahNumber', 'status'])
```

- `by_student_status` powers `listOpenForStudent` (`status === 'open'`).
- `by_student_surah_status` powers the uniqueness check on `assign`
  (look up `(studentId, surahNumber, 'open')`).

### 3.2 API surface — `convex/surahReviews.ts`

| Function | Type | Caller | Purpose |
|---|---|---|---|
| `listOpenForStudent({ studentId })` | query | student (own only), teacher, admin | All `open` assignments for a student, sorted by `dueAt asc nulls last`, then `assignedAt asc`. |
| `assign({ studentId, surahNumber, dueAt? })` | mutation | teacher, admin | Validates `1 ≤ surahNumber ≤ 114`; that a `studentSurahGrades` row exists for `(studentId, surahNumber)` (review-only); that no `open` assignment exists for that pair. Inserts row with `status='open'`, `assignedBy=staff._id`, `assignedAt=now`. |
| `close({ assignmentId, newGrade? })` | mutation | teacher, admin | Loads the assignment, asserts `status='open'`. Resolves the grade snapshot: if `newGrade` is provided, that is the snapshot AND the corresponding `studentSurahGrades` row is upserted via the same logic used in `surahGrades.setGrade`. If `newGrade` is omitted, the snapshot is the current `studentSurahGrades.grade` for that `(student, surah)`, or `null` if the row no longer exists (admin previously removed it). Sets `status='closed'`, `closedBy`, `closedAt`, `closingGrade` accordingly. |
| `cancel({ assignmentId })` | mutation | teacher, admin | Loads the assignment, asserts `status='open'`. Sets `status='cancelled'`, `closedBy`, `closedAt`. Does not touch `studentSurahGrades` or set `closingGrade`. |

Authorization helpers (`requireStaffAuthUser`,
`requireSelfOrStaffAuthUser`) already exist from v1 and are reused
verbatim.

`assertSurahNumber` from `convex/surahGrades.ts` is small enough to
either duplicate inside `surahReviews.ts` or pull into a shared helper
file. Implementation detail; either is fine.

## 4. UI surfaces

### 4.1 Student page — `src/routes/_protected/surahs.tsx`

Add a `SurahReviewQueue` (read-only) above the existing
`SurahGradeList`. The queue:

- Renders nothing if there are no open assignments — no empty card,
  no header.
- When non-empty, shows a heading **"للمراجعة"** and a stack of
  `SurahReviewRow` items.
- Each row shows surah name + number, an assigned-on date, and a due
  pill if `dueAt` is set. Overdue items get an orange tint matching
  the design system's choice for `forgotten`.

The route loader fetches `listOpenForStudent({ studentId: me.id })`
alongside the existing `listForStudent`.

### 4.2 Staff page — `src/routes/_protected/staff/students/$studentId.tsx`

Symmetric: the `SurahReviewQueue` (editable) renders above the
existing `SurahGradeList`, with two changes vs the student view:

- Each row gets two icon buttons: **"إغلاق"** (close) opens
  `CloseAssignmentDialog`; **"إلغاء"** (cancel) confirms and calls
  `cancel`.
- A second button next to the existing "إضافة سورة" — **"إسناد
  مراجعة"** — opens `AssignReviewDrawer`.

The route loader adds `listOpenForStudent({ studentId })` to the
existing prefetch list.

### 4.3 New components in `src/components/surahs/`

| Component | Props | Used by |
|---|---|---|
| `SurahReviewQueue` | `rows: ReadonlyArray<{ assignmentId, surahNumber, dueAt, assignedAt }>`, `editable?`, `onClose?(assignmentId)`, `onCancel?(assignmentId)` | Both routes. Empty array → renders nothing. |
| `SurahReviewRow` | `surah`, `dueAt`, `assignedAt`, `editable?`, `onClose?`, `onCancel?` | Inside `SurahReviewQueue`. |
| `AssignReviewDrawer` | `memorizedSurahNumbers: ReadonlyArray<number>`, `excludeSurahNumbers: ReadonlyArray<number>`, `onSubmit({ surahNumber, dueAt? })` | Staff page. Mantine `Drawer` with searchable list scoped to `memorizedSurahNumbers \ excludeSurahNumbers`, plus an optional `DatePickerInput`. |
| `CloseAssignmentDialog` | `surah`, `currentGrade`, `onSubmit({ newGrade? })` | Staff page. Modal: shows surah and current grade, with options "إبقاء التقييم الحالي" (omit `newGrade`) and three grade chips. |

Errors from any mutation surface as a Mantine `Notification` on the
parent route, mirroring the existing v1 pattern. No optimistic
updates — Convex reactive queries refresh automatically.

### 4.4 Storybook

One story file per new component, matching the existing pattern in
`src/components/surahs/`.

### 4.5 Discoverability

No new top-level link is added. The student finds open reviews by
visiting `/surahs` (already in the bottom nav). Staff find the assign
button by visiting `/staff/students/$studentId` from the existing
students picker.

## 5. Out of scope for v1

Considered and explicitly deferred:

- Notifications (in-app, email, push) for new or overdue assignments.
- Closed/cancelled assignment history view (deferred to the future
  generic activity log).
- Per-assignment notes or teacher comments.
- Bulk assign (multi-surah selection in one drawer submission).
- Recurring assignments.
- Assigning surahs the student has not yet memorized.
- Time-of-day precision on due dates.
- Student self-completion or "ready for review" submit step.
- Auto-cancel of overdue assignments.
- Bottom-nav badge / counter for open assignments.
- Stats summary card ("X مراجعة مفتوحة، Y متأخرة").

## 6. Files touched

**New:**

- `convex/surahReviews.ts`
- `src/components/surahs/SurahReviewQueue/{SurahReviewQueue.tsx,SurahReviewQueue.stories.tsx,index.ts}`
- `src/components/surahs/SurahReviewRow/{SurahReviewRow.tsx,SurahReviewRow.stories.tsx,index.ts}`
- `src/components/surahs/AssignReviewDrawer/{AssignReviewDrawer.tsx,AssignReviewDrawer.stories.tsx,index.ts}`
- `src/components/surahs/CloseAssignmentDialog/{CloseAssignmentDialog.tsx,CloseAssignmentDialog.stories.tsx,index.ts}`

**Modified:**

- `convex/schema.ts` — add `surahReviewAssignments` table.
- `src/routes/_protected/surahs.tsx` — render `SurahReviewQueue` above
  `SurahGradeList`; add the new query to the route loader.
- `src/routes/_protected/staff/students/$studentId.tsx` — render
  `SurahReviewQueue` (editable); wire `AssignReviewDrawer`,
  `CloseAssignmentDialog`, and the `cancel` mutation; add the new
  query to the route loader.
- `src/components/surahs/index.ts` — re-export new components.
