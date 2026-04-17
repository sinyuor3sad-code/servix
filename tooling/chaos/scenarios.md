# Chaos Engineering Scenarios

SERVIX has two layers of chaos testing. This catalogue documents **expected
graceful-degradation behaviour** so future refactors don't silently remove
resilience.

| Layer | Where | When | Purpose |
|-------|-------|------|---------|
| **Application chaos** | `apps/api/test/chaos/*.chaos-spec.ts` | Every PR (CI job `chaos`) | Mock a dependency to throw, assert the caller still serves a sensible response. No network or Docker required — runs in ~1s per spec. |
| **Infrastructure chaos** | `tooling/chaos-tests/*.sh` | Monthly on staging (manual) | Kill real Redis/Postgres/API containers, measure recovery. Requires a live staging environment. |

This file is about the **application** layer. For infrastructure drills see
[`tooling/chaos-tests/`](../chaos-tests/).

---

## Design principle

> A failure in a **non-critical** dependency must degrade gracefully.
> A failure in a **critical** dependency is allowed to fail the request.

| Dependency | Critical? | On failure |
|------------|-----------|------------|
| **Platform Postgres** | ✅ yes | Request fails (5xx) |
| **Tenant Postgres** | ✅ yes | Tenant's request fails, other tenants unaffected |
| **Redis cache** | ❌ no | Miss path — re-query DB, request succeeds (slower) |
| **Redis rate-limit state** | ❌ no | Fail open — allow the request |
| **Redis refresh-token blacklist** | ❌ no | Fall through to `token_blacklist` table in platform DB |
| **BullMQ queue** | ❌ no (for async fanout) | Log + swallow; notification is retried or lost (TODO: dead-letter) |
| **WhatsApp/SMS provider** | ❌ no (for async sends) | Queue retries; user-triggered sends surface the error |
| **Vault (kms)** | ✅ yes | Tenant-encrypted fields unreadable — request fails |

---

## Scenarios

### 1. Redis connection error — cache reads

**Failure:** `redis.get()` throws (connection refused, timeout).

**Expected behaviour:**
- `CacheService.getTenant()` returns `null` (miss, no throw)
- `CacheService.getSettings()` returns `null` (miss, no throw)
- Caller re-queries the database and populates cache on recovery

**Covered by:** `cache-redis-down.chaos-spec.ts`

**Regression risk:** If the try/catch in `cache.service.ts` is removed, one
Redis blip would cause every tenant-middleware invocation to 500.

---

### 2. Redis connection error — rate limiting

**Failure:** `redis.incr()` throws during login-fail accounting.

**Expected behaviour:**
- `checkLoginIpBlock()` returns `0` (not blocked — fail open)
- `incrementLoginFailIp()` returns `{count:0, blockSeconds:0}` (no block recorded)
- `isAccountLocked()` returns `false`

**Why fail-open:** locking legit users out because the rate-limiter itself is
broken is worse than letting a few extra password attempts through — attackers
still have to guess the password, and alerting will catch a Redis outage
independently.

**Covered by:** `cache-redis-down.chaos-spec.ts`

---

### 3. Redis down — refresh-token blacklist

**Failure:** `redis.get()` throws when checking if a logout-ed token is blacklisted.

**Expected behaviour:**
- `isRefreshTokenBlacklisted()` falls through to `PlatformPrismaClient.tokenBlacklist.findUnique()`
- If DB has an entry, returns `true` (token rejected)
- If DB is also unreachable, fails **open** (`false`) — a brief auth outage is
  worse than a rotated token being reused for a few seconds

**Covered by:** `cache-redis-down.chaos-spec.ts`

**Why this pattern:** dual-write (Redis fast path + DB durable fallback) is the
right shape for security-critical state where Redis is a cache, not the source
of truth.

---

### 4. SMS provider unreachable (async notification)

**Failure:** `SmsService.send()` throws (Unifonic 500, network timeout).

**Expected behaviour (inside BullMQ processor):**
- Processor re-throws → BullMQ retries with backoff (BullMQ default: 3 attempts)
- After max retries, job moves to failed state; does NOT block other jobs
- Appointment / invoice creation succeeded before — user is not affected

**Expected behaviour (user-triggered `POST /invoices/:id/send` with `channel=sms`):**
- Error surfaces to the user with a clear message — user chose SMS, they need to know it failed

**Covered by:** `sms-provider-down.chaos-spec.ts` (async processor retry semantics)

**Not covered yet:** dead-letter handling. Failed jobs sit in the `failed` set
indefinitely. TODO: wire a DLQ reaper or alerting.

---

### 5. WhatsApp provider unreachable

Same shape as SMS. User-triggered send returns a useful error; async queued
sends retry via BullMQ.

**Covered by:** `sms-provider-down.chaos-spec.ts` exercises the same pattern
generically through `NotificationProcessor`.

---

## Future scenarios (gaps)

These are real gaps in the current design — documented so we don't forget:

1. **Read-replica failover** — no read-replica client exists yet. When added,
   we need a chaos test that kills the replica and asserts reads fall back to
   primary.
2. **Prisma connection-pool exhaustion** — simulate 100 concurrent slow queries,
   assert the 101st returns a clean 5xx (not a hang).
3. **Vault/KMS unavailable** — decrypting encrypted fields (PII) should return
   a structured error, not crash. Chaos test would mock `EncryptionService` to
   throw and hit a route that decrypts.
4. **BullMQ dead-letter** — failed jobs need a reaper or alert; right now they
   pile up in `failed`.

---

## Running

```bash
# Application chaos — runs in CI, also locally
pnpm --filter @servix/api test:chaos

# Infrastructure chaos — staging only, requires docker-compose.staging.yml running
bash tooling/chaos-tests/chaos.sh
```
