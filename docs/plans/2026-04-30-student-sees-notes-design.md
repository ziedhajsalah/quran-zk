# Student Sees Notes — Design

**Status:** Approved, ready for implementation
**Date:** 2026-04-30
**Author:** Brainstormed in session
**Builds on:** [`2026-04-29-teacher-student-notes-design.md`](./2026-04-29-teacher-student-notes-design.md)

## 1. Context

Teachers can now create notes for a student via the staff student
page. The student themselves has no way to see those notes. The
goal of this change is to surface the existing `studentNotes` data
to the owning student in a read-only view.

Out of scope:

- Unread badges, last-seen tracking.
- Acknowledge / "I read this" actions.
- Replies or threading.
- Notifications (push, email).

These were considered and explicitly deferred (see §2.2).

## 2. Decisions

### 2.1 Placement: third tab on `/surahs`

The student's `/surahs` route is restructured into Mantine `Tabs`
mirroring the staff student page:

1. **المراجعات** (Reviews) — existing `SurahReviewQueue`.
2. **السور** (Grades) — existing `SurahGradeList`.
3. **الملاحظات** (Notes) — new, read-only.

`defaultValue="reviews"` because the review queue is the most
action-oriented tab for the student and matches the staff page's
default.

Rejected:

- New section stacked on the existing page — buries the review
  queue and makes the page long.
- Dedicated `/notes` route + 4th bottom-nav entry — adds navigation
  cost without payoff at this scale; bottom nav is currently 3
  items and adding a 4th for a passive surface is unbalanced.

### 2.2 Read-only, no engagement features

The student sees author, timestamp, edit indicator, and body. No
unread state, no acknowledge button, no reply.

Rejected:

- Unread badge with server-tracked `lastSeenAt` — extra schema and
  query, premature before we know whether students check the tab.
- Acknowledge action — couples notes into a workflow they were not
  designed for.
- Replies — turns "teacher observation" into "two-way thread",
  changes the writing voice, and creates a moderation surface.

### 2.3 Backend: extend `listForStudent`, not a new query

`convex/studentNotes.ts:listForStudent` is changed to use
`requireSelfOrStaffAuthUser(ctx, args.studentId)` so the same
query serves both staff and the owning student. Data shape is
identical for both audiences; there is no field a student should
see that staff shouldn't, or vice versa.

Mutations (`add`, `edit`, `remove`) stay staff-only. Students can
read but never mutate.

Rejected:

- Separate `listForCurrentStudent()` query that derives `studentId`
  from auth — duplicates the author-name resolution logic for no
  practical isolation benefit.

### 2.4 Reuse `StudentNotesList`, do not fork

`StudentNotesList` already renders read-only when `isAuthor=false`
(via `currentUserId !== row.authorId`); the menu/edit/delete are
hidden per-row. Two small adjustments make it usable from the
student page without forking:

- Make `onAdd` / `onEdit` / `onDelete` optional. Only render the
  "إضافة ملاحظة" header button when `onAdd` is provided.
- Accept an optional `emptyMessage` prop, defaulting to the
  current "لا توجد ملاحظات بعد" so the staff page is unchanged.
  Student page passes "لا توجد ملاحظات من معلمك بعد" so it's clear
  *whose* notes are missing.

The component lives at `src/components/staff/StudentNotesList/`.
The path label "staff" is misleading post-change but renaming or
moving the directory is outside this change's scope.

Rejected:

- New `MyNotesList` component — duplicates layout, header logic,
  and empty-state handling for no benefit.
- Move/rename `StudentNotesList` to a neutral location — touches
  more files (imports, stories) than the feature warrants.

## 3. Data model

No schema changes. `studentNotes` from
[`2026-04-29-teacher-student-notes-design.md`](./2026-04-29-teacher-student-notes-design.md)
§3 is reused as-is.

## 4. Convex API change

Single edit in `convex/studentNotes.ts`:

```ts
// before
await requireStaffAuthUser(ctx)
// after
await requireSelfOrStaffAuthUser(ctx, args.studentId)
```

Inside `listForStudent` only. `add`, `edit`, `remove` are
unchanged.

`requireSelfOrStaffAuthUser` already exists at
`convex/auth/helpers.ts:67` and enforces "the caller is either the
student in question, or has the `teacher`/`admin` role". A
student attempting to read another student's notes throws
`'Unauthorized'`.

## 5. UI changes

### 5.1 Route restructure

`src/routes/_protected/surahs.tsx`:

- Wrap the page body in Mantine `<Tabs defaultValue="reviews">`
  with three `Tabs.Tab` triggers and three `Tabs.Panel` panels.
- Move the current `SurahReviewQueue` render into the Reviews
  panel.
- Move the current `SurahGradeList` render into the Grades panel.
- Mount `StudentNotesList` in the Notes panel with:
  - `rows` mapped from `notes`.
  - `currentUserId={String(me.id)}` (every row falls into the
    `isAuthor=false` branch since the student never authors).
  - `emptyMessage="لا توجد ملاحظات من معلمك بعد"`.
  - `onAdd` / `onEdit` / `onDelete` omitted.

### 5.2 Route loader

The loader gains one extra `ensureQueryData` call:

```ts
context.queryClient.ensureQueryData(
  convexQuery(api.studentNotes.listForStudent, { studentId: me.id }),
)
```

Added to the existing `Promise.all` so the Notes tab is hot when
first opened.

### 5.3 Component change — `StudentNotesList`

`src/components/staff/StudentNotesList/StudentNotesList.tsx`:

- `onAdd?: () => void`
- `onEdit?: (noteId: string) => void`
- `onDelete?: (noteId: string) => void`
- `emptyMessage?: string` (default `'لا توجد ملاحظات بعد'`)

The header `Group` is rendered only when `onAdd` is defined. The
`Title` ("الملاحظات") still renders unconditionally — without an
add button it sits alone, which is fine and matches the empty
header treatment of nearby surfaces. The empty-state `<Text>` uses
`emptyMessage`.

The staff student page (`$studentId.tsx`) is not changed; it
already passes `onAdd`/`onEdit`/`onDelete` and gets the existing
default empty message.

## 6. Error handling and edge cases

- Auth boundary — student passing a different `studentId` to
  `listForStudent` throws `'Unauthorized'` from
  `requireSelfOrStaffAuthUser`. Already enforced; no extra check
  needed.
- Deleted teacher author — `resolveAuthorDisplayName` already
  returns `'مستخدم محذوف'`. The student sees the same fallback as
  staff.
- Edited note — the `editedAt` badge ("تم التعديل") on
  `StudentNoteCard` is shown to the student exactly as it is to
  staff.
- Pagination cap — `MAX_NOTES_PER_STUDENT = 100` is unchanged;
  this matches what staff sees.
- Tab switching mid-render — the staff page passes
  `keepMounted={false}`. The student page has no drawers and no
  per-tab local state worth preserving; the default
  `keepMounted={true}` is appropriate and avoids remount churn on
  tab toggle. Convex queries stay subscribed via the loader
  regardless of mount state.

## 7. Verification

- **Storybook**: add a "Read-only / student view" story to
  `StudentNotesList.stories.tsx` exercising the new branches:
  `onAdd` omitted, custom `emptyMessage`, `currentUserId` set to
  a value that does not match any `authorId`.
- **Manual browser check** via `preview_*`:
  1. Log in as teacher → `/staff/students/<id>` → add a note
     "هذا اختبار" for a known student.
  2. Log out, log in as that student → `/surahs`.
  3. Click الملاحظات tab → confirm the note shows author, time,
     body. Confirm no menu, no add button, no edit/delete.
  4. Optionally repeat with a teacher who later edits the note —
     the student sees the "تم التعديل" badge.
  5. With a student who has zero notes, confirm the
     "لا توجد ملاحظات من معلمك بعد" empty state.
- **Auth boundary**: covered by the existing
  `requireSelfOrStaffAuthUser` helper. No new automated test —
  consistent with §2.9 of the prior notes spec (no Convex tests
  in this codebase yet).

## 8. Build order

Each step independently verifiable.

1. Update `StudentNotesList` to make handler props optional and
   accept `emptyMessage`. Add the read-only Storybook story.
   Verify staff page still works (no prop changes on the staff
   side).
2. Change `listForStudent` in `convex/studentNotes.ts` to use
   `requireSelfOrStaffAuthUser`. Verify staff still reads notes
   and a student can read their own.
3. Restructure `src/routes/_protected/surahs.tsx` into tabs;
   add the loader prefetch; mount `StudentNotesList` in the Notes
   tab.
4. End-to-end verification per §7.

After step 3 the feature is functionally complete; step 4 is
verification.
