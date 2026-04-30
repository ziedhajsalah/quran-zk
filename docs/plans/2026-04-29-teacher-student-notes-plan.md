# Teacher Student Notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the teacher student notes feature: any staff member can read all notes attached to a student, but only the author can edit or delete a note. The student detail page is restructured into three tabs (Reviews / Grades / Notes), and the new Notes tab provides add/edit/delete via a Mantine drawer plus a confirm modal.

**Architecture:** New Convex table `studentNotes` with two indexes; four functions in a new `convex/studentNotes.ts` reusing the existing `requireStaffAuthUser` helper; four new Mantine components (`StudentNoteCard`, `AddNoteDrawer`, `DeleteNoteDialog`, `StudentNotesList`) under `src/components/staff/`; `_protected/staff/students/$studentId.tsx` is restructured to host its three feature areas inside `Mantine.Tabs`.

**Tech Stack:** Convex 1.34 with Better Auth, TanStack Router/Query, Mantine v8, React 19, TypeScript strict, Storybook 10. Already-installed; nothing new to add.

**Verification model — important:** This project has no automated test runner. The verification loop is:
1. `npm run lint` (runs `tsc && eslint`) — must pass after every code change.
2. `npx convex dev --once` — pushes schema/function updates to the dev deployment; must succeed for backend changes.
3. Storybook stories — visual verification for each new component (mandatory; matches the existing pattern for `src/components/surahs/`).
4. `npm run dev` (live preview) — manual verification for routes and end-to-end flows. The user handles login when verification needs auth.

**Reference reading before starting backend tasks:** `convex/_generated/ai/guidelines.md` (per `CLAUDE.md`).

**Builds on:** [`2026-04-29-teacher-student-notes-design.md`](./2026-04-29-teacher-student-notes-design.md) — the approved design doc. Read §2 (decisions), §3 (data model), §4 (Convex API), and §5 (UI) before starting.

**Convex API style notes:**
- Existing project code calls `ctx.db.patch`, `ctx.db.delete`, and `ctx.db.insert` with the table name as the first argument: `ctx.db.patch('tableName', id, fields)`. Match that pattern.
- Single-user lookup uses `await auth.api.getUser({ query: { id }, headers })` after `const { auth, headers } = await authComponent.getAuth(createAuth, ctx)`. See `convex/auth/admin.ts:141`.
- The auth helpers expose `String(user._id)` as the canonical user-id format used by `assignedBy`, `closedBy`, `updatedBy`, etc.

**Arabic UI strings used in this plan:**
- "ملاحظات" — Notes (tab title)
- "إضافة ملاحظة" — Add note (button)
- "تعديل ملاحظة" — Edit note (drawer title in edit mode)
- "حفظ" — Save (drawer submit)
- "إلغاء" — Cancel
- "تم التعديل" — Edited (badge)
- "لا توجد ملاحظات بعد" — No notes yet (empty state)
- "هل تريد حذف هذه الملاحظة؟" — Are you sure you want to delete this note? (confirm)
- "حذف" — Delete
- "مستخدم محذوف" — Deleted user (author fallback)
- "المراجعات" — Reviews (tab)
- "السور" — Grades / Surahs (tab)

---

## Phase 1 — Convex backend

### Task 1: Schema — add `studentNotes` table

**Files:**
- Modify: `convex/schema.ts`

- [ ] **Step 1: Add the table to the existing schema**

Append the new table inside the `defineSchema({ ... })` object in `convex/schema.ts`, after `surahReviewAssignments`:

```ts
studentNotes: defineTable({
  studentId: v.string(),
  authorId: v.string(),
  body: v.string(),
  createdAt: v.number(),
  editedAt: v.union(v.null(), v.number()),
})
  .index('by_student', ['studentId'])
  .index('by_student_created', ['studentId', 'createdAt']),
```

- [ ] **Step 2: Push schema to dev deployment**

```bash
npx convex dev --once
```

Expected: schema deploys successfully and the new `studentNotes` table + indexes appear in the Convex dashboard. No TypeScript errors.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add convex/schema.ts
git commit -m "Add studentNotes table"
```

---

### Task 2: Convex query — `listForStudent`

Returns all notes for a student, sorted newest-first, with `authorDisplayName` resolved server-side.

**Files:**
- Create: `convex/studentNotes.ts`

- [ ] **Step 1: Create the file with imports + the query**

```ts
import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
import type { QueryCtx, MutationCtx } from './_generated/server'
import { authComponent } from './auth'
import { createAuth } from './auth'
import { requireStaffAuthUser } from './auth/helpers'

const MAX_BODY_LENGTH = 2000

async function resolveAuthorDisplayName(
  ctx: QueryCtx | MutationCtx,
  authorId: string,
): Promise<string> {
  try {
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)
    const user = await auth.api.getUser({ query: { id: authorId }, headers })
    return user?.name ?? 'مستخدم محذوف'
  } catch {
    return 'مستخدم محذوف'
  }
}

export const listForStudent = query({
  args: { studentId: v.string() },
  handler: async (ctx, args) => {
    await requireStaffAuthUser(ctx)
    const rows = await ctx.db
      .query('studentNotes')
      .withIndex('by_student_created', (q) =>
        q.eq('studentId', args.studentId),
      )
      .collect()
    const sorted = [...rows].sort((a, b) => b.createdAt - a.createdAt)
    return Promise.all(
      sorted.map(async (n) => ({
        ...n,
        authorDisplayName: await resolveAuthorDisplayName(ctx, n.authorId),
      })),
    )
  },
})
```

> If `convex/auth.ts` doesn't export `createAuth` directly, adjust the import to match how `convex/surahGrades.ts` already imports `createAuth` (look at the top of that file). Do not invent a new module path.

- [ ] **Step 2: Verify the import resolves**

Open `convex/surahGrades.ts` and copy its exact `createAuth` import line. Adjust `convex/studentNotes.ts` if the path differs.

- [ ] **Step 3: Push to dev**

```bash
npx convex dev --once
```

Expected: deploy succeeds; `api.studentNotes.listForStudent` is generated in `convex/_generated/api.d.ts`.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add convex/studentNotes.ts
git commit -m "Add studentNotes.listForStudent query"
```

---

### Task 3: Convex mutation — `add`

Inserts a new note for a student. Trims body, rejects empty or > 2000 chars.

**Files:**
- Modify: `convex/studentNotes.ts`

- [ ] **Step 1: Append the mutation**

```ts
export const add = mutation({
  args: {
    studentId: v.string(),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    const trimmed = args.body.trim()
    if (trimmed.length === 0) {
      throw new ConvexError('Note body cannot be empty.')
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      throw new ConvexError('Note body is too long.')
    }
    const now = Date.now()
    await ctx.db.insert('studentNotes', {
      studentId: args.studentId,
      authorId: String(staff._id),
      body: trimmed,
      createdAt: now,
      editedAt: null,
    })
  },
})
```

- [ ] **Step 2: Push to dev**

```bash
npx convex dev --once
```

Expected: deploy succeeds.

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add convex/studentNotes.ts
git commit -m "Add studentNotes.add mutation"
```

---

### Task 4: Convex mutation — `edit`

Author-only. Updates `body` and stamps `editedAt`.

**Files:**
- Modify: `convex/studentNotes.ts`

- [ ] **Step 1: Append the mutation**

```ts
export const edit = mutation({
  args: {
    noteId: v.id('studentNotes'),
    body: v.string(),
  },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    const note = await ctx.db.get(args.noteId)
    if (!note) {
      throw new ConvexError('Note not found.')
    }
    if (note.authorId !== String(staff._id)) {
      throw new ConvexError('You can only edit your own notes.')
    }
    const trimmed = args.body.trim()
    if (trimmed.length === 0) {
      throw new ConvexError('Note body cannot be empty.')
    }
    if (trimmed.length > MAX_BODY_LENGTH) {
      throw new ConvexError('Note body is too long.')
    }
    await ctx.db.patch('studentNotes', args.noteId, {
      body: trimmed,
      editedAt: Date.now(),
    })
  },
})
```

- [ ] **Step 2: Push, lint, commit**

```bash
npx convex dev --once && npm run lint
git add convex/studentNotes.ts
git commit -m "Add studentNotes.edit mutation"
```

---

### Task 5: Convex mutation — `remove`

Author-only. Hard delete.

**Files:**
- Modify: `convex/studentNotes.ts`

- [ ] **Step 1: Append the mutation**

```ts
export const remove = mutation({
  args: { noteId: v.id('studentNotes') },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    const note = await ctx.db.get(args.noteId)
    if (!note) {
      throw new ConvexError('Note not found.')
    }
    if (note.authorId !== String(staff._id)) {
      throw new ConvexError('You can only delete your own notes.')
    }
    await ctx.db.delete('studentNotes', args.noteId)
  },
})
```

- [ ] **Step 2: Push, lint, commit**

```bash
npx convex dev --once && npm run lint
git add convex/studentNotes.ts
git commit -m "Add studentNotes.remove mutation"
```

---

## Phase 2 — UI components in isolation (with Storybook)

Each component lives in its own folder under `src/components/staff/<Name>/`, with three files:
- `<Name>.tsx` — the component
- `<Name>.stories.tsx` — Storybook stories
- `index.ts` — re-export

Match the file shape of an existing reference: `src/components/surahs/SurahReviewRow/`.

### Task 6: Component — `StudentNoteCard`

Renders one note: author name, relative timestamp, an "edited" badge if applicable, body text. If `isAuthor`, a Mantine `Menu` with Edit / Delete items appears in the corner.

**Files:**
- Create: `src/components/staff/StudentNoteCard/StudentNoteCard.tsx`
- Create: `src/components/staff/StudentNoteCard/StudentNoteCard.stories.tsx`
- Create: `src/components/staff/StudentNoteCard/index.ts`

- [ ] **Step 1: Implement the component**

The props shape:

```ts
export type StudentNoteCardProps = {
  authorDisplayName: string
  createdAt: number
  editedAt: number | null
  body: string
  isAuthor: boolean
  onEdit?: () => void
  onDelete?: () => void
}
```

Render with Mantine `Card` (or `Paper`) + `Stack`. Top row: `Group justify="space-between"` containing `<Text fw={600}>{authorDisplayName}</Text>` + a relative timestamp formatted via `dayjs` with the Arabic locale (look for an existing `dayjs.locale('ar')` setup in `src/lib/` or `src/utils/`; if there isn't one, format with `new Intl.RelativeTimeFormat('ar')` instead). Show a `Badge size="xs">تم التعديل</Badge>` next to the timestamp when `editedAt !== null`. Body uses `<Text style={{ whiteSpace: 'pre-wrap' }}>{body}</Text>` so newlines render.

When `isAuthor`, render a `Menu` at the top-right with two `Menu.Item`s: "تعديل" → `onEdit` and "حذف" → `onDelete` (with `IconPencil` and `IconTrash` from `@tabler/icons-react`).

- [ ] **Step 2: Add Storybook stories**

Stories: `Default`, `Edited`, `LongBody` (a 1500-char lorem in Arabic), `IsAuthor` (shows menu), `NotAuthor` (no menu). Match the meta format used by `src/components/surahs/SurahReviewRow/SurahReviewRow.stories.tsx`.

- [ ] **Step 3: Add index.ts**

```ts
export { StudentNoteCard } from './StudentNoteCard'
export type { StudentNoteCardProps } from './StudentNoteCard'
```

- [ ] **Step 4: Verify in Storybook**

```bash
npm run storybook
```

Open the new `StudentNoteCard` stories. Confirm all five render correctly. Stop the server when done.

- [ ] **Step 5: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/components/staff/StudentNoteCard
git commit -m "Add StudentNoteCard component"
```

---

### Task 7: Component — `AddNoteDrawer` (also used for editing)

A Mantine `Drawer` housing a `Textarea` with character counter plus Submit/Cancel buttons. Reused for editing via `initialBody`.

**Files:**
- Create: `src/components/staff/AddNoteDrawer/AddNoteDrawer.tsx`
- Create: `src/components/staff/AddNoteDrawer/AddNoteDrawer.stories.tsx`
- Create: `src/components/staff/AddNoteDrawer/index.ts`

- [ ] **Step 1: Implement**

Props:

```ts
export type AddNoteDrawerProps = {
  opened: boolean
  onClose: () => void
  initialBody?: string                       // when set, drawer is in edit mode
  onSubmit: (body: string) => Promise<void> | void
}
```

Inside the component:
- Local `body` state initialised from `initialBody ?? ''`. `useEffect` syncs it whenever `opened` flips to `true`.
- `Textarea` with `maxLength={2000}`, `autosize` `minRows={4}`, `maxRows={12}`.
- A character-counter `<Text size="xs" c="dimmed">{body.length} / 2000</Text>`.
- Submit button is disabled when `body.trim().length === 0`. On click: `await onSubmit(body)` then `onClose()` and reset local state. Wrap in a try/catch only if needed for local error state — error display lives on the parent page.
- Drawer title is "تعديل ملاحظة" when `initialBody !== undefined`, otherwise "إضافة ملاحظة".

Match the layout pattern of `src/components/surahs/AddSurahDrawer/AddSurahDrawer.tsx`.

- [ ] **Step 2: Add Storybook stories**

Stories: `AddMode`, `EditMode` (with prefilled body), `AtLimit` (body length === 2000), and `Empty` (body is whitespace; submit disabled).

- [ ] **Step 3: Add index.ts**

```ts
export { AddNoteDrawer } from './AddNoteDrawer'
export type { AddNoteDrawerProps } from './AddNoteDrawer'
```

- [ ] **Step 4: Verify in Storybook + lint**

```bash
npm run storybook   # check stories visually, then stop
npm run lint
```

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/AddNoteDrawer
git commit -m "Add AddNoteDrawer component (used for add and edit)"
```

---

### Task 8: Component — `DeleteNoteDialog`

Small Mantine `Modal` confirm. Replaces `window.confirm` for visual consistency.

**Files:**
- Create: `src/components/staff/DeleteNoteDialog/DeleteNoteDialog.tsx`
- Create: `src/components/staff/DeleteNoteDialog/DeleteNoteDialog.stories.tsx`
- Create: `src/components/staff/DeleteNoteDialog/index.ts`

- [ ] **Step 1: Implement**

Props:

```ts
export type DeleteNoteDialogProps = {
  opened: boolean
  onClose: () => void
  onConfirm: () => Promise<void> | void
}
```

Body: a single `<Text>هل تريد حذف هذه الملاحظة؟</Text>`. Footer: `Group justify="flex-end"` with `Button variant="default" onClick={onClose}>إلغاء</Button>` and `Button color="red" onClick={async () => { await onConfirm(); onClose() }}>حذف</Button>`.

- [ ] **Step 2: Add stories** — `Default` and `WithSlowConfirm` (an `onConfirm` that returns a 1-second `setTimeout` Promise; verifies the confirm button stays clickable, no inflight UI required).

- [ ] **Step 3: Add index.ts**

- [ ] **Step 4: Verify in Storybook + lint + commit**

```bash
npm run storybook   # verify
npm run lint
git add src/components/staff/DeleteNoteDialog
git commit -m "Add DeleteNoteDialog component"
```

---

### Task 9: Component — `StudentNotesList`

Composes the cards and the empty state. The "Add note" button lives in the header of this component.

**Files:**
- Create: `src/components/staff/StudentNotesList/StudentNotesList.tsx`
- Create: `src/components/staff/StudentNotesList/StudentNotesList.stories.tsx`
- Create: `src/components/staff/StudentNotesList/index.ts`

- [ ] **Step 1: Implement**

Props:

```ts
export type StudentNoteRow = {
  noteId: string
  authorDisplayName: string
  authorId: string
  createdAt: number
  editedAt: number | null
  body: string
}

export type StudentNotesListProps = {
  rows: ReadonlyArray<StudentNoteRow>
  currentUserId: string
  onAdd: () => void
  onEdit: (noteId: string) => void
  onDelete: (noteId: string) => void
}
```

Layout: a `Group justify="space-between" align="center"` header — title `<Title order={3}>الملاحظات</Title>` on one side, `<Button leftSection={<IconPlus size={16} />} onClick={onAdd}>إضافة ملاحظة</Button>` on the other. Below: when `rows.length === 0`, a centred `<Text c="dimmed">لا توجد ملاحظات بعد</Text>`. Otherwise a `Stack gap="md"` of `StudentNoteCard`s. For each row, `isAuthor = row.authorId === currentUserId`; pass `onEdit` and `onDelete` only when `isAuthor`.

- [ ] **Step 2: Add Storybook stories**

Stories: `Empty`, `MixedAuthors` (3 rows, 2 with `authorId === currentUserId` so the menu appears, 1 without), `OneEdited` (single row with `editedAt` set).

- [ ] **Step 3: Add index.ts** — re-export.

- [ ] **Step 4: Verify in Storybook + lint + commit**

```bash
npm run storybook   # verify
npm run lint
git add src/components/staff/StudentNotesList
git commit -m "Add StudentNotesList component"
```

---

## Phase 3 — Wire into the student page

### Task 10: Restructure `$studentId.tsx` into Mantine Tabs

Move the existing `SurahReviewQueue` and `SurahGradeList` blocks into a `Tabs` component. No notes-list yet — the goal of this task is purely the structural change.

**Files:**
- Modify: `src/routes/_protected/staff/students/$studentId.tsx`

- [ ] **Step 1: Wrap the current sections in `Tabs`**

Replace the current `<Stack gap="xl">` body (after the header `<Group>` and the optional error notification) with a Mantine `Tabs` element. Use this structure:

```tsx
<Tabs defaultValue="reviews" keepMounted={false}>
  <Tabs.List>
    <Tabs.Tab value="reviews">المراجعات</Tabs.Tab>
    <Tabs.Tab value="grades">السور</Tabs.Tab>
    <Tabs.Tab value="notes">الملاحظات</Tabs.Tab>
  </Tabs.List>

  <Tabs.Panel value="reviews" pt="md">
    <Stack gap="md">
      <Group justify="flex-end">
        <Button leftSection={<IconClipboardPlus size={16} />} onClick={() => setAssignDrawerOpen(true)} variant="light">
          إسناد مراجعة
        </Button>
      </Group>
      <SurahReviewQueue ... />
    </Stack>
  </Tabs.Panel>

  <Tabs.Panel value="grades" pt="md">
    <SurahGradeList ... />
  </Tabs.Panel>

  <Tabs.Panel value="notes" pt="md">
    {/* placeholder for Task 11 */}
  </Tabs.Panel>
</Tabs>
```

`keepMounted={false}` keeps unfocused tabs out of the DOM — fine because the data is preloaded in the route loader so tab switches are instant.

The error notification stays above the tabs so it's visible regardless of tab.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 3: Manual verification on the live preview**

Start the dev server:

```bash
npm run dev
```

Browse to a staff student page. Confirm:
- Three tabs are visible with the correct Arabic labels.
- The Reviews tab shows the existing review queue and the "Assign review" button works.
- The Grades tab shows the existing grade list and the "Add surah" drawer still works from inside it.
- The Notes tab shows nothing (placeholder).

- [ ] **Step 4: Commit**

```bash
git add src/routes/_protected/staff/students/$studentId.tsx
git commit -m "Move staff student page sections into Mantine Tabs"
```

---

### Task 11: Mount `StudentNotesList` and wire mutations

**Files:**
- Modify: `src/routes/_protected/staff/students/$studentId.tsx`

- [ ] **Step 1: Add the loader prefetch**

Inside `Route.loader`'s `Promise.all`, append:

```ts
context.queryClient.ensureQueryData(
  convexQuery(api.studentNotes.listForStudent, {
    studentId: params.studentId,
  }),
),
```

- [ ] **Step 2: Hook up the query and mutations**

Inside `StaffStudentGradingPage`:

```ts
const { data: notes } = useSuspenseQuery(
  convexQuery(api.studentNotes.listForStudent, { studentId }),
)
const addNote = useMutation(api.studentNotes.add)
const editNote = useMutation(api.studentNotes.edit)
const removeNote = useMutation(api.studentNotes.remove)

const [noteDrawerOpen, setNoteDrawerOpen] = useState(false)
const [editingNoteId, setEditingNoteId] = useState<Id<'studentNotes'> | null>(null)
const [deletingNoteId, setDeletingNoteId] = useState<Id<'studentNotes'> | null>(null)

const editingNote = useMemo(
  () => editingNoteId ? notes.find((n) => n._id === editingNoteId) ?? null : null,
  [editingNoteId, notes],
)

async function handleAddNote(body: string) {
  setErrorMessage(null)
  try {
    await addNote({ studentId, body })
  } catch (error) {
    setErrorMessage(extractActionErrorMessage(error, 'تعذر إضافة الملاحظة.'))
  }
}

async function handleEditNote(body: string) {
  if (!editingNoteId) return
  setErrorMessage(null)
  try {
    await editNote({ noteId: editingNoteId, body })
  } catch (error) {
    setErrorMessage(extractActionErrorMessage(error, 'تعذر تعديل الملاحظة.'))
  }
}

async function handleDeleteNote() {
  if (!deletingNoteId) return
  setErrorMessage(null)
  try {
    await removeNote({ noteId: deletingNoteId })
  } catch (error) {
    setErrorMessage(extractActionErrorMessage(error, 'تعذر حذف الملاحظة.'))
  }
}
```

- [ ] **Step 3: Render the Notes tab body**

Replace the placeholder inside `<Tabs.Panel value="notes">` with:

```tsx
<StudentNotesList
  rows={notes.map((n) => ({
    noteId: String(n._id),
    authorDisplayName: n.authorDisplayName,
    authorId: n.authorId,
    createdAt: n.createdAt,
    editedAt: n.editedAt,
    body: n.body,
  }))}
  currentUserId={String(me.id)}
  onAdd={() => { setEditingNoteId(null); setNoteDrawerOpen(true) }}
  onEdit={(noteId) => {
    setEditingNoteId(noteId as Id<'studentNotes'>)
    setNoteDrawerOpen(true)
  }}
  onDelete={(noteId) => setDeletingNoteId(noteId as Id<'studentNotes'>)}
/>
```

- [ ] **Step 4: Mount the drawer and the dialog**

Below the existing drawers, add:

```tsx
<AddNoteDrawer
  opened={noteDrawerOpen}
  onClose={() => { setNoteDrawerOpen(false); setEditingNoteId(null) }}
  initialBody={editingNote?.body}
  onSubmit={editingNoteId ? handleEditNote : handleAddNote}
/>

<DeleteNoteDialog
  opened={deletingNoteId !== null}
  onClose={() => setDeletingNoteId(null)}
  onConfirm={handleDeleteNote}
/>
```

- [ ] **Step 5: Verify `me.id` exists**

The current page uses `me.displayName`. Check `currentUserQuery` (in `src/lib/auth-queries.ts`) — if the returned object has `id`, great. If it has `_id` instead, swap to `String(me._id)`.

- [ ] **Step 6: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 7: Manual verification on the live preview**

```bash
npm run dev
```

End-to-end flow on the Notes tab as a teacher:
1. Switch to the Notes tab → "لا توجد ملاحظات بعد" appears.
2. Click "إضافة ملاحظة" → drawer opens. Submit empty → button disabled.
3. Type a short note, submit → drawer closes, note appears in the list with your display name and "now"-ish timestamp. No "edited" badge.
4. Click the menu on your own note → click "تعديل" → drawer opens prefilled. Edit and submit → list updates, "تم التعديل" badge appears.
5. Click "حذف" from the menu → confirm dialog opens. Cancel → no change. Confirm → note disappears.
6. Log in as a second teacher (the user will handle credentials per `feedback_auth_login.md`). Open the same student → see the first teacher's notes; confirm the menu does **not** appear on those notes (not the author).

- [ ] **Step 8: Commit**

```bash
git add src/routes/_protected/staff/students/$studentId.tsx
git commit -m "Wire student notes feature into staff student page"
```

---

## Phase 4 — Polish

### Task 12: Sanity-check production build

**Files:** none.

- [ ] **Step 1: Run the production build**

```bash
npm run build
```

Expected: exits 0. The build runs `vite build && tsc --noEmit`, catching any type errors not surfaced by lint.

- [ ] **Step 2: If green, declare the feature ready for review**

No commit needed; the build script doesn't write source files.

---

## Done

Once Phase 1–4 are complete, the feature is functionally finished and ready for code review (`pr-review-toolkit:review-pr`) before merging back to the integration branch.
