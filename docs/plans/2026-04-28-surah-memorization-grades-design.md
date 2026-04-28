# Surah Memorization Grades — Design

**Status:** Approved, ready for implementation
**Date:** 2026-04-28
**Author:** Brainstormed in session

## 1. Context

This is the first real domain feature on top of the existing auth shell. The Convex schema today only contains `numbers` (demo) and `passwordResetCodes`. The home dashboard runs entirely on fixtures.

Goal: each student has a list of surahs they have memorized, and each surah on the list carries a grade — `good`, `medium`, or `forgotten`. Teachers and admins are the authoritative graders; students see their list read-only.

## 2. Decisions

Each decision below was chosen over alternatives during brainstorming. Alternatives are recorded so future readers understand the constraints.

### 2.1 Authority: teachers/admins write, students read

Students cannot edit their own grades. Their view is purely informational. Rationale: in a school context the teacher's record is the authoritative one, and a student self-marking themselves as `forgotten` rarely happens — the natural source of truth is a teacher's recitation assessment.

Rejected: student self-tracking, shared editing.

### 2.2 Flat student list (no classes for v1)

Any teacher can grade any student. No `teacher↔student` assignment, no class hierarchy. We accept this is fine while the school is small. When teacher-student isolation actually hurts, we revisit with a `classes` table or assignment links.

Rejected (for now): explicit teacher-student assignment, class/group hierarchy.

### 2.3 Current state only — no history table

One row per `(studentId, surahNumber)`. Updates overwrite. We deliberately do not keep a per-change log for v1.

The future plan: a generic activity log feature will retroactively cover this surface (and others), so adding a parallel history table now would be wasted work.

Rejected: append-only log, snapshot + history table combo.

### 2.4 List semantics: a row means "has been memorized"

A row in `studentSurahGrades` ⇔ the student has worked through this surah at some point. The `grade` field reflects current quality. A `forgotten` surah stays on the list — the entire point of the grade is to surface "you used to know this, review it." Removing a row is a rare admin-only correction action.

Rejected: `forgotten` removes from the list; separate `isOnList` boolean alongside grade.

### 2.5 Surah catalogue lives as a TS constant

114 fixed surahs, names and ayah counts hardcoded in `src/data/surahs.ts`. No Convex `surahs` table.

Rationale: the list is universal and immutable. Putting it in the database would mean a query roundtrip for static reference data.

### 2.6 Minimal row metadata

Per-row fields: `studentId`, `surahNumber`, `grade`, `updatedAt`, `updatedBy`. No `notes`, no `firstMemorizedAt`.

`firstMemorizedAt` is intentionally omitted: when the activity log lands, the first row's `_creationTime` will give us the original date for free. Notes are deferred to a later effort once we have a real ask.

## 3. Data layer (Convex)

### 3.1 Schema

```ts
// convex/schema.ts (additions)
studentSurahGrades: defineTable({
  studentId: v.string(),
  surahNumber: v.number(),       // 1–114
  grade: v.union(
    v.literal('good'),
    v.literal('medium'),
    v.literal('forgotten'),
  ),
  updatedAt: v.number(),
  updatedBy: v.string(),
})
  .index('by_student', ['studentId'])
  .index('by_student_surah', ['studentId', 'surahNumber'])
```

`by_student_surah` powers both the upsert lookup on writes and the read path. `by_student` covers the "all rows for this student" query without sub-filtering.

### 3.2 API surface — `convex/surahGrades.ts`

| Function | Type | Caller | Purpose |
|---|---|---|---|
| `listForStudent({ studentId })` | query | student (own only), teacher, admin | All grade rows for a student. |
| `listAllStudents()` | query | teacher, admin | Students for the staff picker, sorted by `displayName`. |
| `setGrade({ studentId, surahNumber, grade })` | mutation | teacher, admin | Upsert. Validates `1 <= surahNumber <= 114`. |
| `removeFromList({ studentId, surahNumber })` | mutation | admin only | Rare correction. Not exposed to teachers. |

### 3.3 Authorization helpers

Add to `convex/auth/helpers.ts`:

- `requireStaff(ctx)` — returns the current user if their role is `teacher` or `admin`. Pairs with the existing `requireAdmin`.
- `requireSelfOrStaff(ctx, studentId)` — used by `listForStudent` so a student can read their own list and staff can read anyone's.

`surahNumber` validation lives in the mutation body, not in a custom validator: throws `ConvexError` if out of range.

## 4. UI surfaces

### 4.1 Routes (TanStack file-based)

```
src/routes/_protected/
├── surahs.tsx                    # student's own list (read-only)
└── staff/
    ├── route.tsx                 # guard: teacher | admin
    └── students/
        ├── index.tsx             # all-students picker
        └── $studentId.tsx        # grading view for one student
```

The staff guard mirrors `_protected/admin/route.tsx`.

### 4.2 Bottom-nav update

In `src/components/home/home-dashboard.fixtures.ts`, the existing disabled `lessons` slot becomes:

```ts
{ id: 'surahs', label: 'حفظي', icon: 'lessons', to: '/surahs' }
```

The icon constant (`IconBook2`) stays the same; only the id, label, and `to` change.

### 4.3 Staff discoverability

A single link on `/profile`, visible only when the current user is a teacher or admin:

```tsx
<Anchor component={Link} to="/staff/students">إدارة الطلاب</Anchor>
```

No staff hub page yet. We have two staff destinations total (`/staff/students` and `/admin/reset-password`) — adding a hub now would be premature.

### 4.4 Surah catalogue + grade labels

`src/data/surahs.ts`:

```ts
export interface Surah {
  number: number
  nameAr: string
  nameEn: string
  ayahCount: number
}

export const SURAHS: ReadonlyArray<Surah> = [/* all 114 entries */]
export const SURAH_BY_NUMBER: ReadonlyMap<number, Surah> =
  new Map(SURAHS.map((s) => [s.number, s]))
export function getSurah(number: number): Surah { /* throws if unknown */ }
```

`src/data/grades.ts`:

```ts
export type SurahGrade = 'good' | 'medium' | 'forgotten'

export const GRADE_LABELS: Record<SurahGrade, string> = {
  good:      'حفظ متقن',
  medium:    'حفظ متوسط',
  forgotten: 'يحتاج مراجعة',
}

export const GRADE_COLORS: Record<SurahGrade, string> = {
  good:      'teal',
  medium:    'yellow',
  forgotten: 'orange',
}

export const GRADE_ORDER: ReadonlyArray<SurahGrade> = ['good', 'medium', 'forgotten']
```

Label rationale: `يحتاج مراجعة` ("needs review") is softer than a literal "forgotten" — this is the most-displayed grade and harsh phrasing demotivates students. Color rationale: `orange` rather than `red` for `forgotten` because pure red against the design system's `primary: #004d27` reads as alarm; orange reads as "attention."

## 5. Components

New directory: `src/components/surahs/`.

| Component | Props | Used by |
|---|---|---|
| `SurahGradeList` | `rows`, `editable`, `onChangeGrade?`, `onAddSurah?` | Student page (read-only), staff grading page (editable) |
| `SurahGradeRow` | `surah`, `grade`, `updatedAt`, `editable`, `onChange?` | Inside `SurahGradeList`. Editable mode shows the three grade chips inline. |
| `AddSurahDrawer` | `excludeSurahNumbers`, `onSubmit({ surahNumber, grade })` | Staff grading page. Mantine `Drawer` with searchable list of the 114 surahs minus the ones already on the student. |
| `StudentsPicker` | — | `/staff/students`. List of `displayName + @username`. |

Route components are thin: they call `useSuspenseQuery` and pass data into the components above. Loading uses route-loader `ensureQueryData`, matching the existing pattern in `routes/_protected/profile.tsx`.

**Sort order:** ascending by `surahNumber` for both student and staff views. Stable positions are more important than surfacing review-needed surahs first; a "review queue" filter is a future enhancement.

**Mutation UX:** Convex reactive queries refresh automatically; no manual invalidation. Errors surface as a Mantine `Notification`. No optimistic updates — the mutation is fast and the surface is small.

**Empty states:**
- Student `/surahs` with no rows: `لم تبدأ في حفظ أي سورة بعد. تواصل مع معلمك.`
- Staff `/staff/students/$studentId` with no rows: `لم يبدأ هذا الطالب الحفظ بعد. أضف أول سورة.`

**Storybook:** stories for `SurahGradeList`, `SurahGradeRow`, `AddSurahDrawer` — the project already covers every home component this way.

## 6. Out of scope for v1

These were considered and explicitly deferred:

- Activity log / grade history (will land as a generic feature later).
- Notes / teacher comments per surah.
- `firstMemorizedAt` field (recoverable from activity log later).
- Class / group hierarchy.
- Teacher-student assignment.
- Stats summary card ("X متقن، Y متوسط، Z تحتاج مراجعة").
- "Review queue" filter or non-numeric sort.
- Optimistic mutation updates.
- A staff hub page.

## 7. Files touched

**New:**
- `convex/surahGrades.ts`
- `src/data/surahs.ts`
- `src/data/grades.ts`
- `src/routes/_protected/surahs.tsx`
- `src/routes/_protected/staff/route.tsx`
- `src/routes/_protected/staff/students/index.tsx`
- `src/routes/_protected/staff/students/$studentId.tsx`
- `src/components/surahs/SurahGradeList/{SurahGradeList.tsx,SurahGradeList.stories.tsx,index.ts}`
- `src/components/surahs/SurahGradeRow/{SurahGradeRow.tsx,SurahGradeRow.stories.tsx,index.ts}`
- `src/components/surahs/AddSurahDrawer/{AddSurahDrawer.tsx,AddSurahDrawer.stories.tsx,index.ts}`
- `src/components/surahs/StudentsPicker/{StudentsPicker.tsx,StudentsPicker.stories.tsx,index.ts}`
- `src/components/surahs/index.ts`

**Modified:**
- `convex/schema.ts` — add `studentSurahGrades` table.
- `convex/auth/helpers.ts` — add `requireStaff`, `requireSelfOrStaff`.
- `src/components/home/home-dashboard.fixtures.ts` — wire the bottom-nav `lessons` slot to `/surahs`.
- `src/routes/_protected/profile.tsx` — add the `إدارة الطلاب` link for staff.
