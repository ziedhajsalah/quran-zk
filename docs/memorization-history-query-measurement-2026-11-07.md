# Memorization history query measurement — 2026-11-07

## Decision

Defer a new production index for the current early-development, low-traffic workload. The review is correct: the existing student/status/due-date index cannot supply closure ordering. These local measurements show sorting is presently inexpensive at the tested sizes, and a closure-order index alone does not make the existing late-page OR cursor a bounded range scan. This is evidence for deferring a migration, not a claim about hosted response times or future scalability.

## Reproduction and safety

Run `npx tsx scripts/benchmark-memorization-history.ts` after applying committed migrations to local `quran_test`. An explicit `TEST_DATABASE_URL` may select another local database ending in `_test`; hosted URLs and other database names are rejected. The script does not load env files, seed/truncate application tables, or read hosted data. All fixture rows and the candidate index live in a connection-local temporary table inside a rolled-back transaction. Application data and permanent indexes are untouched.

The temporary table copies the assignment schema, checks and existing indexes using `LIKE ... INCLUDING ALL` (foreign keys are not copied). Fixtures contain 100, 1,000 or 10,000 terminal records for one target student, plus 9,900 records for 99 other students. Each history has 90% completed and 10% cancelled work, UUID-shaped IDs and tied closure timestamps. There are no open assignments in this synthetic fixture. `ANALYZE` runs after loading each size. The benchmark uses the service projection, status predicates, closure/ID order, OR cursor and 21-row lookahead. The late cursor starts 90% into the target student's complete history; a filtered late page can return fewer than 21 records.

Measured on local ARM64 PostgreSQL 17, with one warm-up followed by seven `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)` samples per query; the table below reports median SQL execution time. These are warm-cache, single-connection, temporary-table measurements. They exclude query planning, auth, network, Hyperdrive, Neon cold starts and application serialization. They do not establish hosted latency or a service-level guarantee. JSON output includes scan nodes, removed rows, sort presence, local buffer hits and candidate index size for further comparison. No planner settings are forced.

Candidate (temporary only):

```sql
CREATE INDEX memorization_history_candidate_idx
ON memorization_history_bench (student_id, closed_at DESC, id DESC)
WHERE status IN ('closed', 'cancelled');
```

## Results

| History rows for target | Filter | Page | Existing indexes (ms) | With candidate (ms) |
| ---: | --- | --- | ---: | ---: |
| 100 | all | first | 0.027 | 0.009 |
| 100 | all | late | 0.019 | 0.011 |
| 100 | closed | first | 0.026 | 0.008 |
| 100 | closed | late | 0.014 | 0.008 |
| 100 | cancelled | first | 0.008 | 0.006 |
| 100 | cancelled | late | 0.006 | 0.005 |
| 1,000 | all | first | 0.125 | 0.006 |
| 1,000 | all | late | 0.059 | 0.025 |
| 1,000 | closed | first | 0.125 | 0.007 |
| 1,000 | closed | late | 0.063 | 0.024 |
| 1,000 | cancelled | first | 0.021 | 0.016 |
| 1,000 | cancelled | late | 0.013 | 0.013 |
| 10,000 | all | first | 1.727 | 0.006 |
| 10,000 | all | late | 0.553 | 0.462 |
| 10,000 | closed | first | 1.096 | 0.006 |
| 10,000 | closed | late | 0.581 | 0.496 |
| 10,000 | cancelled | first | 0.141 | 0.014 |
| 10,000 | cancelled | late | 0.075 | 0.079 |

With existing indexes, the first `all` page reads and sorts all 100 / 1,000 / 10,000 matching rows. At 10,000 target rows, the planner chooses a sequential scan over the 19,900-row temporary table for that first page. Other cases use the existing due-date index plus filtering/sorting.

The candidate serves the first `all` page with 21 index rows and no sort. However, at 10,000 target rows its late `all` page still removes 9,001 earlier entries before returning 21 rows because of the OR cursor predicate. Its root local-buffer hits rise from 4 for the first page to 398 for that late page. For small/filtered late pages, PostgreSQL can still choose bitmap scans plus sorting, or the original due-date index. Therefore the candidate does not remove every sort or guarantee fixed work per page.

The candidate occupies 864 KiB, 928 KiB and 1,600 KiB across the three full fixture tables (10,000 / 10,900 / 19,900 total records). A permanent equivalent would also add storage and maintenance for each terminal assignment; write throughput and storage growth were not benchmarked. No paid service or hosting-plan change is introduced.

## When to revisit

Re-measure if observed database query latency or per-student history growth makes this query material to actual usage. Compare the existing OR predicate with a tuple range `(closed_at, id) < (cursor_time, cursor_id)` and a matching partial closure-order index; measure both `all` and selective status filters before choosing an index layout. The terminal-row constraint guarantees non-null closure dates, making that comparison feasible. Any production change still requires a reviewed Drizzle migration and pagination regression tests. No production/hosted data was inspected for this decision.
