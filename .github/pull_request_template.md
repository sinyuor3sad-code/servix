<!--
PR title must follow Conventional Commits, e.g.:
  feat(booking): support Mada wallets
  fix(api): retry failed Moyasar webhooks
  security(auth): rotate refresh tokens on logout
The PR title becomes the squash-merge commit and feeds the changelog.
-->

## Summary
<!-- 1–3 bullets: what changed and *why*. Skip what the diff already shows. -->
-
-

## Type of change
- [ ] feat — user-visible new behavior
- [ ] fix — bug fix
- [ ] perf — performance improvement
- [ ] refactor — internal restructure, no behavior change
- [ ] security — security hardening / vuln fix
- [ ] docs / test / build / ci / chore

## Test plan
<!-- Concrete steps an owner can run to verify this works. -->
- [ ]
- [ ]

## Risk / rollout
<!-- Anything special: migration order, feature flag, env-var change, manual step? -->
-

## Checklist
- [ ] Tests added or updated where the change is testable
- [ ] No `console.log` / debug code left in
- [ ] Migrations are reversible OR have a documented rollback
- [ ] No secrets in code, env files, or test fixtures
- [ ] `pnpm lint` and `pnpm --filter @servix/api type-check` pass locally
