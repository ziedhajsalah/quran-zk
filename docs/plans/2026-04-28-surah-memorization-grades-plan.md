# Surah Memorization Grades — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v1 Surah Memorization Grades feature: students see their memorized surahs with grades read-only; teachers/admins grade and add surahs from a per-student page.

**Architecture:** New Convex table `studentSurahGrades` with two indexes; a Convex query/mutation surface authorized via `requireStaffAuthUser` and `requireSelfOrStaffAuthUser`; static surah catalogue + grade labels in `src/data/`; new TanStack routes `/surahs` (student) and `/staff/students/*` (staff), reusing the existing Mantine + Better Auth shells.

**Tech Stack:** Convex 1.34 with Better Auth, TanStack Router/Query, Mantine v8, React 19, TypeScript strict.

**Verification model — important:** This project has no automated test runner (no `npm test`, no Vitest, no Jest). The verification loop is:
1. `npm run lint` (runs `tsc && eslint`) — must pass after every code change.
2. `npx convex dev --once` — pushes schema/function updates to the dev deployment; must succeed for backend changes.
3. Storybook stories — visual verification for components (mandatory because the project has stories for every existing component).
4. `npm run dev` (live preview) — manual verification for routes and end-to-end flows. The user handles login when verification needs auth.

**Reference reading before starting backend tasks:** `convex/_generated/ai/guidelines.md` (per `CLAUDE.md`).

**Worktree:** Work happens in `~/code/worktrees/quran-zk/surah-memorization-grades` on branch `feat/surah-memorization-grades`.

---

## Phase 1 — Convex backend

### Task 1: Schema + auth helpers

Adds the `studentSurahGrades` table and the two new auth helpers (`requireStaffAuthUser`, `requireSelfOrStaffAuthUser`). These are foundational — every backend task below depends on them.

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/auth/helpers.ts`

- [ ] **Step 1: Add the schema table**

In `convex/schema.ts`, add `studentSurahGrades` alongside the existing tables. The full file becomes:

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
})
```

- [ ] **Step 2: Add the two new auth helpers**

In `convex/auth/helpers.ts`, append after `requireAdminAuthUser`:

```ts
export async function requireStaffAuthUser(ctx: ReaderCtx) {
  const user = await requireCurrentAuthUser(ctx)
  const roles = parseStoredRoles(user.role)
  if (!roles.includes('admin') && !roles.includes('teacher')) {
    throw new Error('Unauthorized')
  }
  return user
}

export async function requireSelfOrStaffAuthUser(
  ctx: ReaderCtx,
  studentId: string,
) {
  const user = await requireCurrentAuthUser(ctx)
  if (String(user._id) === studentId) {
    return user
  }
  const roles = parseStoredRoles(user.role)
  if (!roles.includes('admin') && !roles.includes('teacher')) {
    throw new Error('Unauthorized')
  }
  return user
}
```

- [ ] **Step 3: Push schema and verify**

```bash
npx convex dev --once
```

Expected: prints `Convex functions ready!` (or equivalent) without TypeScript errors. The new index `by_student_surah` shows up in the deployment dashboard.

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add convex/schema.ts convex/auth/helpers.ts
git commit -m "Add studentSurahGrades schema and staff auth helpers"
```

---

### Task 2: Convex query — `listForStudent`

Returns all grade rows for a single student. Accessible to the student themselves (own ID only) and to any staff member.

**Files:**
- Create: `convex/surahGrades.ts`

- [ ] **Step 1: Create the file with the query**

```ts
import { v } from 'convex/values'
import { query } from './_generated/server'
import { requireSelfOrStaffAuthUser } from './auth/helpers'

export const listForStudent = query({
  args: {
    studentId: v.string(),
  },
  handler: async (ctx, args) => {
    await requireSelfOrStaffAuthUser(ctx, args.studentId)
    return await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student', (q) => q.eq('studentId', args.studentId))
      .collect()
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
git add convex/surahGrades.ts
git commit -m "Add listForStudent query for surah grades"
```

---

### Task 3: Convex query — `listAllStudents`

Returns every active student (role contains `student`, not banned), sorted by Arabic-aware display name. Staff-only.

**Files:**
- Modify: `convex/surahGrades.ts`

- [ ] **Step 1: Add the query**

Append to `convex/surahGrades.ts`:

```ts
import { authComponent, createAuth } from './auth'
import { requireStaffAuthUser } from './auth/helpers'
import { serializeAuthUser } from './auth/helpers'
import { parseStoredRoles } from './auth/utils'

export const listAllStudents = query({
  args: {},
  handler: async (ctx) => {
    await requireStaffAuthUser(ctx)
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx)

    const all: Array<Awaited<ReturnType<typeof auth.api.getUser>>> = []
    let offset = 0
    let total = 0
    do {
      const result = await auth.api.listUsers({
        query: { limit: 100, offset },
        headers,
      })
      all.push(...result.users)
      total = result.total
      offset += result.users.length
    } while (offset < total)

    return all
      .filter((u) => parseStoredRoles(u.role).includes('student'))
      .filter((u) => !u.banned)
      .map(serializeAuthUser)
      .sort((a, b) =>
        a.displayName.localeCompare(b.displayName, 'ar'),
      )
  },
})
```

Consolidate the imports at the top of the file so they don't duplicate. The final import block should read:

```ts
import { v } from 'convex/values'
import { query } from './_generated/server'
import { authComponent, createAuth } from './auth'
import {
  requireSelfOrStaffAuthUser,
  requireStaffAuthUser,
  serializeAuthUser,
} from './auth/helpers'
import { parseStoredRoles } from './auth/utils'
```

- [ ] **Step 2: Push and lint**

```bash
npx convex dev --once && npm run lint
```

Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add convex/surahGrades.ts
git commit -m "Add listAllStudents query"
```

---

### Task 4: Convex mutation — `setGrade`

Upsert a grade for one `(studentId, surahNumber)`. Validates the surah number and records `updatedBy` from the calling staff user.

**Files:**
- Modify: `convex/surahGrades.ts`

- [ ] **Step 1: Add the mutation**

Append to `convex/surahGrades.ts`:

```ts
import { ConvexError } from 'convex/values'
import { mutation } from './_generated/server'

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

export const setGrade = mutation({
  args: {
    studentId: v.string(),
    surahNumber: v.number(),
    grade: gradeValidator,
  },
  handler: async (ctx, args) => {
    const staff = await requireStaffAuthUser(ctx)
    assertSurahNumber(args.surahNumber)

    const existing = await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student_surah', (q) =>
        q.eq('studentId', args.studentId).eq('surahNumber', args.surahNumber),
      )
      .unique()

    const now = Date.now()
    if (existing) {
      await ctx.db.patch(existing._id, {
        grade: args.grade,
        updatedAt: now,
        updatedBy: String(staff._id),
      })
    } else {
      await ctx.db.insert('studentSurahGrades', {
        studentId: args.studentId,
        surahNumber: args.surahNumber,
        grade: args.grade,
        updatedAt: now,
        updatedBy: String(staff._id),
      })
    }
  },
})
```

Update imports to include `mutation` and `ConvexError`:

```ts
import { ConvexError, v } from 'convex/values'
import { mutation, query } from './_generated/server'
```

- [ ] **Step 2: Push and lint**

```bash
npx convex dev --once && npm run lint
```

Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add convex/surahGrades.ts
git commit -m "Add setGrade mutation"
```

---

### Task 5: Convex mutation — `removeFromList`

Admin-only. Deletes a row, used as a rare correction.

**Files:**
- Modify: `convex/surahGrades.ts`

- [ ] **Step 1: Add the mutation**

Append to `convex/surahGrades.ts`:

```ts
import { requireAdminAuthUser } from './auth/helpers'

export const removeFromList = mutation({
  args: {
    studentId: v.string(),
    surahNumber: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminAuthUser(ctx)
    assertSurahNumber(args.surahNumber)

    const existing = await ctx.db
      .query('studentSurahGrades')
      .withIndex('by_student_surah', (q) =>
        q.eq('studentId', args.studentId).eq('surahNumber', args.surahNumber),
      )
      .unique()

    if (existing) {
      await ctx.db.delete(existing._id)
    }
  },
})
```

Update the helpers import to merge:

```ts
import {
  requireAdminAuthUser,
  requireSelfOrStaffAuthUser,
  requireStaffAuthUser,
  serializeAuthUser,
} from './auth/helpers'
```

- [ ] **Step 2: Push and lint**

```bash
npx convex dev --once && npm run lint
```

Expected: both succeed.

- [ ] **Step 3: Commit**

```bash
git add convex/surahGrades.ts
git commit -m "Add removeFromList admin mutation"
```

---

## Phase 2 — Static data

### Task 6: Surah catalogue (`src/data/surahs.ts`)

The 114-entry constant. Names from the canonical Uthmani ordering.

**Files:**
- Create: `src/data/surahs.ts`

- [ ] **Step 1: Create the file**

```ts
export interface Surah {
  number: number
  nameAr: string
  nameEn: string
  ayahCount: number
}

export const SURAHS: ReadonlyArray<Surah> = [
  { number: 1, nameAr: 'الفاتحة', nameEn: 'Al-Fatihah', ayahCount: 7 },
  { number: 2, nameAr: 'البقرة', nameEn: 'Al-Baqarah', ayahCount: 286 },
  { number: 3, nameAr: 'آل عمران', nameEn: 'Aal-Imran', ayahCount: 200 },
  { number: 4, nameAr: 'النساء', nameEn: 'An-Nisa', ayahCount: 176 },
  { number: 5, nameAr: 'المائدة', nameEn: 'Al-Maidah', ayahCount: 120 },
  { number: 6, nameAr: 'الأنعام', nameEn: 'Al-Anam', ayahCount: 165 },
  { number: 7, nameAr: 'الأعراف', nameEn: 'Al-Araf', ayahCount: 206 },
  { number: 8, nameAr: 'الأنفال', nameEn: 'Al-Anfal', ayahCount: 75 },
  { number: 9, nameAr: 'التوبة', nameEn: 'At-Tawbah', ayahCount: 129 },
  { number: 10, nameAr: 'يونس', nameEn: 'Yunus', ayahCount: 109 },
  { number: 11, nameAr: 'هود', nameEn: 'Hud', ayahCount: 123 },
  { number: 12, nameAr: 'يوسف', nameEn: 'Yusuf', ayahCount: 111 },
  { number: 13, nameAr: 'الرعد', nameEn: 'Ar-Rad', ayahCount: 43 },
  { number: 14, nameAr: 'إبراهيم', nameEn: 'Ibrahim', ayahCount: 52 },
  { number: 15, nameAr: 'الحجر', nameEn: 'Al-Hijr', ayahCount: 99 },
  { number: 16, nameAr: 'النحل', nameEn: 'An-Nahl', ayahCount: 128 },
  { number: 17, nameAr: 'الإسراء', nameEn: 'Al-Isra', ayahCount: 111 },
  { number: 18, nameAr: 'الكهف', nameEn: 'Al-Kahf', ayahCount: 110 },
  { number: 19, nameAr: 'مريم', nameEn: 'Maryam', ayahCount: 98 },
  { number: 20, nameAr: 'طه', nameEn: 'Taha', ayahCount: 135 },
  { number: 21, nameAr: 'الأنبياء', nameEn: 'Al-Anbiya', ayahCount: 112 },
  { number: 22, nameAr: 'الحج', nameEn: 'Al-Hajj', ayahCount: 78 },
  { number: 23, nameAr: 'المؤمنون', nameEn: 'Al-Muminun', ayahCount: 118 },
  { number: 24, nameAr: 'النور', nameEn: 'An-Nur', ayahCount: 64 },
  { number: 25, nameAr: 'الفرقان', nameEn: 'Al-Furqan', ayahCount: 77 },
  { number: 26, nameAr: 'الشعراء', nameEn: 'Ash-Shuara', ayahCount: 227 },
  { number: 27, nameAr: 'النمل', nameEn: 'An-Naml', ayahCount: 93 },
  { number: 28, nameAr: 'القصص', nameEn: 'Al-Qasas', ayahCount: 88 },
  { number: 29, nameAr: 'العنكبوت', nameEn: 'Al-Ankabut', ayahCount: 69 },
  { number: 30, nameAr: 'الروم', nameEn: 'Ar-Rum', ayahCount: 60 },
  { number: 31, nameAr: 'لقمان', nameEn: 'Luqman', ayahCount: 34 },
  { number: 32, nameAr: 'السجدة', nameEn: 'As-Sajdah', ayahCount: 30 },
  { number: 33, nameAr: 'الأحزاب', nameEn: 'Al-Ahzab', ayahCount: 73 },
  { number: 34, nameAr: 'سبأ', nameEn: 'Saba', ayahCount: 54 },
  { number: 35, nameAr: 'فاطر', nameEn: 'Fatir', ayahCount: 45 },
  { number: 36, nameAr: 'يس', nameEn: 'Ya-Sin', ayahCount: 83 },
  { number: 37, nameAr: 'الصافات', nameEn: 'As-Saffat', ayahCount: 182 },
  { number: 38, nameAr: 'ص', nameEn: 'Sad', ayahCount: 88 },
  { number: 39, nameAr: 'الزمر', nameEn: 'Az-Zumar', ayahCount: 75 },
  { number: 40, nameAr: 'غافر', nameEn: 'Ghafir', ayahCount: 85 },
  { number: 41, nameAr: 'فصلت', nameEn: 'Fussilat', ayahCount: 54 },
  { number: 42, nameAr: 'الشورى', nameEn: 'Ash-Shura', ayahCount: 53 },
  { number: 43, nameAr: 'الزخرف', nameEn: 'Az-Zukhruf', ayahCount: 89 },
  { number: 44, nameAr: 'الدخان', nameEn: 'Ad-Dukhan', ayahCount: 59 },
  { number: 45, nameAr: 'الجاثية', nameEn: 'Al-Jathiyah', ayahCount: 37 },
  { number: 46, nameAr: 'الأحقاف', nameEn: 'Al-Ahqaf', ayahCount: 35 },
  { number: 47, nameAr: 'محمد', nameEn: 'Muhammad', ayahCount: 38 },
  { number: 48, nameAr: 'الفتح', nameEn: 'Al-Fath', ayahCount: 29 },
  { number: 49, nameAr: 'الحجرات', nameEn: 'Al-Hujurat', ayahCount: 18 },
  { number: 50, nameAr: 'ق', nameEn: 'Qaf', ayahCount: 45 },
  { number: 51, nameAr: 'الذاريات', nameEn: 'Adh-Dhariyat', ayahCount: 60 },
  { number: 52, nameAr: 'الطور', nameEn: 'At-Tur', ayahCount: 49 },
  { number: 53, nameAr: 'النجم', nameEn: 'An-Najm', ayahCount: 62 },
  { number: 54, nameAr: 'القمر', nameEn: 'Al-Qamar', ayahCount: 55 },
  { number: 55, nameAr: 'الرحمن', nameEn: 'Ar-Rahman', ayahCount: 78 },
  { number: 56, nameAr: 'الواقعة', nameEn: 'Al-Waqiah', ayahCount: 96 },
  { number: 57, nameAr: 'الحديد', nameEn: 'Al-Hadid', ayahCount: 29 },
  { number: 58, nameAr: 'المجادلة', nameEn: 'Al-Mujadilah', ayahCount: 22 },
  { number: 59, nameAr: 'الحشر', nameEn: 'Al-Hashr', ayahCount: 24 },
  { number: 60, nameAr: 'الممتحنة', nameEn: 'Al-Mumtahanah', ayahCount: 13 },
  { number: 61, nameAr: 'الصف', nameEn: 'As-Saff', ayahCount: 14 },
  { number: 62, nameAr: 'الجمعة', nameEn: 'Al-Jumuah', ayahCount: 11 },
  { number: 63, nameAr: 'المنافقون', nameEn: 'Al-Munafiqun', ayahCount: 11 },
  { number: 64, nameAr: 'التغابن', nameEn: 'At-Taghabun', ayahCount: 18 },
  { number: 65, nameAr: 'الطلاق', nameEn: 'At-Talaq', ayahCount: 12 },
  { number: 66, nameAr: 'التحريم', nameEn: 'At-Tahrim', ayahCount: 12 },
  { number: 67, nameAr: 'الملك', nameEn: 'Al-Mulk', ayahCount: 30 },
  { number: 68, nameAr: 'القلم', nameEn: 'Al-Qalam', ayahCount: 52 },
  { number: 69, nameAr: 'الحاقة', nameEn: 'Al-Haqqah', ayahCount: 52 },
  { number: 70, nameAr: 'المعارج', nameEn: 'Al-Maarij', ayahCount: 44 },
  { number: 71, nameAr: 'نوح', nameEn: 'Nuh', ayahCount: 28 },
  { number: 72, nameAr: 'الجن', nameEn: 'Al-Jinn', ayahCount: 28 },
  { number: 73, nameAr: 'المزمل', nameEn: 'Al-Muzzammil', ayahCount: 20 },
  { number: 74, nameAr: 'المدثر', nameEn: 'Al-Muddaththir', ayahCount: 56 },
  { number: 75, nameAr: 'القيامة', nameEn: 'Al-Qiyamah', ayahCount: 40 },
  { number: 76, nameAr: 'الإنسان', nameEn: 'Al-Insan', ayahCount: 31 },
  { number: 77, nameAr: 'المرسلات', nameEn: 'Al-Mursalat', ayahCount: 50 },
  { number: 78, nameAr: 'النبأ', nameEn: 'An-Naba', ayahCount: 40 },
  { number: 79, nameAr: 'النازعات', nameEn: 'An-Naziat', ayahCount: 46 },
  { number: 80, nameAr: 'عبس', nameEn: 'Abasa', ayahCount: 42 },
  { number: 81, nameAr: 'التكوير', nameEn: 'At-Takwir', ayahCount: 29 },
  { number: 82, nameAr: 'الانفطار', nameEn: 'Al-Infitar', ayahCount: 19 },
  { number: 83, nameAr: 'المطففين', nameEn: 'Al-Mutaffifin', ayahCount: 36 },
  { number: 84, nameAr: 'الانشقاق', nameEn: 'Al-Inshiqaq', ayahCount: 25 },
  { number: 85, nameAr: 'البروج', nameEn: 'Al-Buruj', ayahCount: 22 },
  { number: 86, nameAr: 'الطارق', nameEn: 'At-Tariq', ayahCount: 17 },
  { number: 87, nameAr: 'الأعلى', nameEn: 'Al-Ala', ayahCount: 19 },
  { number: 88, nameAr: 'الغاشية', nameEn: 'Al-Ghashiyah', ayahCount: 26 },
  { number: 89, nameAr: 'الفجر', nameEn: 'Al-Fajr', ayahCount: 30 },
  { number: 90, nameAr: 'البلد', nameEn: 'Al-Balad', ayahCount: 20 },
  { number: 91, nameAr: 'الشمس', nameEn: 'Ash-Shams', ayahCount: 15 },
  { number: 92, nameAr: 'الليل', nameEn: 'Al-Layl', ayahCount: 21 },
  { number: 93, nameAr: 'الضحى', nameEn: 'Ad-Duha', ayahCount: 11 },
  { number: 94, nameAr: 'الشرح', nameEn: 'Ash-Sharh', ayahCount: 8 },
  { number: 95, nameAr: 'التين', nameEn: 'At-Tin', ayahCount: 8 },
  { number: 96, nameAr: 'العلق', nameEn: 'Al-Alaq', ayahCount: 19 },
  { number: 97, nameAr: 'القدر', nameEn: 'Al-Qadr', ayahCount: 5 },
  { number: 98, nameAr: 'البينة', nameEn: 'Al-Bayyinah', ayahCount: 8 },
  { number: 99, nameAr: 'الزلزلة', nameEn: 'Az-Zalzalah', ayahCount: 8 },
  { number: 100, nameAr: 'العاديات', nameEn: 'Al-Adiyat', ayahCount: 11 },
  { number: 101, nameAr: 'القارعة', nameEn: 'Al-Qariah', ayahCount: 11 },
  { number: 102, nameAr: 'التكاثر', nameEn: 'At-Takathur', ayahCount: 8 },
  { number: 103, nameAr: 'العصر', nameEn: 'Al-Asr', ayahCount: 3 },
  { number: 104, nameAr: 'الهمزة', nameEn: 'Al-Humazah', ayahCount: 9 },
  { number: 105, nameAr: 'الفيل', nameEn: 'Al-Fil', ayahCount: 5 },
  { number: 106, nameAr: 'قريش', nameEn: 'Quraysh', ayahCount: 4 },
  { number: 107, nameAr: 'الماعون', nameEn: 'Al-Maun', ayahCount: 7 },
  { number: 108, nameAr: 'الكوثر', nameEn: 'Al-Kawthar', ayahCount: 3 },
  { number: 109, nameAr: 'الكافرون', nameEn: 'Al-Kafirun', ayahCount: 6 },
  { number: 110, nameAr: 'النصر', nameEn: 'An-Nasr', ayahCount: 3 },
  { number: 111, nameAr: 'المسد', nameEn: 'Al-Masad', ayahCount: 5 },
  { number: 112, nameAr: 'الإخلاص', nameEn: 'Al-Ikhlas', ayahCount: 4 },
  { number: 113, nameAr: 'الفلق', nameEn: 'Al-Falaq', ayahCount: 5 },
  { number: 114, nameAr: 'الناس', nameEn: 'An-Nas', ayahCount: 6 },
]

export const SURAH_BY_NUMBER: ReadonlyMap<number, Surah> = new Map(
  SURAHS.map((s) => [s.number, s]),
)

export function getSurah(number: number): Surah {
  const surah = SURAH_BY_NUMBER.get(number)
  if (!surah) {
    throw new Error(`Unknown surah number: ${number}`)
  }
  return surah
}
```

- [ ] **Step 2: Lint and self-check**

```bash
npm run lint
```

Expected: passes.

Sanity check: `SURAHS.length === 114`. If the lint passes but the array got miscounted, the implementer should grep the file:

```bash
grep -c '^  { number:' src/data/surahs.ts
```

Expected output: `114`.

- [ ] **Step 3: Commit**

```bash
git add src/data/surahs.ts
git commit -m "Add surah catalogue constant"
```

---

### Task 7: Grade labels constant (`src/data/grades.ts`)

**Files:**
- Create: `src/data/grades.ts`

- [ ] **Step 1: Create the file**

```ts
export type SurahGrade = 'good' | 'medium' | 'forgotten'

export const GRADE_LABELS: Record<SurahGrade, string> = {
  good: 'حفظ متقن',
  medium: 'حفظ متوسط',
  forgotten: 'يحتاج مراجعة',
}

export const GRADE_COLORS: Record<SurahGrade, string> = {
  good: 'teal',
  medium: 'yellow',
  forgotten: 'orange',
}

export const GRADE_ORDER: ReadonlyArray<SurahGrade> = ['good', 'medium', 'forgotten']
```

- [ ] **Step 2: Lint**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/data/grades.ts
git commit -m "Add grade labels and colors"
```

---

## Phase 3 — Student-side UI

### Task 8: `SurahGradeRow` component + story (read-only mode)

A single row showing surah name + Arabic grade label as a colored Mantine `Badge`. Editable mode is added later in Task 14.

**Files:**
- Create: `src/components/surahs/SurahGradeRow/SurahGradeRow.tsx`
- Create: `src/components/surahs/SurahGradeRow/SurahGradeRow.stories.tsx`
- Create: `src/components/surahs/SurahGradeRow/index.ts`

- [ ] **Step 1: Create the component**

```tsx
// src/components/surahs/SurahGradeRow/SurahGradeRow.tsx
import { Badge, Group, Stack, Text } from '@mantine/core'
import type { Surah } from '~/data/surahs'
import { GRADE_COLORS, GRADE_LABELS, type SurahGrade } from '~/data/grades'

export interface SurahGradeRowProps {
  surah: Surah
  grade: SurahGrade
  updatedAt: number
}

export function SurahGradeRow({ surah, grade, updatedAt }: SurahGradeRowProps) {
  return (
    <Group justify="space-between" wrap="nowrap" align="flex-start">
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Text fw={700}>{surah.nameAr}</Text>
        <Text c="dimmed" size="sm">
          {`سورة رقم ${surah.number} • ${formatRelative(updatedAt)}`}
        </Text>
      </Stack>
      <Badge color={GRADE_COLORS[grade]} radius="xl" variant="light">
        {GRADE_LABELS[grade]}
      </Badge>
    </Group>
  )
}

function formatRelative(timestamp: number) {
  const formatter = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' })
  const diffMs = timestamp - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (Math.abs(diffDays) >= 1) {
    return `آخر تقييم ${formatter.format(diffDays, 'day')}`
  }
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  if (Math.abs(diffHours) >= 1) {
    return `آخر تقييم ${formatter.format(diffHours, 'hour')}`
  }
  return 'آخر تقييم الآن'
}
```

- [ ] **Step 2: Create the story**

```tsx
// src/components/surahs/SurahGradeRow/SurahGradeRow.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SurahGradeRow } from './SurahGradeRow'
import { getSurah } from '~/data/surahs'

const meta = {
  title: 'Surahs/SurahGradeRow',
  component: SurahGradeRow,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SurahGradeRow>

export default meta
type Story = StoryObj<typeof meta>

export const Good: Story = {
  args: {
    surah: getSurah(18),
    grade: 'good',
    updatedAt: Date.now() - 1000 * 60 * 60 * 2,
  },
}

export const Medium: Story = {
  args: {
    surah: getSurah(19),
    grade: 'medium',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 3,
  },
}

export const Forgotten: Story = {
  args: {
    surah: getSurah(2),
    grade: 'forgotten',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24 * 14,
  },
}
```

- [ ] **Step 3: Create the barrel**

```ts
// src/components/surahs/SurahGradeRow/index.ts
export { SurahGradeRow } from './SurahGradeRow'
export type { SurahGradeRowProps } from './SurahGradeRow'
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 5: Verify in Storybook (optional but recommended)**

```bash
npm run storybook
```

Open `http://localhost:6006`, navigate to Surahs → SurahGradeRow. All three story variants should render with correct Arabic labels and the grade badge in `teal | yellow | orange`. Stop the server (Ctrl+C) once verified.

- [ ] **Step 6: Commit**

```bash
git add src/components/surahs/SurahGradeRow/
git commit -m "Add SurahGradeRow component (read-only)"
```

---

### Task 9: `SurahGradeList` component + story

A list wrapper. Sorts by `surahNumber` ascending and renders an empty state when there are no rows.

**Files:**
- Create: `src/components/surahs/SurahGradeList/SurahGradeList.tsx`
- Create: `src/components/surahs/SurahGradeList/SurahGradeList.stories.tsx`
- Create: `src/components/surahs/SurahGradeList/index.ts`

- [ ] **Step 1: Create the component**

```tsx
// src/components/surahs/SurahGradeList/SurahGradeList.tsx
import { Card, Stack, Text } from '@mantine/core'
import { SurahGradeRow } from '../SurahGradeRow'
import { getSurah } from '~/data/surahs'
import type { SurahGrade } from '~/data/grades'

export interface SurahGradeListItem {
  surahNumber: number
  grade: SurahGrade
  updatedAt: number
}

export interface SurahGradeListProps {
  rows: ReadonlyArray<SurahGradeListItem>
  emptyMessage: string
}

export function SurahGradeList({ rows, emptyMessage }: SurahGradeListProps) {
  if (rows.length === 0) {
    return (
      <Card withBorder radius="lg" p="xl">
        <Text c="dimmed" ta="center">
          {emptyMessage}
        </Text>
      </Card>
    )
  }

  const sorted = [...rows].sort((a, b) => a.surahNumber - b.surahNumber)

  return (
    <Stack gap="md">
      {sorted.map((row) => (
        <Card key={row.surahNumber} withBorder radius="lg" p="md">
          <SurahGradeRow
            surah={getSurah(row.surahNumber)}
            grade={row.grade}
            updatedAt={row.updatedAt}
          />
        </Card>
      ))}
    </Stack>
  )
}
```

- [ ] **Step 2: Create the story**

```tsx
// src/components/surahs/SurahGradeList/SurahGradeList.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { SurahGradeList } from './SurahGradeList'

const meta = {
  title: 'Surahs/SurahGradeList',
  component: SurahGradeList,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof SurahGradeList>

export default meta
type Story = StoryObj<typeof meta>

const now = Date.now()

export const Populated: Story = {
  args: {
    emptyMessage: 'لا توجد سور بعد.',
    rows: [
      { surahNumber: 1, grade: 'good', updatedAt: now - 1000 * 60 * 60 * 2 },
      { surahNumber: 18, grade: 'medium', updatedAt: now - 1000 * 60 * 60 * 24 },
      { surahNumber: 36, grade: 'forgotten', updatedAt: now - 1000 * 60 * 60 * 24 * 7 },
      { surahNumber: 67, grade: 'good', updatedAt: now - 1000 * 60 * 60 * 6 },
    ],
  },
}

export const Empty: Story = {
  args: {
    emptyMessage: 'لم تبدأ في حفظ أي سورة بعد. تواصل مع معلمك.',
    rows: [],
  },
}
```

- [ ] **Step 3: Create the barrel**

```ts
// src/components/surahs/SurahGradeList/index.ts
export { SurahGradeList } from './SurahGradeList'
export type {
  SurahGradeListItem,
  SurahGradeListProps,
} from './SurahGradeList'
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/surahs/SurahGradeList/
git commit -m "Add SurahGradeList component"
```

---

### Task 10: Student route `/surahs` + bottom-nav wiring

Bundled because the type system has a circular dependency: the fixture's `to: '/surahs'` needs the route file to exist (so `/surahs` enters `FileRouteTypes['to']`), but the route's `activeItemId="surahs"` needs the type update first. Doing both in one task with one final lint check resolves both edges at once.

The current `BottomNavItem` conflates `id` and `icon` into one `BottomNavIcon` union — they need to be split so the slot ID can be `'surahs'` while the icon glyph stays `'lessons'` (the book icon).

**Files:**
- Create: `src/routes/_protected/surahs.tsx`
- Modify: `src/components/home/home-dashboard.types.ts`
- Modify: `src/components/home/home-dashboard.fixtures.ts`

- [ ] **Step 1: Create the route file**

```tsx
// src/routes/_protected/surahs.tsx
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

export const Route = createFileRoute('/_protected/surahs')({
  loader: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(currentUserQuery)
    await context.queryClient.ensureQueryData(
      convexQuery(api.surahGrades.listForStudent, { studentId: me.id }),
    )
  },
  component: StudentSurahsPage,
})

function StudentSurahsPage() {
  const theme = useMantineTheme()
  const { data: me } = useSuspenseQuery(currentUserQuery)
  const { data: rows } = useSuspenseQuery(
    convexQuery(api.surahGrades.listForStudent, { studentId: me.id }),
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

- [ ] **Step 2: Regenerate the route tree**

```bash
npm run dev:web
```

Wait for the line `Wrote routeTree.gen.ts` (a few seconds), then stop with Ctrl+C. After this, `/surahs` is a member of `FileRouteTypes['to']`.

- [ ] **Step 3: Update the bottom-nav types**

Replace the relevant section near the top of `src/components/home/home-dashboard.types.ts` so `id` and `icon` use distinct unions, and `BottomNavRoute` includes `/surahs`. The full type-only diff (delete the old lines, add the new ones):

```ts
// before:
export type BottomNavIcon = 'home' | 'lessons' | 'profile'
export type BottomNavRoute = Extract<FileRouteTypes['to'], '/' | '/profile'>

export interface BottomNavItem {
  id: BottomNavIcon
  label: string
  icon: BottomNavIcon
  to?: BottomNavRoute
}

// after:
export type BottomNavIcon = 'home' | 'lessons' | 'profile'
export type BottomNavId = 'home' | 'surahs' | 'profile'
export type BottomNavRoute = Extract<
  FileRouteTypes['to'],
  '/' | '/surahs' | '/profile'
>

export interface BottomNavItem {
  id: BottomNavId
  label: string
  icon: BottomNavIcon
  to?: BottomNavRoute
}
```

The `BottomNavIcon` union stays the same because the icon glyph for the new slot is still `'lessons'` (the book icon). Only the slot identifier changes to `'surahs'`.

- [ ] **Step 4: Update the fixtures**

In `src/components/home/home-dashboard.fixtures.ts`, replace the `lessons` bottom-nav entry. Find this block:

```ts
{
  id: 'lessons',
  label: 'الدروس',
  icon: 'lessons',
},
```

Replace it with:

```ts
{
  id: 'surahs',
  label: 'حفظي',
  icon: 'lessons',
  to: '/surahs',
},
```

- [ ] **Step 5: Sweep for any other `'lessons'` id usage**

```bash
grep -rn "id: 'lessons'" src/
grep -rn "activeItemId=\"lessons\"" src/
```

Expected: no matches. If any are found, update them to `'surahs'`.

- [ ] **Step 6: Lint**

```bash
npm run lint
```

Expected: passes. All three changes — route file, type widening, fixture update — must be in place for the lint to succeed.

- [ ] **Step 7: Commit**

```bash
git add src/routes/_protected/surahs.tsx \
        src/routeTree.gen.ts \
        src/components/home/home-dashboard.types.ts \
        src/components/home/home-dashboard.fixtures.ts
git commit -m "Add /surahs route and wire bottom-nav slot"
```

---

## Phase 4 — Staff-side UI

### Task 11: Staff route guard

Mirrors the existing `_protected/admin/route.tsx` pattern. Allows `teacher | admin`.

**Files:**
- Create: `src/routes/_protected/staff/route.tsx`

- [ ] **Step 1: Create the guard**

```tsx
// src/routes/_protected/staff/route.tsx
import { Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { currentUserQuery } from '~/lib/auth-queries'

export const Route = createFileRoute('/_protected/staff')({
  beforeLoad: async ({ context }) => {
    const me = await context.queryClient.ensureQueryData(currentUserQuery)
    if (!me.isAdmin && !me.isTeacher) {
      throw redirect({ to: '/' })
    }
  },
  component: Outlet,
})
```

- [ ] **Step 2: Regenerate routes + lint**

```bash
npm run dev:web   # let routeTree regenerate, then Ctrl+C
npm run lint
```

Expected: lint passes. Note: a parent route file with `Outlet` only generates a usable layout once at least one child route exists (Task 13). This is fine — TS and ESLint do not block.

- [ ] **Step 3: Commit**

```bash
git add src/routes/_protected/staff/route.tsx src/routeTree.gen.ts
git commit -m "Add staff route guard"
```

---

### Task 12: `StudentsPicker` component + story

Lists students with avatar initials, displayName, and `@username`. Each item is a `Link` to `/staff/students/$studentId`.

**Files:**
- Create: `src/components/surahs/StudentsPicker/StudentsPicker.tsx`
- Create: `src/components/surahs/StudentsPicker/StudentsPicker.stories.tsx`
- Create: `src/components/surahs/StudentsPicker/index.ts`

- [ ] **Step 1: Create the component**

```tsx
// src/components/surahs/StudentsPicker/StudentsPicker.tsx
import { Link } from '@tanstack/react-router'
import { Avatar, Card, Group, Stack, Text } from '@mantine/core'

export interface StudentSummary {
  id: string
  displayName: string
  username: string
}

export interface StudentsPickerProps {
  students: ReadonlyArray<StudentSummary>
  emptyMessage: string
}

export function StudentsPicker({ students, emptyMessage }: StudentsPickerProps) {
  if (students.length === 0) {
    return (
      <Card withBorder radius="lg" p="xl">
        <Text c="dimmed" ta="center">
          {emptyMessage}
        </Text>
      </Card>
    )
  }

  return (
    <Stack gap="sm">
      {students.map((student) => (
        <Card
          key={student.id}
          withBorder
          radius="lg"
          p="md"
          component={Link}
          to="/staff/students/$studentId"
          params={{ studentId: student.id }}
          style={{ textDecoration: 'none', color: 'inherit' }}
        >
          <Group wrap="nowrap">
            <Avatar color="primary" radius="xl">
              {getInitials(student.displayName)}
            </Avatar>
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text fw={700} lineClamp={1}>
                {student.displayName || 'بدون اسم'}
              </Text>
              <Text c="dimmed" size="sm">
                {student.username ? `@${student.username}` : 'بدون اسم مستخدم'}
              </Text>
            </Stack>
          </Group>
        </Card>
      ))}
    </Stack>
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

- [ ] **Step 2: Create the story**

```tsx
// src/components/surahs/StudentsPicker/StudentsPicker.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { StudentsPicker } from './StudentsPicker'

const meta = {
  title: 'Surahs/StudentsPicker',
  component: StudentsPicker,
  parameters: {
    layout: 'padded',
  },
} satisfies Meta<typeof StudentsPicker>

export default meta
type Story = StoryObj<typeof meta>

export const Populated: Story = {
  args: {
    emptyMessage: 'لا يوجد طلاب بعد.',
    students: [
      { id: '1', displayName: 'أحمد محمد', username: 'ahmad' },
      { id: '2', displayName: 'فاطمة علي', username: 'fatima' },
      { id: '3', displayName: 'يوسف الحسن', username: 'yusuf' },
    ],
  },
}

export const Empty: Story = {
  args: {
    emptyMessage: 'لا يوجد طلاب بعد.',
    students: [],
  },
}
```

- [ ] **Step 3: Create the barrel**

```ts
// src/components/surahs/StudentsPicker/index.ts
export { StudentsPicker } from './StudentsPicker'
export type { StudentSummary, StudentsPickerProps } from './StudentsPicker'
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: passes. The `Link` to `/staff/students/$studentId` may temporarily fail TS until Task 17 creates that route — if it does, run lint again after Task 17 completes; do not block on it here.

- [ ] **Step 5: Commit**

```bash
git add src/components/surahs/StudentsPicker/
git commit -m "Add StudentsPicker component"
```

---

### Task 13: Staff route `/staff/students` (picker page)

**Files:**
- Create: `src/routes/_protected/staff/students/index.tsx`

- [ ] **Step 1: Create the route**

```tsx
// src/routes/_protected/staff/students/index.tsx
import { createFileRoute } from '@tanstack/react-router'
import { Box, Container, Stack, Text, Title, useMantineTheme } from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMemo } from 'react'
import { api } from '../../../../../convex/_generated/api'
import { currentUserQuery } from '~/lib/auth-queries'
import { BottomNav, HomeTopBar, createHomeDashboardData } from '~/components/home'
import { StudentsPicker } from '~/components/surahs/StudentsPicker'

export const Route = createFileRoute('/_protected/staff/students/')({
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(
      convexQuery(api.surahGrades.listAllStudents, {}),
    )
  },
  component: StaffStudentsPage,
})

function StaffStudentsPage() {
  const theme = useMantineTheme()
  const { data: me } = useSuspenseQuery(currentUserQuery)
  const { data: students } = useSuspenseQuery(
    convexQuery(api.surahGrades.listAllStudents, {}),
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
              إدارة الطلاب
            </Text>
            <Title order={1}>طلابك</Title>
            <Text c="dimmed">
              اختر طالبًا لعرض السور التي حفظها وتقييمه.
            </Text>
          </Stack>

          <StudentsPicker
            students={students.map((s) => ({
              id: s.id,
              displayName: s.displayName,
              username: s.username,
            }))}
            emptyMessage="لا يوجد طلاب مسجّلون بعد."
          />
        </Stack>
      </Container>

      <BottomNav
        activeItemId="profile"
        items={homeDashboardData.bottomNavItems}
      />
    </Box>
  )
}
```

The `activeItemId="profile"` is intentional — there's no bottom-nav slot for staff, so we visually keep the `profile` slot highlighted (since that's where staff arrived from via the `إدارة الطلاب` link added in Task 18).

- [ ] **Step 2: Regenerate routes + lint**

```bash
npm run dev:web   # let routeTree regenerate, then Ctrl+C
npm run lint
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/routes/_protected/staff/students/index.tsx src/routeTree.gen.ts
git commit -m "Add /staff/students picker route"
```

---

### Task 14: Editable mode for `SurahGradeRow`

Adds an `editable` prop. When true, instead of a static `Badge`, render three `Chip`s (`متقن / متوسط / يحتاج مراجعة`) — clicking a chip calls `onChange(newGrade)`.

**Files:**
- Modify: `src/components/surahs/SurahGradeRow/SurahGradeRow.tsx`
- Modify: `src/components/surahs/SurahGradeRow/SurahGradeRow.stories.tsx`

- [ ] **Step 1: Update the component**

Replace the contents of `src/components/surahs/SurahGradeRow/SurahGradeRow.tsx` with:

```tsx
import { Badge, Chip, Group, Stack, Text } from '@mantine/core'
import type { Surah } from '~/data/surahs'
import {
  GRADE_COLORS,
  GRADE_LABELS,
  GRADE_ORDER,
  type SurahGrade,
} from '~/data/grades'

export interface SurahGradeRowProps {
  surah: Surah
  grade: SurahGrade
  updatedAt: number
  editable?: boolean
  onChange?: (grade: SurahGrade) => void
}

export function SurahGradeRow({
  surah,
  grade,
  updatedAt,
  editable = false,
  onChange,
}: SurahGradeRowProps) {
  return (
    <Stack gap="sm">
      <Group justify="space-between" wrap="nowrap" align="flex-start">
        <Stack gap={2} style={{ minWidth: 0 }}>
          <Text fw={700}>{surah.nameAr}</Text>
          <Text c="dimmed" size="sm">
            {`سورة رقم ${surah.number} • ${formatRelative(updatedAt)}`}
          </Text>
        </Stack>
        {!editable ? (
          <Badge color={GRADE_COLORS[grade]} radius="xl" variant="light">
            {GRADE_LABELS[grade]}
          </Badge>
        ) : null}
      </Group>

      {editable ? (
        <Chip.Group
          multiple={false}
          value={grade}
          onChange={(value) => {
            if (
              value === 'good' ||
              value === 'medium' ||
              value === 'forgotten'
            ) {
              onChange?.(value)
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
      ) : null}
    </Stack>
  )
}

function formatRelative(timestamp: number) {
  const formatter = new Intl.RelativeTimeFormat('ar', { numeric: 'auto' })
  const diffMs = timestamp - Date.now()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (Math.abs(diffDays) >= 1) {
    return `آخر تقييم ${formatter.format(diffDays, 'day')}`
  }
  const diffHours = Math.round(diffMs / (1000 * 60 * 60))
  if (Math.abs(diffHours) >= 1) {
    return `آخر تقييم ${formatter.format(diffHours, 'hour')}`
  }
  return 'آخر تقييم الآن'
}
```

- [ ] **Step 2: Add an editable story variant**

Append to `SurahGradeRow.stories.tsx`:

```tsx
export const Editable: Story = {
  args: {
    surah: getSurah(36),
    grade: 'medium',
    updatedAt: Date.now() - 1000 * 60 * 60 * 24,
    editable: true,
    onChange: (g) => console.log('grade changed to', g),
  },
}
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/surahs/SurahGradeRow/
git commit -m "Add editable mode to SurahGradeRow"
```

---

### Task 15: Editable mode for `SurahGradeList`

Adds `editable`, `onChangeGrade`, and `onAddSurah` props. When `editable`, each row's `onChange` propagates up via `onChangeGrade(surahNumber, newGrade)`. An "إضافة سورة" button appears at the top of the list (regardless of whether rows exist) when `editable && onAddSurah`.

**Files:**
- Modify: `src/components/surahs/SurahGradeList/SurahGradeList.tsx`
- Modify: `src/components/surahs/SurahGradeList/SurahGradeList.stories.tsx`

- [ ] **Step 1: Update the component**

Replace `src/components/surahs/SurahGradeList/SurahGradeList.tsx` with:

```tsx
import { Button, Card, Group, Stack, Text } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import { SurahGradeRow } from '../SurahGradeRow'
import { getSurah } from '~/data/surahs'
import type { SurahGrade } from '~/data/grades'

export interface SurahGradeListItem {
  surahNumber: number
  grade: SurahGrade
  updatedAt: number
}

export interface SurahGradeListProps {
  rows: ReadonlyArray<SurahGradeListItem>
  emptyMessage: string
  editable?: boolean
  onChangeGrade?: (surahNumber: number, grade: SurahGrade) => void
  onAddSurah?: () => void
}

export function SurahGradeList({
  rows,
  emptyMessage,
  editable = false,
  onChangeGrade,
  onAddSurah,
}: SurahGradeListProps) {
  const sorted = [...rows].sort((a, b) => a.surahNumber - b.surahNumber)
  const showAdd = editable && onAddSurah

  return (
    <Stack gap="md">
      {showAdd ? (
        <Group justify="flex-end">
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={onAddSurah}
            variant="light"
          >
            إضافة سورة
          </Button>
        </Group>
      ) : null}

      {sorted.length === 0 ? (
        <Card withBorder radius="lg" p="xl">
          <Text c="dimmed" ta="center">
            {emptyMessage}
          </Text>
        </Card>
      ) : (
        sorted.map((row) => (
          <Card key={row.surahNumber} withBorder radius="lg" p="md">
            <SurahGradeRow
              surah={getSurah(row.surahNumber)}
              grade={row.grade}
              updatedAt={row.updatedAt}
              editable={editable}
              onChange={(grade) => onChangeGrade?.(row.surahNumber, grade)}
            />
          </Card>
        ))
      )}
    </Stack>
  )
}
```

- [ ] **Step 2: Add an editable story variant**

Append to `SurahGradeList.stories.tsx`:

```tsx
export const Editable: Story = {
  args: {
    emptyMessage: 'لم يبدأ هذا الطالب الحفظ بعد. أضف أول سورة.',
    rows: [
      { surahNumber: 1, grade: 'good', updatedAt: now - 1000 * 60 * 60 },
      { surahNumber: 18, grade: 'medium', updatedAt: now - 1000 * 60 * 60 * 24 },
    ],
    editable: true,
    onChangeGrade: (n, g) => console.log('grade changed', n, g),
    onAddSurah: () => console.log('add surah clicked'),
  },
}
```

- [ ] **Step 3: Lint**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/surahs/SurahGradeList/
git commit -m "Add editable mode to SurahGradeList"
```

---

### Task 16: `AddSurahDrawer` component + story

A Mantine `Drawer` that lists surahs not already on the student's list. The user types in a search input that filters by Arabic or English name, taps a surah, picks a grade, and submits.

**Files:**
- Create: `src/components/surahs/AddSurahDrawer/AddSurahDrawer.tsx`
- Create: `src/components/surahs/AddSurahDrawer/AddSurahDrawer.stories.tsx`
- Create: `src/components/surahs/AddSurahDrawer/index.ts`

- [ ] **Step 1: Create the component**

```tsx
// src/components/surahs/AddSurahDrawer/AddSurahDrawer.tsx
import {
  Button,
  Chip,
  Drawer,
  Group,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core'
import { IconSearch } from '@tabler/icons-react'
import { useMemo, useState } from 'react'
import { SURAHS, type Surah } from '~/data/surahs'
import {
  GRADE_COLORS,
  GRADE_LABELS,
  GRADE_ORDER,
  type SurahGrade,
} from '~/data/grades'

export interface AddSurahDrawerProps {
  opened: boolean
  onClose: () => void
  excludeSurahNumbers: ReadonlyArray<number>
  onSubmit: (input: { surahNumber: number; grade: SurahGrade }) => void
}

export function AddSurahDrawer({
  opened,
  onClose,
  excludeSurahNumbers,
  onSubmit,
}: AddSurahDrawerProps) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Surah | null>(null)
  const [grade, setGrade] = useState<SurahGrade>('good')

  const excludeSet = useMemo(
    () => new Set(excludeSurahNumbers),
    [excludeSurahNumbers],
  )

  const candidates = useMemo(() => {
    const term = search.trim().toLowerCase()
    return SURAHS.filter((s) => !excludeSet.has(s.number)).filter((s) => {
      if (!term) return true
      return (
        s.nameAr.includes(term) ||
        s.nameEn.toLowerCase().includes(term) ||
        String(s.number) === term
      )
    })
  }, [search, excludeSet])

  function handleClose() {
    setSearch('')
    setSelected(null)
    setGrade('good')
    onClose()
  }

  function handleSubmit() {
    if (!selected) return
    onSubmit({ surahNumber: selected.number, grade })
    handleClose()
  }

  return (
    <Drawer
      opened={opened}
      onClose={handleClose}
      position="bottom"
      size="80%"
      title="إضافة سورة"
      padding="lg"
    >
      <Stack gap="md">
        {!selected ? (
          <>
            <TextInput
              placeholder="ابحث باسم السورة أو رقمها"
              leftSection={<IconSearch size={16} />}
              value={search}
              onChange={(e) => setSearch(e.currentTarget.value)}
            />

            <Stack gap="xs" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              {candidates.length === 0 ? (
                <Text c="dimmed" ta="center" py="lg">
                  لا توجد نتائج.
                </Text>
              ) : (
                candidates.map((s) => (
                  <UnstyledButton
                    key={s.number}
                    onClick={() => setSelected(s)}
                    p="sm"
                    style={{ borderRadius: '0.5rem' }}
                  >
                    <Group justify="space-between">
                      <Text fw={600}>{s.nameAr}</Text>
                      <Text c="dimmed" size="sm">
                        {`${s.number} • ${s.nameEn}`}
                      </Text>
                    </Group>
                  </UnstyledButton>
                ))
              )}
            </Stack>
          </>
        ) : (
          <Stack gap="md">
            <Stack gap={2}>
              <Text c="dimmed" size="sm">السورة المختارة</Text>
              <Text fw={700} size="lg">{selected.nameAr}</Text>
            </Stack>

            <Stack gap="xs">
              <Text c="dimmed" size="sm">اختر التقييم</Text>
              <Chip.Group
                multiple={false}
                value={grade}
                onChange={(value) => {
                  if (
                    value === 'good' ||
                    value === 'medium' ||
                    value === 'forgotten'
                  ) {
                    setGrade(value)
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
              <Button variant="subtle" onClick={() => setSelected(null)}>
                اختيار سورة أخرى
              </Button>
              <Button onClick={handleSubmit}>حفظ</Button>
            </Group>
          </Stack>
        )}
      </Stack>
    </Drawer>
  )
}
```

- [ ] **Step 2: Create the story**

```tsx
// src/components/surahs/AddSurahDrawer/AddSurahDrawer.stories.tsx
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Button } from '@mantine/core'
import { useState } from 'react'
import { AddSurahDrawer } from './AddSurahDrawer'

const meta = {
  title: 'Surahs/AddSurahDrawer',
  component: AddSurahDrawer,
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof AddSurahDrawer>

export default meta
type Story = StoryObj<typeof meta>

function Wrapper() {
  const [opened, setOpened] = useState(false)
  return (
    <div style={{ padding: '2rem' }}>
      <Button onClick={() => setOpened(true)}>افتح المحدد</Button>
      <AddSurahDrawer
        opened={opened}
        onClose={() => setOpened(false)}
        excludeSurahNumbers={[1, 2, 18]}
        onSubmit={(input) => console.log('submit', input)}
      />
    </div>
  )
}

export const Interactive: Story = {
  render: () => <Wrapper />,
}
```

- [ ] **Step 3: Create the barrel**

```ts
// src/components/surahs/AddSurahDrawer/index.ts
export { AddSurahDrawer } from './AddSurahDrawer'
export type { AddSurahDrawerProps } from './AddSurahDrawer'
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/surahs/AddSurahDrawer/
git commit -m "Add AddSurahDrawer component"
```

---

### Task 17: Staff route `/staff/students/$studentId`

Per-student grading page. Loads the student's profile and grades, renders the editable list, and wires the `setGrade` mutation + `AddSurahDrawer`.

**Files:**
- Create: `src/routes/_protected/staff/students/$studentId.tsx`

- [ ] **Step 1: Create the route**

```tsx
// src/routes/_protected/staff/students/$studentId.tsx
import { createFileRoute } from '@tanstack/react-router'
import {
  Avatar,
  Box,
  Container,
  Group,
  Notification,
  Stack,
  Text,
  Title,
  useMantineTheme,
} from '@mantine/core'
import { useSuspenseQuery } from '@tanstack/react-query'
import { convexQuery } from '@convex-dev/react-query'
import { useMutation } from 'convex/react'
import { useMemo, useState } from 'react'
import { api } from '../../../../../convex/_generated/api'
import { currentUserQuery } from '~/lib/auth-queries'
import {
  BottomNav,
  HomeTopBar,
  createHomeDashboardData,
} from '~/components/home'
import { SurahGradeList } from '~/components/surahs/SurahGradeList'
import { AddSurahDrawer } from '~/components/surahs/AddSurahDrawer'

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
  const setGrade = useMutation(api.surahGrades.setGrade)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const homeDashboardData = useMemo(
    () => createHomeDashboardData(me.displayName),
    [me.displayName],
  )

  const student = students.find((s) => s.id === studentId)

  async function handleChangeGrade(
    surahNumber: number,
    grade: 'good' | 'medium' | 'forgotten',
  ) {
    setErrorMessage(null)
    try {
      await setGrade({ studentId, surahNumber, grade })
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'تعذر حفظ التقييم.',
      )
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
      setErrorMessage(
        error instanceof Error ? error.message : 'تعذر إضافة السورة.',
      )
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

          <SurahGradeList
            rows={rows.map((r) => ({
              surahNumber: r.surahNumber,
              grade: r.grade,
              updatedAt: r.updatedAt,
            }))}
            emptyMessage="لم يبدأ هذا الطالب الحفظ بعد. أضف أول سورة."
            editable
            onChangeGrade={handleChangeGrade}
            onAddSurah={() => setDrawerOpen(true)}
          />
        </Stack>
      </Container>

      <AddSurahDrawer
        opened={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        excludeSurahNumbers={rows.map((r) => r.surahNumber)}
        onSubmit={handleAddSurah}
      />

      <BottomNav
        activeItemId="profile"
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

- [ ] **Step 2: Regenerate routes + lint**

```bash
npm run dev:web   # let routeTree regenerate, then Ctrl+C
npm run lint
```

Expected: passes.

- [ ] **Step 3: Commit**

```bash
git add src/routes/_protected/staff/students/\$studentId.tsx src/routeTree.gen.ts
git commit -m "Add /staff/students/\$studentId grading route"
```

---

### Task 18: Profile staff link

Adds the `إدارة الطلاب` link on `/profile`, visible only to staff. Located near the existing role badges section.

**Files:**
- Modify: `src/routes/_protected/profile.tsx`

- [ ] **Step 1: Read the current profile route to find the insertion point**

```bash
sed -n '60,150p' src/routes/_protected/profile.tsx
```

Identify the closing `</Paper>` of the main profile card. The link will sit just before that closing tag, inside the same `<Stack>`.

- [ ] **Step 2: Add the imports**

At the top of `src/routes/_protected/profile.tsx`, add `Anchor` and `Link` to the existing imports:

```ts
// add to existing @mantine/core import:
Anchor,
// new import:
import { Link } from '@tanstack/react-router'
```

- [ ] **Step 3: Add the link**

Inside the main `<Stack>` of the profile card, just after the `<SimpleGrid>` of `profileFields`, append:

```tsx
{(currentUser.isAdmin || currentUser.isTeacher) ? (
  <Anchor component={Link} to="/staff/students" fw={700}>
    إدارة الطلاب
  </Anchor>
) : null}
```

- [ ] **Step 4: Lint**

```bash
npm run lint
```

Expected: passes.

- [ ] **Step 5: Commit**

```bash
git add src/routes/_protected/profile.tsx
git commit -m "Add staff link on profile page"
```

---

## Phase 5 — End-to-end manual verification

This phase is not a code task — it is the final acceptance gate before opening a PR.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

This boots Convex + Vite concurrently. Wait for both to settle.

- [ ] **Step 2: Verify as a student**

Sign in as a non-staff user (or, if no student account exists, ask the user to create one or borrow an admin account temporarily and demote it). Then:

1. Open `/`. The bottom nav shows `الرئيسية / حفظي / الملف الشخصي`. The middle slot is no longer disabled.
2. Tap `حفظي`. The `/surahs` page renders, showing either rows (if any exist) or the Arabic empty state.
3. Open `/profile`. There is no `إدارة الطلاب` link (because the user isn't staff).

- [ ] **Step 3: Verify as a teacher / admin**

Sign in as an admin (or teacher). Then:

1. Open `/profile`. The `إدارة الطلاب` link appears.
2. Click it → land on `/staff/students`. The student list shows everyone with the `student` role, sorted by Arabic name.
3. Click a student → land on `/staff/students/$studentId`. The page shows the student's name and any existing grades.
4. Tap "إضافة سورة" → drawer opens with a search box and the 114 surahs (minus any already on the list). Search "مر" → filters to "مريم" and others. Pick "الكهف", choose "حفظ متقن", press "حفظ" → drawer closes, the row appears in the list.
5. Click the `chip` for that row, change to "يحتاج مراجعة" → the badge color in the row updates after the mutation resolves.
6. Sign out, sign in as the student → the `/surahs` page shows the just-set grade.

- [ ] **Step 4: Verify forbidden paths**

- As a non-staff user, manually navigate to `/staff/students` → redirected to `/`.
- As a non-staff user, attempt to read another student's grades by hand-crafting the URL → the route guard at `_protected/staff/route.tsx` redirects, so this isn't reachable from the UI. (Backend authz is also enforced via `requireSelfOrStaffAuthUser`.)

- [ ] **Step 5: Stop the dev server**

Ctrl+C the running `npm run dev`.

- [ ] **Step 6: Open a PR**

```bash
git push -u origin feat/surah-memorization-grades
gh pr create --base develop --title "feat: surah memorization grades v1" --body "$(cat <<'EOF'
## Summary
- New Convex table `studentSurahGrades` plus query/mutation surface authorized via `requireStaffAuthUser` / `requireSelfOrStaffAuthUser`.
- Student-facing `/surahs` route — read-only list of memorized surahs with current grades.
- Staff-facing `/staff/students` and `/staff/students/$studentId` routes — student picker plus per-student grading with `AddSurahDrawer`.
- Bottom-nav `Lessons` slot is wired to `/surahs`; profile page surfaces a staff link to `/staff/students`.

Design doc: docs/plans/2026-04-28-surah-memorization-grades-design.md

## Test plan
- [ ] Sign in as student → `/surahs` shows own list (read-only).
- [ ] Sign in as staff → `/profile` shows `إدارة الطلاب`; click → student list.
- [ ] From student detail, add a surah via the drawer; grade chip changes update via `setGrade`.
- [ ] Non-staff cannot reach `/staff/*` (redirect to `/`).
- [ ] Run `npm run lint` and `npm run build` locally before merging.
EOF
)"
```

---

## Out of scope (deferred per design doc)

- Activity log / grade history.
- Notes / comments per surah.
- `firstMemorizedAt` field (recoverable from activity log later).
- Class hierarchy and teacher-student assignment.
- "Review queue" filter, non-numeric sort, or stats summary card.
- Optimistic mutation updates.
- Staff hub page.
