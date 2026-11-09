> Historical report: this describes the pre-migration backend. Current SQL implementation and verification are in [migration-report-2026-10-13.md](migration-report-2026-10-13.md).

# Local test report — October 13, 2026

The app runs at http://localhost:3000 using the existing Convex development
deployment, `lovely-alligator-11`. The frontend development server was left
running after testing. This is a local frontend connected to a cloud dev backend.

## Checks passed

- Production client/SSR build and TypeScript checks: `npm run build`.
- TypeScript and ESLint: `npm run lint`.
- `git diff --check`.
- Unauthenticated visits to the home page redirect to login.
- Teacher and student username/password login, profile, navigation, and logout.
- Teacher opens the student list and creates a student through the app.
- Teacher adds Al-Fatihah with a grade; the student sees the saved grade.
- Teacher assigns a review with an October 14 due date; the student sees it.
- Teacher closes the review with a different grade; the saved grade changes.
- Teacher adds and edits a note; student sees the note without editing controls.
- Student visits to staff pages redirect home.
- Student surahs page at 390 × 844: RTL, no horizontal overflow.
- Password-reset form rejects short passwords and mismatched confirmation.
- Admin issues a reset code, signed-out user redeems it, and student logs in afterward.
- Ten API checks passed: students cannot list students, create accounts, change
  grades, or read another student's notes; teachers can list students but cannot
  create admins; duplicate open reviews are rejected; anonymous users cannot
  create accounts; consumed reset codes cannot be reused; public signup stays disabled.
- Final student surahs and admin reset pages have no browser console errors.

## Fixes made during testing

1. `convex/surahGrades.ts`: the teacher student list used Better Auth's admin-only
   list-users endpoint and returned HTTP 500. It now reads the auth component
   through the backend after the app's staff check, retaining student-role and
   active-account filtering.
2. `convex/auth/admin.ts`: student creation passed the teacher session to an
   admin-only endpoint. It now calls the server-side account creation API after
   `requireStaffAuthUser`, with the new user's role fixed to student. Browser
   access to admin creation remains restricted.
3. `src/router.tsx`: removed `expectAuth: true`, which paused the Convex client
   indefinitely on the signed-out password-reset page. Backend authorization
   remains enforced and was checked with student, teacher, and anonymous clients.
4. `src/routes/__root.tsx`: moved MantineProvider inside the HTML document body,
   resolving React errors about style elements outside the document.
5. CSS imports in BottomNav, CourseCard, and TipCard now satisfy lint import order.

The Convex fixes were pushed to the development deployment. Source changes are
uncommitted. Existing local work was retained.

## Test accounts and data

Dedicated development accounts were created:

| Role | Username |
| --- | --- |
| Admin | `qa.admin.oct13` |
| Teacher | `qa.teacher.oct13` |
| Student | `qa.student.oct13` |

The test student retains an Al-Fatihah grade, teacher note, and an open review
assignment for further manual testing. Existing users' passwords were not changed.
Test passwords were provided in the chat rather than saved in this report.

## Remaining limitations

- Home progress, courses, and lesson summaries still use fixture data.
- The production build warns about a client chunk exceeding 500 KB.
- An initial login request encountered a transient local auth-proxy fetch error;
  retries and subsequent login/reset requests succeeded.
- One early rejected admin-create API call emitted a Convex warning about an
  unawaited operation in the existing parallel authorization/auth-setup code.
  A later run of the same permission check passed without that warning.
- This was a browser and API smoke test, not a complete automated regression
  suite. Note deletion, review cancellation, account bans, load testing, and
  production deployment were not exercised.

Browser snapshots are in `/tmp/quran-zk-browser-results/run-2026-10-13`.
The mobile screenshot is `/tmp/quran-zk-student-mobile.png`.
Final build/lint logs are `/tmp/quran-zk-final-build.log` and
`/tmp/quran-zk-final-lint.log`.

Restart the local frontend with `npm run dev:web`. The full `npm run dev` command
also pushes and watches the development backend.

The server-side account creation behavior was checked against the installed
Better Auth implementation and its [admin plugin documentation](https://better-auth.com/docs/plugins/admin).
