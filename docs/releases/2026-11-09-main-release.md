# Main-only production release

## Scope

Promote the reviewed PostgreSQL/Drizzle/Better Auth application through assessment feedback (PR #33) from `develop` to `main`. Retain Workers Free and Neon Free, the existing production Worker/database/Hyperdrive/domain/auth secret, local development and isolated CI tests. Future feature PRs target `main`; there is no permanent `develop` or hosted development environment.

## Release preparation

- Release PR #34 targets `main` from `develop` and includes the production-only configuration cleanup.
- Cloudflare's Git build connection on `quran-zk` was disconnected on November 9, 2026. The dashboard now offers **Connect**, so an independent build cannot publish ahead of migrations. The current deployment was not changed by this operation.
- GitHub environment `production` was created with a deployment branch policy permitting only `main`.
- Production secrets are supplied privately by the operator: `DATABASE_URL` (direct Neon), `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`. Their values are never read or logged by this work.
- The Workflow validates those secret names before opening a production connection. Manual dispatch from any ref other than `main` cannot run the production job.
- The active production public health check passed before release. This verifies anonymous endpoints/redirects, not the pending new features.

## Deployment sequence

1. Finish release PR review and CI, and configure all three production secret names.
2. Merge the release into `main`; do not squash away the release ancestry if retiring `develop` immediately afterward. A merge commit preserves the reviewed branch history.
3. Follow the push-to-main workflow: CI, pending migrations `0000`–`0005`, Worker deployment and public health checks. No remote seed runs. A migration failure stops deployment.
4. Verify the deployed revision and public endpoint checks. Publish the first main release as `v0.1.0` only after deployment succeeds.
5. Only then delete remote `develop`, the `quran-zk-dev` Worker, its dedicated Hyperdrive `d428e5b5be924fa9bb143d379c38a94d`, and Neon development branch `br-restless-poetry-baiuk2qp` in project `spring-smoke-00759083`. Check dependencies and identity immediately before deletion. Retain production resources. Deleting the database branch discards that development branch's data.
6. Retarget local checkouts to `main` while preserving uncommitted UI/Storybook work. Remove the retired local branch only after its commits are reachable from `main`. Short-lived feature branches remain the PR workflow.

## Failure handling

Do not remove hosted development resources or `develop` if production release/migration/deployment has not completed successfully. Do not disable the new migration ordering to make a deployment succeed. Fix the failed stage and rerun the workflow from `main`. Already applied migrations are tracked; never rewrite hosted migration history or run development seeds remotely.

The included migrations are additive. A failed Worker deployment may leave a successfully migrated database ahead of the running application; diagnose/retry the deployment. Code rollback does not automatically reverse database migrations. No destructive down migration is part of this release.

## Validation

The consolidation changes pass 253 integration tests, including production URL isolation and password-recovery transactions, TypeScript/ESLint and the production build. The preceding application release passes all 53 browser scenarios; PR #34 runs full CI again on the combined release. Historical hosted reports remain historical and do not establish the deployment status of this release.
