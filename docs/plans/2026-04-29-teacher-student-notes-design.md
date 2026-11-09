# Teacher Student Notes — Design

**Status:** Approved, ready for implementation
**Date:** 2026-04-29
**Author:** Brainstormed in session
**Builds on:** [`2026-04-28-surah-review-assignments-design.md`](./2026-04-28-surah-review-assignments-design.md)

## 1. Context

Teachers track each student's surah grades and assign reviews, but
they have no way to capture qualitative observations that don't map
to a grade or a specific surah — things like "memorizes faster after
Maghrib", "needs encouragement on long surahs", or "absent this
week, family travel".

Goal: give a teacher a free-form notebook per student. Any teacher
can read any student's notes; only the author can edit or delete a
note they wrote.

## 2. Decisions

Each decision below was made during brainstorming. Alternatives are
recorded for context.

### 2.1 General notes, not surah- or review-scoped

A note is attached to a student, full stop. It is not tied to a
specific surah or to a review assignment.

Rejected:
- Per-surah notes — would couple the feature to the grade row and
  force the user to pick a surah for general observations.
- Per-review-assignment notes — would only capture feedback at
  closing time, missing day-to-day observations.
- A mixed surface where each note can optionally point at a surah
  or assignment — adds schema complexity for a use-case the user
  did not ask for. (YAGNI.)

### 2.2 Multiple notes over time, author-edits-own

Each note is its own entry with `createdAt`. New notes are appended
over time. The author can edit and delete their own past notes.
Other staff cannot edit or delete notes they didn't write.

Rejected:
- Single editable text field per student — loses history; one
  teacher's edit overwrites another's.
- Multiple notes but immutable — fine forensically but irritating
  for typo fixes.
- Multiple notes, anyone-edits-anyone — too easy to clobber a
  colleague's intent.

### 2.3 Visibility: any staff reads any note

All staff (and admins) can read all notes about any student.
Students cannot read notes about themselves.

Rejected:
- Author-private (only author + admin can read) — too restrictive
  for a small teaching team.
- Student-visible — would change the writing voice and turn notes
  into communication rather than observation.
- Per-note "private to me" toggle — extra UI, no clear demand.

### 2.4 Plain text only

Free-form `string` body. No tags, no categories, no markdown, no
attachments.

Rejected:
- Tags / categories — premature taxonomy.
- Required type (Behavior / Progress / etc.) — friction without
  value at this scale.
- Rich text — implementation surface area not justified.

### 2.5 Tabs replace stacked sections on the student page

The student detail page restructures into three tabs:
**المراجعات** (Reviews) · **السور** (Grades) · **الملاحظات** (Notes).
The existing "إسناد مراجعة" button moves inside the Reviews tab.

Rejected:
- Append a Notes section below the existing two — page becomes
  long and the Notes section gets buried.
- Drawer/modal entry from the header — hides notes; teachers won't
  remember to look.
- Separate route — adds navigation cost without payoff.

### 2.6 Drawer-based add/edit, modal-based delete confirm

"إضافة ملاحظة" opens a Mantine `Drawer` containing a `Textarea`
and Submit/Cancel — same pattern as `AddSurahDrawer` and
`AssignReviewDrawer`. The same drawer is reused in edit mode via
an `initialBody` prop.

Delete uses a Mantine modal confirm dialog (not `window.confirm`)
for visual consistency with the rest of the app.

### 2.7 No edit/delete time window

The author can edit or delete their own notes forever. There is no
"after 24h it's locked" rule.

### 2.8 Hard delete, not soft delete

Delete removes the row. There is no audit/compliance requirement
that justifies a `deletedAt` column.

### 2.9 No Convex unit tests in this PR

The repo currently has no Convex tests for `surahGrades.ts` or
`surahReviews.ts`. Adding them only for `studentNotes.ts` would
introduce inconsistency. If a Convex test pattern is later
established, this file will be one of the first to backfill.

## 3. Data model

New Convex table:

```ts
studentNotes: defineTable({
  studentId: v.string(),         // matches studentSurahGrades.studentId
  authorId: v.string(),          // staff user id
  body: v.string(),              // free-form text, trimmed, ≤ 2000 chars
  createdAt: v.number(),         // ms; immutable display timestamp
  editedAt: v.union(v.null(), v.number()), // null until first edit
})
  .index('by_student', ['studentId'])
  .index('by_student_created', ['studentId', 'createdAt'])
```

Notes:
- No `updatedAt`. `createdAt` stays immutable; `editedAt` is the
  single signal that "this has been edited".
- The 2000-character cap is validated in mutations, not in the
  schema (Convex schemas can't constrain string length).

## 4. Convex API

New file `convex/studentNotes.ts`. Patterns mirror
`convex/surahReviews.ts`.

### `listForStudent(studentId) → Note[]`

Query. `requireStaffAuthUser`. Returns all notes for the student,
sorted newest-first by `createdAt`. Each row is enriched with
`authorDisplayName` (resolved server-side; falls back to
`'مستخدم محذوف'` if the author was deleted) so the UI does not need
a per-row second query.

### `add({ studentId, body })`

Mutation. `requireStaffAuthUser`. Trims `body`. Throws
`ConvexError` if empty or > 2000 chars. Inserts a row with
`authorId = String(staff._id)`, `createdAt = Date.now()`,
`editedAt = null`.

### `edit({ noteId, body })`

Mutation. `requireStaffAuthUser`. Loads the note. Throws if not
found or if `note.authorId !== String(staff._id)`. Validates body
the same way as `add`. Patches `body` and `editedAt = Date.now()`.

### `remove({ noteId })`

Mutation. `requireStaffAuthUser`. Same author check as `edit`.
`ctx.db.delete(noteId)`.

## 5. UI

### 5.1 Page structure

`src/routes/_protected/staff/students/$studentId.tsx` keeps the
header (avatar, name, error notification) and switches the body
to a Mantine `Tabs` component:

- **المراجعات (Reviews)** — `SurahReviewQueue` + the existing
  "إسناد مراجعة" button.
- **السور (Grades)** — `SurahGradeList` + the existing add-surah
  drawer.
- **الملاحظات (Notes)** — new `StudentNotesList`.

### 5.2 New components

All under `src/components/staff/` (these are staff-facing, not
surah-related), each with a Storybook story matching existing
conventions.

- `StudentNotesList/` — body of the Notes tab. Header with
  "إضافة ملاحظة" button. Empty state: "لا توجد ملاحظات بعد".
  Otherwise a vertical stack of `StudentNoteCard`.
- `StudentNoteCard/` — renders one note: author display name,
  relative timestamp ("قبل ٣ أيام"), an "تم التعديل" hint when
  `editedAt` is set, then the body. If the current user is the
  author, an icon menu offers Edit / Delete.
- `AddNoteDrawer/` — Mantine `Drawer`. `Textarea` with
  `maxLength={2000}` and a live character counter. Reused for
  editing via an optional `initialBody` prop and an
  `onSubmit(body)` callback.
- `DeleteNoteDialog/` — Mantine modal. "هل تريد حذف هذه الملاحظة؟"
  with Confirm / Cancel.

### 5.3 Route loader

The route loader prefetches `studentNotes.listForStudent` alongside
the existing prefetches so the Notes tab is hot when first opened.

## 6. Error handling and edge cases

- All three mutations are wrapped in try/catch on the page; errors
  flow through the existing `errorMessage` notification with
  Arabic defaults via `extractActionErrorMessage`.
- Deleted author → `'مستخدم محذوف'` from the resolver, no throw.
- Concurrent edit by the same author → last write wins.
- Empty body after trim → server `ConvexError`; the drawer also
  disables Submit when trimmed body is empty.
- Body at the cap → `Textarea maxLength={2000}` blocks over-typing;
  the server still validates as defense-in-depth.
- Switching tabs mid-edit → the drawer overlays all tabs and stays
  open. Closing it discards unsaved input. No "are you sure?"
  prompt.

## 7. Build order

Each step is independently verifiable.

1. Add `studentNotes` to `convex/schema.ts`. Verify with
   `npx convex dev`.
2. Implement `convex/studentNotes.ts` (list, add, edit, remove).
3. Build the four new components in isolation with Storybook
   stories: `StudentNoteCard`, `AddNoteDrawer`, `DeleteNoteDialog`,
   `StudentNotesList`.
4. Restructure `$studentId.tsx` into Mantine `Tabs`. Move existing
   sections into Reviews/Grades tabs. Mount `StudentNotesList` in
   the Notes tab and wire the mutations.
5. Add `studentNotes.listForStudent` to the route loader prefetch.
6. End-to-end verification on the live preview server: log in as
   one teacher, add/edit/delete a note, log in as a second
   teacher, confirm visibility and that edit/delete are hidden on
   the other teacher's notes.

After step 4 the feature is functionally complete; step 5 is
polish; step 6 is verification.
