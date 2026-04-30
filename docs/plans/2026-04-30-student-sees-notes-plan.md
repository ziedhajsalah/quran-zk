# Student Sees Notes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface existing teacher-authored `studentNotes` to the owning student in a read-only third tab on `/surahs`, mirroring the staff student page tab structure (Reviews / Surahs / Notes).

**Architecture:** Single backend access change (swap `requireStaffAuthUser` for the existing `requireSelfOrStaffAuthUser` helper in `listForStudent`); two small, additive prop changes to the existing `StudentNotesList` component to make handlers optional and accept a custom empty-state message; restructure `_protected/surahs.tsx` from a flat page into Mantine `Tabs`. No new components, no schema changes, no new tables.

**Tech Stack:** Convex 1.34 with Better Auth, TanStack Router/Query, Mantine v8, React 19, TypeScript strict, Storybook 10. Already-installed; nothing new to add.

**Verification model — important:** This project has no automated test runner. The verification loop is:
1. `npm run lint` (runs `tsc && eslint`) — must pass after every code change.
2. `npm run convex:push` — pushes schema/function updates to the dev deployment (must succeed for backend changes). This script is added in Task 0; if it already exists from a prior change, skip the add.
3. Storybook stories — visual verification for component changes.
4. `npm run dev` (live preview) — manual verification for routes and end-to-end flows. The user handles login when verification needs auth.

**Reference reading before starting backend tasks:** `convex/_generated/ai/guidelines.md` (per `CLAUDE.md`).

**Builds on:** [`2026-04-30-student-sees-notes-design.md`](./2026-04-30-student-sees-notes-design.md) — the approved design doc. Read §2 (decisions), §4 (Convex API change), and §5 (UI changes) before starting.

**Reads-from existing context:**
- `convex/studentNotes.ts` — current backend (staff-only `listForStudent`, plus the unchanged `add`/`edit`/`remove` mutations).
- `convex/auth/helpers.ts:67-80` — `requireSelfOrStaffAuthUser` already exists and enforces the desired access policy.
- `src/components/staff/StudentNotesList/StudentNotesList.tsx` — the component being extended.
- `src/components/staff/StudentNoteCard/StudentNoteCard.tsx` — already correctly hides the menu when `isAuthor` is false; no change needed.
- `src/routes/_protected/surahs.tsx` — the route being restructured.
- `src/routes/_protected/staff/students/$studentId.tsx` — reference for the tabs pattern (`<Tabs defaultValue="reviews">`).

**Arabic UI strings used in this plan:**
- "المراجعات" — Reviews (tab)
- "السور" — Surahs / Grades (tab)
- "الملاحظات" — Notes (tab)
- "لا توجد ملاحظات بعد" — No notes yet (existing default empty state)
- "لا توجد ملاحظات من معلمك بعد" — No notes from your teacher yet (new student-side empty state)

---

## Phase 0 — Tooling

### Task 0: Add a `convex:push` script

The user prefers all project commands to flow through `package.json` scripts. The existing `dev:convex` runs `npx convex dev` (continuous watch), but later tasks need a one-shot push. Add a dedicated script.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Check whether the script already exists**

```bash
grep -n '"convex:push"' package.json
```

If the line already exists, skip the rest of this task and move on to Task 1.

- [ ] **Step 2: Add the script**

In `package.json`, inside the `"scripts": { ... }` block, add a new entry alongside `dev:convex`:

```json
"convex:push": "npx convex dev --once",
```

Place it on its own line so the diff is clean. Existing scripts are unchanged.

- [ ] **Step 3: Verify it runs**

```bash
npm run convex:push
```

Expected: convex pushes the current schema (no changes yet); exits 0.

- [ ] **Step 4: Commit**

```bash
git add package.json
git commit -m "Add convex:push script for one-shot deploys"
```

---

## Phase 1 — Backend access change

### Task 1: Allow the owning student to read their own notes

Change `listForStudent` to accept either staff or the student themselves, using the existing helper. Mutations stay staff-only.

**Files:**
- Modify: `convex/studentNotes.ts`

- [ ] **Step 1: Swap the auth helper inside `listForStudent`**

In `convex/studentNotes.ts`:

Change the import line from:

```ts
import { requireStaffAuthUser } from './auth/helpers'
```

to:

```ts
import { requireSelfOrStaffAuthUser, requireStaffAuthUser } from './auth/helpers'
```

(`requireStaffAuthUser` is still used by `add`, `edit`, `remove` — keep it.)

Inside the `listForStudent` handler, change:

```ts
await requireStaffAuthUser(ctx)
```

to:

```ts
await requireSelfOrStaffAuthUser(ctx, args.studentId)
```

The rest of the handler — the index query, the author-name resolution loop, the `take(MAX_NOTES_PER_STUDENT)` — is unchanged. The `add`, `edit`, and `remove` mutations are unchanged.

- [ ] **Step 2: Push to Convex dev and lint**

```bash
npm run convex:push
npm run lint
```

Expected: both exit 0.

- [ ] **Step 3: Manual smoke check (no UI changes yet)**

Start the live preview:

```bash
npm run dev
```

Ask the user to log in as a student (per the project's auth-handling preference: the user signs themselves in). Once they're signed in as a student, open the browser devtools → Network tab → filter for `studentNotes:listForStudent` and confirm the request returns 200 with `[]` or the student's own notes (no `Unauthorized`).

If you (the agent) cannot drive the live preview without auth, simply say "Please log in as a student in the preview window and tell me when you're ready" and wait.

- [ ] **Step 4: Commit**

```bash
git add convex/studentNotes.ts
git commit -m "Allow owning student to read their own notes"
```

---

## Phase 2 — Component change

### Task 2: Make `StudentNotesList` reusable from the student page

Two additive changes to props: handler callbacks become optional, and an `emptyMessage` prop overrides the default empty-state copy. The header "Add note" button is only rendered when `onAdd` is provided. The staff page is unchanged because it still passes all three handlers and gets the default empty message.

**Files:**
- Modify: `src/components/staff/StudentNotesList/StudentNotesList.tsx`
- Modify: `src/components/staff/StudentNotesList/StudentNotesList.stories.tsx`

- [ ] **Step 1: Update the props and rendering**

Replace the entire contents of `src/components/staff/StudentNotesList/StudentNotesList.tsx` with:

```tsx
import { Button, Group, Stack, Text, Title } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { StudentNoteCard } from '../StudentNoteCard'

export interface StudentNoteRow {
  noteId: string
  authorDisplayName: string
  authorId: string
  createdAt: number
  editedAt: number | null
  body: string
}

export interface StudentNotesListProps {
  rows: ReadonlyArray<StudentNoteRow>
  currentUserId: string
  onAdd?: () => void
  onEdit?: (noteId: string) => void
  onDelete?: (noteId: string) => void
  emptyMessage?: string
}

const DEFAULT_EMPTY_MESSAGE = 'لا توجد ملاحظات بعد'

export function StudentNotesList({
  rows,
  currentUserId,
  onAdd,
  onEdit,
  onDelete,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
}: StudentNotesListProps) {
  return (
    <Stack gap="md">
      <Group justify="space-between" align="center">
        <Title order={3}>الملاحظات</Title>
        {onAdd ? (
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={onAdd}
            variant="light"
          >
            إضافة ملاحظة
          </Button>
        ) : null}
      </Group>

      {rows.length === 0 ? (
        <Text c="dimmed" ta="center" py="xl">
          {emptyMessage}
        </Text>
      ) : (
        <Stack gap="md">
          {rows.map((row) => {
            const isAuthor = row.authorId === currentUserId
            return (
              <StudentNoteCard
                key={row.noteId}
                authorDisplayName={row.authorDisplayName}
                createdAt={row.createdAt}
                editedAt={row.editedAt}
                body={row.body}
                isAuthor={isAuthor}
                onEdit={isAuthor && onEdit ? () => onEdit(row.noteId) : undefined}
                onDelete={
                  isAuthor && onDelete ? () => onDelete(row.noteId) : undefined
                }
              />
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}
```

Notes on the changes:
- `onAdd?`, `onEdit?`, `onDelete?` are now optional.
- The header `Button` is only rendered when `onAdd` is defined.
- `emptyMessage` defaults to the existing string, so the staff page sees no behaviour change.
- The per-row handler wiring now also guards on the optional callback being defined — this keeps the staff behaviour identical (handlers are always passed) while making the student usage safe.

- [ ] **Step 2: Add a "ReadOnlyStudentView" Storybook story**

Append the following story to `src/components/staff/StudentNotesList/StudentNotesList.stories.tsx`. Do not change the existing `Empty`, `MixedAuthors`, or `OneEdited` stories.

```tsx
const studentUserId = 'student-1'

export const ReadOnlyStudentView: Story = {
  args: {
    rows: [
      {
        noteId: 'n1',
        authorDisplayName: 'الأستاذ أحمد',
        authorId: 'teacher-1',
        createdAt: now - 2 * hour,
        editedAt: null,
        body: 'يحفظ بسرعة بعد المغرب.',
      },
      {
        noteId: 'n2',
        authorDisplayName: 'الأستاذة فاطمة',
        authorId: 'teacher-2',
        createdAt: now - 3 * day,
        editedAt: now - 2 * day,
        body: 'تحسن كبير في المراجعة.',
      },
    ],
    currentUserId: studentUserId,
    emptyMessage: 'لا توجد ملاحظات من معلمك بعد',
  },
}

export const ReadOnlyStudentEmpty: Story = {
  args: {
    rows: [],
    currentUserId: studentUserId,
    emptyMessage: 'لا توجد ملاحظات من معلمك بعد',
  },
}
```

These stories deliberately omit `onAdd`, `onEdit`, `onDelete` to exercise the new optional-prop branches.

- [ ] **Step 3: Visual verification in Storybook**

```bash
npm run storybook
```

Open `http://localhost:6006/?path=/story/staff-studentnoteslist--read-only-student-view` in a browser. Confirm:
- The header shows the title "الملاحظات" with **no** "إضافة ملاحظة" button on its right.
- Each card shows the teacher's name, relative time, body, and (for the second card) a "تم التعديل" badge.
- No card has the three-dot menu (because `currentUserId` matches no `authorId`).

Then open `?path=/story/staff-studentnoteslist--read-only-student-empty` and confirm the empty-state text reads "لا توجد ملاحظات من معلمك بعد" with no add button above it.

Then open `?path=/story/staff-studentnoteslist--mixed-authors` (existing story) and confirm the staff variant is unchanged — header still has the add button, the two `teacher-1` cards still expose the three-dot menu.

Stop Storybook (Ctrl+C) when done.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/staff/StudentNotesList
git commit -m "Make StudentNotesList read-only-friendly for students"
```

---

## Phase 3 — Wire the Notes tab into `/surahs`

### Task 3: Restructure `/surahs` into Tabs and mount the notes list

Replace the current flat layout with a Mantine `Tabs` block matching the staff student page (Reviews / Surahs / Notes). Add a route-loader prefetch for `studentNotes.listForStudent` so the Notes tab is hot on first open.

**Files:**
- Modify: `src/routes/_protected/surahs.tsx`

- [ ] **Step 1: Replace the file contents**

Replace the entire file `src/routes/_protected/surahs.tsx` with:

```tsx
import { createFileRoute } from '@tanstack/react-router'
import {
  Box,
  Container,
  Stack,
  Tabs,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core'
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
import { StudentNotesList } from '~/components/staff/StudentNotesList'

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
      context.queryClient.ensureQueryData(
        convexQuery(api.studentNotes.listForStudent, { studentId: me.id }),
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
  const { data: notes } = useSuspenseQuery(
    convexQuery(api.studentNotes.listForStudent, { studentId: me.id }),
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

          <Tabs defaultValue="reviews">
            <Tabs.List>
              <Tabs.Tab value="reviews">المراجعات</Tabs.Tab>
              <Tabs.Tab value="grades">السور</Tabs.Tab>
              <Tabs.Tab value="notes">الملاحظات</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="reviews" pt="md">
              <SurahReviewQueue
                rows={openAssignments.map((a) => ({
                  assignmentId: String(a._id),
                  surahNumber: a.surahNumber,
                  assignedAt: a.assignedAt,
                  dueAt: a.dueAt,
                }))}
              />
            </Tabs.Panel>

            <Tabs.Panel value="grades" pt="md">
              <SurahGradeList
                rows={rows.map((row) => ({
                  surahNumber: row.surahNumber,
                  grade: row.grade,
                  updatedAt: row.updatedAt,
                }))}
                emptyMessage="لم تبدأ في حفظ أي سورة بعد. تواصل مع معلمك."
              />
            </Tabs.Panel>

            <Tabs.Panel value="notes" pt="md">
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
                emptyMessage="لا توجد ملاحظات من معلمك بعد"
              />
            </Tabs.Panel>
          </Tabs>
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

Notes on this rewrite:
- The page header (`حفظي` kicker + `السور التي حفظتها` title + dimmed subtitle) stays above the tabs so the page's identity is preserved.
- `defaultValue="reviews"` matches the staff page and keeps the most action-oriented tab on top.
- No `keepMounted={false}` — there's no per-tab local state worth discarding, and Convex queries stay subscribed via the loader regardless.
- `StudentNotesList` is imported from the existing `~/components/staff/StudentNotesList` path. The label "staff" in the path is a known misnomer (see design §2.4); renaming is out of scope.
- `onAdd` / `onEdit` / `onDelete` are intentionally not passed; the component now treats those as optional and renders read-only.

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: exits 0. If TypeScript complains about `api.studentNotes.listForStudent` not existing, run `npm run convex:push` once to refresh the generated types, then re-run `npm run lint`.

- [ ] **Step 3: Manual end-to-end verification on the live preview**

Start the dev server:

```bash
npm run dev
```

Per the project's auth-handling preference, ask the user to log in as the test teacher first, then walk through:

1. As a teacher: open `/staff/students/<some-student>`, switch to the Notes tab, click "إضافة ملاحظة", write "هذا اختبار من المعلم" and save. Confirm it appears.
2. Ask the user to log out and back in as that same student.
3. Once signed in as the student, navigate to `/surahs`. Confirm three tabs are visible with labels المراجعات / السور / الملاحظات, and that المراجعات is selected by default.
4. Click الملاحظات. Confirm:
   - The teacher's note "هذا اختبار من المعلم" is visible.
   - The card shows the teacher's display name and a relative timestamp.
   - There is **no** three-dot menu on the card.
   - There is **no** "إضافة ملاحظة" button in the header.
5. Click السور — confirm the previous grade list still renders correctly.
6. Click المراجعات — confirm the review queue still renders correctly.
7. (Optional) On a separate student account with no notes, repeat step 4 and confirm the empty-state text reads "لا توجد ملاحظات من معلمك بعد".

If any step fails, do not commit. Diagnose, fix, and re-run.

- [ ] **Step 4: Commit**

```bash
git add src/routes/_protected/surahs.tsx
git commit -m "Show teacher notes to students on /surahs"
```

---

## Phase 4 — Polish

### Task 4: Final lint + build sanity check

**Files:** none modified.

- [ ] **Step 1: Full lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 2: Production build sanity check**

```bash
npm run build
```

Expected: exits 0. Confirms TypeScript and the production Vite bundle are clean — catches any prop-shape regressions in `StudentNotesList` consumers that lint alone might miss.

- [ ] **Step 3: Confirm git is clean and the feature branch is ready to ship**

```bash
git status
git log --oneline main..HEAD
```

Expected: `git status` is clean. The branch should contain (in order): the design-doc commit, plus the four feature commits from Tasks 0–3:
1. `Add convex:push script for one-shot deploys` (skip if Task 0 step 1 found the script already existed)
2. `Allow owning student to read their own notes`
3. `Make StudentNotesList read-only-friendly for students`
4. `Show teacher notes to students on /surahs`

No further code changes required.
