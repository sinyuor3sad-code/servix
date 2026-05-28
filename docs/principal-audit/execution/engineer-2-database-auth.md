# Engineer 2 — Database & Identity Engineer

**التخصص:** Database Engineering (Prisma + PostgreSQL multi-DB) + Auth/Identity (NestJS + Passport + JWT)
**النموذج:** Claude (Opus 4.7 موصى — schema changes + auth logic حساسة)
**المراحل المسؤول عنها:** E1 + E2
**إجمالي الساعات التقريبي:** ~212 ساعة (≈ 5-6 أسابيع full-time)
**المصدر:** `docs/principal-audit/synthesis-2026-05-14.md`

---

## 🎯 نطاقك الشامل

| المرحلة | النطاق | عدد المهام | الأولوية |
|---|---|---|---|
| **E1** | Database & Schema (Prisma migrations + multi-DB) | 14 (0 P0 + 3 P1 + 1 P2 + 10 P3) | يبدأ بعد E8 backups |
| **E2** | Identity & Access (Auth, JWT, OAuth, WS auth) | 16 (1 P0 + 7 P1 + 7 P2 + 1 P3) | يبدأ مع E1 P1 (encryption columns) |

**أنت لست مسؤولاً عن:**
- ❌ Infrastructure (Docker, K8s, Terraform) — Engineer 1
- ❌ AppSec (uploads, webhooks, CSP, admin DTOs) — Engineer 3
- ❌ Payment/ZATCA/PDPL business logic — Engineer 4

---

## 🛠️ Claude Code Skills التي يجب أن تستخدمها

### إلزامية (استخدمها بداية الجلسة)

#### `/init`
**متى:** أول جلسة عمل لك على المشروع.
**لماذا:** يولّد/يحدّث `CLAUDE.md` بسياق المشروع — Prisma multi-DB structure + Auth flow conventions. هذا حرج لمنع أخطاء على tenant DB-per-tenant.
**الاستخدام:** `/init` بعد قراءة هذا الملف.

#### `/security-review`
**متى:** قبل push كل PR متعلق بـ:
- Auth flow (login, refresh, password reset, 2FA)
- WebSocket gateway changes (V-01)
- Encryption columns / token hashing
- RBAC / Guard changes
**لماذا:** Auth حرج. خطأ صغير في refresh token rotation أو JWT validation = takeover.
**الاستخدام:** `/security-review` بعد إكمال كل V-card قبل push.

#### `/review`
**متى:** قبل فتح PR على main.
**لماذا:** مراجعة شاملة + يكشف issues قبل human reviewer.

### مفيدة (استدعِ عند الحاجة)

#### `/simplify`
**متى:** بعد إكمال V-13 (OAuth + Math.random + refresh rotation) — auth.service.ts ينمو سريعاً، يحتاج تبسيط.
**لماذا:** يفحص التغييرات للـ DRY/duplication/dead code.
**الاستخدام:** `/simplify` على apps/api/src/auth/ بعد كل دفعة كبرى.

---

## 📋 السياق المشترك (الصق في أول جلسة جديدة)

```
أنت Database Engineer + Auth Engineer لمشروع Servix.

المسار: /Users/sinyuor3sad/projects/servix

Stack الرئيسي:
- Prisma 5+ مع multi-DB (platform DB + DB-per-tenant)
- PostgreSQL 17.9
- NestJS 10+ + Passport JWT + bcrypt
- Google OAuth + 2FA TOTP
- Socket.IO (WebSocket gateway)
- Redis للـ cache + session state

التقارير المرجعية:
- docs/principal-audit/synthesis-2026-05-14.md (1624 سطر)
- (E2 من ملف الخطة الشامل)

الـ findings الخاصة بك:
- E1: 14 finding (V-17, V-18, V-23, V-34, V-44, V-45, V-46, V-73, V-74, V-75, V-76, V-77, V-78, V-79, V-88)
- E2: 16 finding (V-01, V-13, V-14, V-24, V-25, V-30, V-35, V-37, V-38, V-39, V-40, V-41, V-42, V-43, V-60, V-123, V-124)

⚠️ قواعد إلزامية:
1. لا تلمس tooling/** أو infra files — Engineer 1
2. لا تلمس uploads/admin/webhooks/CSP — Engineer 3
3. لا تلمس invoices/payments/ZATCA/PDPL — Engineer 4
4. كل schema migration تختبر up + down على staging أولاً
5. CREATE INDEX دائماً CONCURRENTLY على prod
6. كل auth change له e2e test جديد
7. /security-review قبل push كل auth/WS change
8. commits: card per commit بصياغة `feat(db|auth): V-NNN — وصف`

⚠️ تعقيدات multi-DB:
- platform.prisma: يحوي tenants, users, subscriptions, audit logs
- tenant.prisma: schema يُطبَّق على N من tenant DBs
- أي ALTER TABLE على tenant.prisma يحتاج loop على كل tenant DBs (script: tooling/scripts/migrate-all-tenants.sh — تحقّق من وجوده)
- backfill scripts تتطلب نفس الـ loop
```

---

## 🗺️ التنسيق الإلزامي مع المهندسين الآخرين

| التداخل | المهندس الآخر | كيف نتنسّق |
|---|---|---|
| `postgresql.conf` statement_timeout (V-16) | **Engineer 1** | Engineer 1 يطبّق على prod، أنت تستلم القيم لـ schema config |
| `env.validation.ts` + `jwt.config.ts` (V-30) | **Engineer 1** | Engineer 1 يكتب validation rules، أنت تتحقّق من call sites في auth.service |
| Encryption columns (V-23) | **Engineer 4** | E1 ينشئ الأعمدة، Engineer 4 يكتب backfill scripts للـ TOTP/WhatsApp/ZATCA |
| Cascade redesign (V-17) → soft-delete | **Engineer 4** | E1 يضيف deletedAt، Engineer 4 يطبّق Prisma middleware في invoices.service |
| Client.phone @unique (V-74) | **Engineer 3 (E4)** | E1 يضيف unique، Engineer 3 يستخدم upsert by phone في booking |
| WS Auth (V-01) | **Engineer 3** | Engineer 2 يبني JWT-based auth (E2)، Engineer 3 يضيف namespaces (V-102) لاحقاً |
| Audit outbox table (V-35) | **Engineer 4** | E2 ينشئ الجدول والـ worker، Engineer 4 يستخدمه لـ PDPL audit |

---

# 🅐 المرحلة E1 — Database & Schema

## السياق المشترك (الصق في الجلسة الجديدة)
أنت Database Engineer مختص في Prisma + PostgreSQL لمشروع Servix.
المسار: /Users/sinyuor3sad/projects/servix
Stack: Prisma 5+ + PostgreSQL 17.9 + multi-DB (platform + DB-per-tenant)

## نطاق هذه المرحلة (Files in Scope)
- `apps/api/prisma/schema/platform.prisma`
- `apps/api/prisma/schema/tenant.prisma`
- `apps/api/prisma/migrations/**` (إنشاء migrations جديدة)
- `apps/api/src/shared/encryption/encryption.service.ts` (تأكيد api للـ AES-256-GCM، **لا تغيير منطق**)
- `tooling/postgres/postgresql.conf` (V-16 statement_timeout — تنسيق مع Engineer 1)

## خارج النطاق (NOT in Scope)
- ❌ business logic في *.service.ts — تخص Engineer 3/4
- ❌ Auth/JWT — يخص E2 (نفسك لكن في مرحلة لاحقة)
- ❌ Encryption call sites — تخص Engineer 4 (K1/K2 backfills)
- ❌ Service-level Decimal refactor (V-34 logic) — Engineer 4

## قواعد البيانات الحرجة
- ❗ **Multi-DB:** كل migration يحدد target (platform أم tenant)
- ❗ **DB-per-tenant:** ALTER TABLE على tenant.prisma يُطبَّق على N من tenant DBs
- ❗ **Production data:** اختبر migrations على copy من prod أولاً

## المهام (مرتبة بالأولوية)

### المهمة 1: FK indices المفقودة (V-18)
- **Finding ID**: V-18 / A1-006
- **Severity**: HIGH (P1)
- **الملفات**: `tenant.prisma` + `platform.prisma`
- **التطبيق**:
  1. أضف `@@index([serviceId])`, `@@index([employeeId])` على AppointmentService, InvoiceItem, LoyaltyTransaction, ClientDebt
  2. على platform.prisma: Subscription.(planId), PlatformInvoice.(subscriptionId)
  3. `pnpm prisma migrate dev --name add_fk_indices`
  4. **مهم**: عدّل migration SQL ليستخدم `CREATE INDEX CONCURRENTLY`
  5. وثّق ضرورة `prisma migrate deploy` بـ flag مناسب
- **التحقق**:
  - `\d` يظهر indices
  - `EXPLAIN ANALYZE` يستخدم Index Scan
- **مدة متوقعة**: 6 ساعات
- **بعد الإكمال**: `/security-review` (تحقق من absence of index drops)

---

### المهمة 2: Cascade redesign + Soft-delete (V-17 + V-73)
- **Finding IDs**: V-17 / A1-003 + V-73 / A1-010 (مدموجان)
- **Severity**: HIGH (P1)
- **التطبيق**:
  1. تغيير `onDelete: Cascade` → `onDelete: Restrict` على Payment, Discount, LoyaltyTransaction, ClientDebt, EmployeeDebt
  2. إضافة soft-delete: `deletedAt DateTime? @map("deleted_at")` على Invoice + Payment
  3. partial index: `@@index([clientId, deletedAt])`
  4. DB trigger يمنع DELETE على cleared ZATCA invoices:
     ```sql
     CREATE OR REPLACE FUNCTION prevent_zatca_invoice_delete()
     RETURNS TRIGGER AS $$
     BEGIN
       IF OLD.zatca_status = 'cleared' THEN
         RAISE EXCEPTION 'Cannot delete ZATCA-cleared invoice (legal requirement 6 years)';
       END IF;
       RETURN OLD;
     END;
     $$ LANGUAGE plpgsql;
     CREATE TRIGGER no_delete_cleared_invoices BEFORE DELETE ON invoices
     FOR EACH ROW EXECUTE FUNCTION prevent_zatca_invoice_delete();
     ```
  5. **أبلغ Engineer 4** بضرورة Prisma middleware لتحويل `delete()` → `update({deletedAt})` في invoices.service
- **التحقق**:
  - `\d+ invoices` يظهر `deleted_at`
  - DELETE مع `zatca_status='cleared'` → exception
- **مدة متوقعة**: 8 ساعات

---

### المهمة 3: Encryption columns لـ V-23
- **Finding ID**: V-23 / A1-002
- **Severity**: HIGH (P1)
- **التطبيق**:
  1. أضف encrypted variants:
     ```prisma
     model User {
       twoFactorSecret_OLD String? @map("two_factor_secret")
       twoFactorSecretEncrypted Bytes? @map("two_factor_secret_encrypted")
     }
     model WhatsAppInstance {
       instanceTokenEncrypted Bytes? @map("instance_token_encrypted")
     }
     model ZatcaCertificate {
       privateKeyEncrypted Bytes @map("private_key_encrypted")
     }
     ```
  2. Migration يضيف الأعمدة الجديدة (لا يحذف القديمة)
  3. وثّق phases في `docs/migrations/v23-encryption-rollout.md`:
     - Phase 1 (هذه المرحلة): إضافة encrypted columns
     - Phase 2 (Engineer 4 K1/K2): backfill scripts
     - Phase 3 (Cleanup migration بعد 30 يوم): drop plaintext
- **التحقق**: `\d users` يظهر `two_factor_secret_encrypted bytea` + migration up + down يعملان
- **مدة متوقعة**: 6 ساعات

---

### المهمة 4: statement_timeout في postgresql.conf (V-16) — ✅ verified 2026-05-19

- **Finding ID**: V-16 / A1-007 (= A8-002 + A8-011 طبّقها Engineer 1 على prod)
- **Severity**: HIGH (P1) — **CLOSED بـ verification، لا حاجة لتعديل Engineer 2**
- **الملف**: `tooling/postgres/postgresql.conf` (نطاق Engineer 1، Engineer 2 يتحقّق فقط)

#### Verification status (2026-05-19)

| Setting | file value | prod live | required | match |
|---|---|---|---|---|
| `statement_timeout` | `30s` | `30000 ms` | `30s` | ✅ |
| `idle_in_transaction_session_timeout` | `60s` | `60000 ms` | `60s` | ✅ |
| `lock_timeout` | `5s` | `5000 ms` | `5s` | ✅ |
| `log_connections` | `on` | `on` | `on` | ✅ |
| `log_disconnections` | `on` | `on` | `on` | ✅ |
| `log_min_duration_statement` | `500` | `500 ms` | `500` | ✅ |

#### Provenance

- **A8-002 (2026-05-16, Engineer 1):** applied 3 timeouts via `ALTER SYSTEM` + persisted in `tooling/postgres/postgresql.conf`.
- **A8-011 (Engineer 1):** added the 3 logging settings in the same file, replaces placeholder `off` lines.

#### Resilience note

5 of 6 settings show `source=postgresql.auto.conf` (the file `ALTER SYSTEM` writes). The 6th shows `source=/etc/postgresql/postgresql.conf` (mounted from `tooling/`). Both files carry identical values, so a rebuild that loses `postgresql.auto.conf` still inherits the policy from `postgresql.conf` — exactly the resilience V-16 was scoped to ensure.

#### Out of scope (related but not V-16)

`A8-IV-014` — broader prod-vs-git drift on infra config (compose, postgresql.conf, nginx). Engineer 1 owns, tracked separately.

---

### المهمة 5: Decimal widening + math hygiene (V-34 schema + V-44)
- **Finding IDs**: V-34 (schema partial) + V-44 / A1-012
- **التطبيق**:
  1. V-44: `Client.totalSpent Decimal @db.Decimal(14, 2)` (كان 10,2)
  2. راجع كل Decimal column متراكم (totalRevenue, cumulativeBalance) → ≥ Decimal(14, 2)
  3. ESLint rule محلية `eslint-plugin-servix/rules/no-decimal-to-number.js`:
     ```js
     // يمنع Number(decimalColumn)
     ```
  4. أضف في `apps/api/.eslintrc.cjs`: `'servix/no-decimal-to-number': 'error'`
  - **ملاحظة**: rule يصبح effective عندما Engineer 4 يطبّق Prisma.Decimal في invoices.service
- **مدة متوقعة**: 4 ساعات

---

### المهمة 6: PlatformAuditLog FK Restrict (V-78)
- **Finding ID**: V-78 / A1-008
- **Severity**: HIGH (re-classified up)
- **التطبيق (Option A — موصى)**:
  ```prisma
  model PlatformAuditLog {
    tenantId String?
    tenantSnapshot Json?
    tenant Tenant? @relation(... onDelete: Restrict)
  }
  ```
- **التحقق**: DELETE tenant (test DB) → audit entries تبقى
- **مدة متوقعة**: 4 ساعات

---

### المهمة 7: Client.phone @unique (V-74)
- **Finding ID**: V-74 / A1-011
- **Severity**: MEDIUM (P3 لكنه يفك V-89 في E4)
- **التطبيق**:
  1. dedup script (قبل migration):
     ```sql
     SELECT phone, count(*) FROM clients WHERE phone IS NOT NULL GROUP BY phone HAVING count(*) > 1;
     ```
  2. Migration script لدمج duplicates
  3. ثم: `phone String? @unique` + `@@index([phone])`
  4. **أبلغ Engineer 3** (E4 V-89): booking endpoint يحتاج `upsert by phone`
- **مدة متوقعة**: 6 ساعات

---

### المهام المتبقية (P3 — مختصرة)
- **V-75** (updatedAt على InvoiceFeedback/Referral/SelfOrder): 1h
- **V-76** (composite indices Invoice [clientId,status] / [status,createdAt]): 2h
- **V-79** (VARCHAR → Enum migration على 8 حقول): 6h
- **V-45** (TenantClientFactory.databaseName regex): **سلّمه لـ Engineer 3** (validation logic)
- **V-46** (comment maxlength VarChar(2000)): schema جزء هنا، DTO في Engineer 3
- **V-77** (migration placeholder docs): توثيق فقط
- **V-88** (encryption hash entropy in dev): توثيق فقط

## Pre-conditions
- **Engineer 1 E8 المهمة 1 (Backups) مكتملة** — لا migration بدون backup
- **Engineer 1 E8 المهمة 9 (log_connections) مكتملة** — للـ migration audit trail
- staging environment متاح

## Post-conditions
- كل migration up + down على staging
- `pnpm prisma migrate status` clean
- جميع test suites تنجح
- Engineer 4 لديه clear plan لـ V-23 backfill

## قواعد الجودة الإلزامية
1. ❌ لا تعدّل أي `*.service.ts` — schema فقط
2. ❌ لا تستخدم `CREATE INDEX` بدون `CONCURRENTLY` على prod
3. ❌ لا تحذف column في نفس migration الذي يضيف بديلاً — phase migration دائماً
4. ✅ كل migration: اختبر up → down → up
5. ✅ كل migration: شغّل على staging copy من prod أولاً، قس runtime
6. ✅ commits: `feat(db): V-NNN — وصف` أو `fix(db): V-NNN — وصف`
7. ✅ كل migration يحوي تعليق علوي يشير لـ V-card

## التسليم
```json
{
  "stage": "E1",
  "migrations_created": ["20260515_add_fk_indices", "20260515_cascade_to_restrict_with_softdelete", ...],
  "schema_breaking_changes": ["Payment.onDelete=Restrict", "Invoice softdelete"],
  "v23_rollout_phase": "phase1_complete_columns_added",
  "ready_for_engineer4_backfill": true,
  "lint_status": "clean",
  "test_status": "all schema-level tests pass"
}
```

---

# 🅑 المرحلة E2 — Identity & Access

## السياق المشترك (الصق في الجلسة الجديدة)
أنت Auth/Security Engineer مختص في NestJS + Passport + JWT لمشروع Servix.
المسار: /Users/sinyuor3sad/projects/servix
Stack: NestJS 10+ + Passport JWT + bcrypt + Google OAuth + 2FA TOTP + WebSocket (Socket.IO)

## نطاق هذه المرحلة (Files in Scope)
- `apps/api/src/auth/**` (auth.service.ts, auth.controller.ts, strategies/*.strategy.ts)
- `apps/api/src/shared/events/events.gateway.ts` (V-01)
- `apps/api/src/shared/guards/jwt-auth.guard.ts`, `roles.guard.ts`, `tenant.guard.ts`, `quota.guard.ts`
- `apps/api/src/admin/admin.service.ts` (V-24 reset link hashing)
- `apps/api/src/shared/cache/cache.service.ts` (V-14 setPasswordChangedAt + V-40 — **لا تلمس OTP** [Engineer 3])
- `apps/api/src/shared/audit/**` (V-35 outbox)
- `apps/dashboard/src/store/auth.store.ts` (V-39 cookie migration)
- `apps/api/src/shared/security/rate-limit.guard.ts` (V-124 — حذف dead code)
- `apps/api/test/auth/**`

## خارج النطاق (NOT in Scope)
- ❌ Encryption service implementation (E1)
- ❌ OTP fail-closed (Engineer 3 E4)
- ❌ RateLimit fail-closed (Engineer 3 E5)
- ❌ Prisma schema (E1 — نفسك لكن مرحلة مختلفة)
- ❌ K1/K2 compliance (Engineer 4)
- ❌ uploads.controller.ts (Engineer 3 E5)
- ❌ admin DTOs (Engineer 3 E5 V-53)

## المهام (مرتبة بالأولوية)

### المهمة 1: WebSocket Tenant Auth (V-01) ★★★
- **Finding ID**: V-01 / A2-01 / A5-001 / A5-026 (triple-corroborated)
- **Severity**: CRITICAL (P0 — أعلى أولوية في المرحلة)
- **الملف**: `apps/api/src/shared/events/events.gateway.ts:25-53`
- **التطبيق**:
  1. أنشئ `apps/api/src/shared/events/ws-auth.guard.ts`:
     ```ts
     @Injectable()
     export class WsAuthGuard implements CanActivate {
       constructor(private jwtService: JwtService, private cacheService: CacheService) {}
       async canActivate(ctx: ExecutionContext): Promise<boolean> {
         const client: Socket = ctx.switchToWs().getClient();
         const token = client.handshake.auth?.token || extractBearer(client.handshake.headers.authorization);
         if (!token) throw new WsException('Unauthorized');
         const payload = await this.jwtService.verifyAsync(token);
         const pwChangedAt = await this.cacheService.getPasswordChangedAt(payload.sub);
         if (pwChangedAt && payload.iat * 1000 < pwChangedAt) throw new WsException('Token revoked');
         const tenantUser = await this.tenantUserService.findActive(payload.tenantId, payload.sub);
         if (!tenantUser) throw new WsException('Tenant access denied');
         client.data.user = payload;
         client.data.tenantId = payload.tenantId;
         return true;
       }
     }
     ```
  2. عدّل `events.gateway.ts`:
     - `handleConnection` يستدعي guard manually
     - عند فشل: `client.disconnect(true)` + log
     - استبدل قراءة `client.handshake.query.tenantId` بـ `client.data.tenantId`
  3. **أبلغ Engineer 1** بإضافة rate-limit في nginx لـ `/socket.io`
  4. **V-102 (namespaces)** يخص Engineer 3 — يأتي بعدك كـ defense-in-depth
- **التحقق**:
  - e2e test: open socket بدون token → disconnect خلال 100ms
  - e2e test: spoof `?tenantId=B` لكن JWT لـ tenant A → يستقبل A فقط
  - يدوي: `wscat -c wss://api.servi-x.com/socket.io/?EIO=4` → reject
- **مدة متوقعة**: 12 ساعة
- **بعد الإكمال:** `/security-review` إلزامي

---

### المهمة 2: OAuth Account Takeover (V-13a)
- **Finding ID**: V-13 / A2-03
- **Severity**: HIGH (P1)
- **الملف**: `apps/api/src/auth/strategies/google.strategy.ts` + `auth.service.ts`
- **التطبيق**:
  ```ts
  let user = await prisma.user.findUnique({ where: { googleId: profile.id } });
  if (!user) {
    const existingByEmail = await prisma.user.findUnique({ where: { email: profile.email } });
    if (existingByEmail) {
      throw new UnauthorizedException('Account exists with this email. Sign in with password and link Google manually.');
    }
    user = await prisma.user.create({ data: { email: profile.email, googleId: profile.id, ... } });
  }
  ```
  - أضف endpoint `/auth/link-google` يحتاج auth
- **التحقق**: e2e tests كاملة
- **مدة متوقعة**: 6 ساعات

---

### المهمة 3: OTP Math.random → crypto.randomInt (V-13b)
- **Finding ID**: V-13 / A2-04
- **Severity**: HIGH (P1)
- **التطبيق**:
  ```ts
  import { randomInt } from 'crypto';
  const otp = randomInt(100000, 1000000).toString();
  ```
  - ابحث: `grep -rn 'Math.random' apps/api/src/` — كل security use يتحول
  - lint rule: `no-restricted-syntax` على Math.random في security paths
- **التحقق**: chi-square distribution test على 10K OTPs
- **مدة متوقعة**: 3 ساعات

---

### المهمة 4: Refresh Token Rotation (V-13c)
- **Finding ID**: V-13 / A2-05
- **Severity**: HIGH (P1)
- **التطبيق**:
  1. **تنسيق مع E1**: اطلب schema:
     ```prisma
     model RefreshToken {
       id String @id @default(uuid())
       userId String
       tokenHash String @unique
       expiresAt DateTime
       replacedBy String?
       createdAt DateTime @default(now())
       @@index([userId, expiresAt])
     }
     ```
  2. `/auth/refresh`:
     - تحقق من tokenHash → record
     - **اكتشف reuse**: إن `replacedBy IS NOT NULL` → revoke all user tokens + alert
     - أنشئ refresh جديد، اربط القديم بـ replacedBy
- **التحقق**: e2e: refresh مرتين بنفس token → الثاني = 401 + كل tokens revoked
- **مدة متوقعة**: 10 ساعات
- **بعد الإكمال:** `/security-review` + `/simplify` على auth.service.ts

---

### المهمة 5: Session Invalidation Triad (V-14)
- **Finding ID**: V-14 / A2-02 + A2-06 + A2-07
- **Severity**: HIGH (P1) — 3 PRs منفصلة
- **التطبيق (3 PRs)**:
  1. **V-14a — forceLogout**: `cacheService.setPasswordChangedAt(userId, Date.now())` + JWT validation تتحقق `iat * 1000 < pwChangedAt`
  2. **V-14b — Suspend tenant**: عند suspended → invalidateTenant + setPasswordChangedAt لكل users
  3. **V-14c — Role change**: setPasswordChangedAt + JwtStrategy تعيد قراءة role من DB
- **التحقق**: e2e: login → force logout → نفس token returns 401 خلال <1s
- **مدة متوقعة**: 12 ساعات (4h لكل PR)

---

### المهمة 6: Admin Reset Link Hashing (V-24)
- **Finding ID**: V-24 / A2-08
- **التطبيق**:
  ```ts
  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = createHash('sha256').update(rawToken).digest('hex');
  await prisma.passwordResetToken.create({ data: { userId, tokenHash, expiresAt: addHours(now, 1) } });
  // SEND rawToken via email
  // ❌ احذف console.log(rawToken)
  ```
- **التحقق**: 
  - DB: `SELECT * FROM password_reset_tokens` كلها sha256 hex
  - grep: `grep -rn "console.log.*token" apps/api/src/admin/` → 0
- **مدة متوقعة**: 4 ساعات

---

### المهمة 7: 2FA Verify Lockout (V-25)
- **Finding ID**: V-25 / A2-09
- **التطبيق**: انسخ منطق `/auth/login` إلى `verify2FALogin`: `checkLoginIpBlock` + `isAccountLocked` + قفل بعد 5 فاشلات
- **مدة متوقعة**: 3 ساعات

---

### المهمة 8: Audit Logging Reliability (V-35) — Outbox Pattern
- **Finding ID**: V-35 / A2-18
- **Severity**: HIGH (P1 — يقوّض كل شيء آخر إن مكسور)
- **التطبيق**:
  1. **تنسيق مع E1**: اطلب schema:
     ```prisma
     model AuditOutbox {
       id String @id @default(uuid())
       event Json
       createdAt DateTime @default(now())
       processedAt DateTime?
       @@index([processedAt, createdAt])
     }
     ```
  2. `audit.service.ts`: `logEvent()` يكتب outbox في نفس tx كـ business event
  3. `AuditOutboxWorker` (BullMQ كل 5s): processes pending → AuditLog table
  4. Prometheus metric: `servix_audit_outbox_lag_seconds` + alert على > 60s
  5. **أبلغ Engineer 4** بأن outbox جاهز للـ PDPL audit usage
- **التحقق**:
  - e2e: trigger login → audit_outbox row → <10s → audit_log row
  - chaos test: drop audit_log table → business endpoints تفشل (لا silent loss)
- **مدة متوقعة**: 12 ساعات

---

### المهمة 9: JWT min-length + expiry (V-30)
- **Finding ID**: V-30 / A2-11
- **التطبيق**: ⚠️ **Engineer 1 يطبّق env.validation + jwt.config في E7 المهمة 3**. أنت تتحقّق من call sites — لا fallback `'fallback-secret'` في auth.service.
- **مدة متوقعة**: 1 ساعة (بعد Engineer 1)

---

### المهمة 10: Auth 7 DTOs (V-60)
- **Finding ID**: V-60 / A5-006
- **التطبيق**:
  - 7 DTOs: `LoginDto`, `RegisterDto`, `RefreshDto`, `ForgotPasswordDto`, `ResetPasswordDto`, `Send2faDto`, `Verify2faLoginDto`
  - كل DTO بـ class-validator: @IsEmail, @MinLength, @Matches
  - استبدل `@Body() body: { ... }` بـ `@Body() dto: LoginDto`
  - تأكد من `app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }))`
- **التحقق**: POST بـ extra field → 400; POST بدون email → 400
- **مدة متوقعة**: 6 ساعات

---

### المهام المتبقية (P2/P3 — مختصرة)
- **V-37**: QuotaGuard header — أزل `headers['x-tenant-id']`. 1h
- **V-38**: TenantGuard global في APP_GUARDS. 3h
- **V-39** + **V-68**: httpOnly cookie + CSRF — مشروع 12h. **يلمس dashboard auth.store.ts** — تنسيق مع frontend
- **V-40**: lockout DoS — CAPTCHA + email self-unlock. 8h
- **V-41**: email enumeration — توحيد رسائل. 2h
- **V-42**: 2FA backup codes — جدول جديد. 6h
- **V-43**: admin login hardening. 3h
- **V-123**: RBAC granular permissions — P3 مشروع. 16h
- **V-124**: حذف `shared/security/rate-limit.guard.ts` dead code. 30min

## Pre-conditions
- E1 المهمة 3 (encryption columns) متاحة — لـ V-42 backup codes hash
- E1 schema مكتمل أو على الأقل V-23 columns موجودة
- WebSocket client (dashboard) يدعم `auth.token` في handshake (socket.io-client>=3.x)

## Post-conditions
- لا token plaintext في DB
- جميع endpoints `/auth/*` لها DTOs مع validation
- WS gateway مغلق على JWT
- session invalidation فوري على force-logout/suspend/role-change
- audit logging موثوق (outbox)

## قواعد الجودة الإلزامية
1. ❌ لا تلمس Engineer 3/4 files (uploads, admin DTOs, OTP, payments)
2. ❌ لا تعطّل auth flow بدون e2e tests كاملة
3. ❌ لا تضع secrets في git
4. ✅ كل V-card في PR منفصل (V-13 ثلاثة PRs)
5. ✅ كل PR يحوي e2e test جديد على الأقل
6. ✅ commits: `fix(auth): V-NNN — وصف`
7. ✅ `pnpm test:e2e auth` بعد كل PR
8. ✅ `/security-review` قبل push كل auth-related PR

## التسليم
```json
{
  "stage": "E2",
  "e2e_test_count_added": 24,
  "ws_security_status": "JWT-gated + token-revocation + tenant-isolation verified",
  "session_invalidation_latency": "<1s p99",
  "audit_outbox_lag": "<5s p99",
  "lint_status": "...",
  "test_status": "..."
}
```

---

## 📝 ملاحظة ختامية — كيف تعمل بكفاءة

1. **ابدأ بـ `/init`** — يولّد CLAUDE.md بمعلومات Prisma multi-DB وauth patterns
2. **E1 يسبق E2 P1** — encryption columns + RefreshToken table يجب أن تكون جاهزة قبل V-13c/V-14/V-23
3. **V-01 (WS auth) هي أول مهمة P0 في E2** — لا تؤجلها
4. **استخدم `/security-review` بكثرة** — كل auth change حساس
5. **استخدم `/simplify` بعد كل دفعة V-13/V-14** — auth.service.ts ينمو سريعاً
6. **التنسيق اليومي**: راسل Engineer 1 (postgresql.conf, env.validation) و Engineer 4 (audit outbox usage)
7. **تجنّب deep nesting**: إن وصلت لـ 3+ levels في auth code، استدعِ `/simplify`

🚦 **Critical Path الخاص بك:** E1.M1 (FK indices) → E1.M2 (Cascade) → E1.M3 (Encryption columns) → E2.M1 (WS Auth) → E2.M5 (V-14 triad) → باقي E2

---

## ✅ V-14 triad — closed 2026-05-22

The three-PR session-invalidation series is done. Every trigger now cascades through the same `cacheService.setPasswordChangedAt` primitive and the two revocation gates (`JwtStrategy.validate` for HTTP, `WsAuthGuard.validateConnection` for WS):

| PR | Trigger | Mechanism | Tests |
|---|---|---|---|
| **V-14a** | Admin force-logout, password reset (self + admin + forgot-password) | `setPasswordChangedAt(userId)` + audit | 6 e2e |
| **V-14b** | Admin tenant suspend | `setPasswordChangedAt` per member + `disconnectTenantClients(tenantId)` + cache invalidate + helper rejects `tenant.status≠active` | 10 e2e |
| **V-14c** | Admin role change (any direction, incl. no-op) | `setPasswordChangedAt(userId)` + `disconnectUserClients(userId)` + audit enriched with `oldRoleId` + `sessionsRevoked: true` | 6 e2e |

**Integration coverage:** V-01 WS handshake gate (9 e2e) shares the same primitive — total E2 invalidation surface = **31 e2e cases**, all green on `feature/ai-reception-phases-1-8` HEAD.

**Refresh-path coverage as a side effect:** `auth.service.refreshTokens:348` was the only path that re-used `payload.roleId` to mint new tokens. After V-14c writes pwChangedAt, that check fails first (iat < pwChangedAt → 401), forcing full re-login that reads `firstTenantUser.roleId` fresh from DB. No direct refresh patch needed.

**Remaining V-14 follow-ups** (all open, not blocking deploy):
- **V-14a-perf-counter** — `Promise.allSettled` + fulfilled count for `affectedUserCount` accuracy under partial Redis failure
- **V-14a-perf** — Redis pipeline batch write when a tenant grows past ~100 users
- **V-14b-login** — `auth.service.login.findMany` filter on `tenant.status='active'` (decided direction: ✅ filter; ~1h, post-V-14c)
- **V-14d** — self "logout everywhere" endpoint (deferred until support requests it)
- **V-14e-dry** — bundled cleanup (TenantGuard:34 redundant inline check + supertest TS in 3 specs + counter accuracy; ~15min chore PR)

---

## 🔎 Follow-ups discovered (2026-05-19, during V-18)

### V-18b — additional un-indexed FK columns (Engineer 2 next)
أثناء فحص schema لـ V-18 وجدت FK columns إضافية بدون index مفقودة من قائمة الـ audit:
- `invoice_items.employee_id` (tenant)
- `loyalty_transactions.invoice_id` (tenant)

**التطبيق:** نفس نمط V-18 — schema edit + raw SQL migration + runbook entry.
**المدة المتوقعة:** 2 ساعة (نسخة مكرّرة من V-18 بأهداف مختلفة).

---

### V-77+ — tenant migration toolchain rebuild (Engineer 1 scope)
الـ tenant migration pipeline مكسور بطرق متعدّدة، تمنع `prisma migrate deploy` من العمل على tenant DBs fresh:

1. **`tooling/scripts/migrate-tenants.ts` stub** — التعليق صريح: `"will be implemented in Phase 3"`. لا آلية تطبيق tenant migrations على N من tenant DBs.
2. **`create-tenant.ts` يستخدم `prisma db push`** بدلاً من `migrate deploy`. يتجاهل migrations directory تماماً — أي tenant جديد يبدأ بـ `_prisma_migrations` فارغ، يخلق drift مع tenants موجودة.
3. **migration `20260429130000_pos_checkout_atomic` يفترض وجود `pos_shifts`** لكن لا migration ينشئها (الجدول في `tenant.prisma` فقط، يبني عبر db push). `prisma migrate deploy` يفشل بـ `relation "pos_shifts" does not exist`. اكتُشف أثناء V-18 local verification.

**الأثر على V-18:** لم يمنع تنفيذ V-18 (طُبِّق عبر raw SQL + manual resolve)، لكنه يجعل كل migration tenant مستقبلية (V-17 cascade, V-23 encryption, …) تحتاج نفس الـ workaround إلى أن يُصلح.

**التوصية:** Engineer 1 يفتح PR لإعادة بناء الـ tenant migration flow — بدءاً بإضافة migration backfill لـ `pos_shifts` ثم تنفيذ `migrate-tenants.ts`.

---

### V-77c — `deploy.sh:74` cross-schema migrate deploy (Engineer 1 scope)
السطر:
```bash
api sh -c "npx prisma migrate deploy --schema=prisma/platform.prisma && npx prisma migrate deploy --schema=prisma/tenant.prisma"
```
يحاول تطبيق migrations directory (`prisma/migrations/` — كلها tenant tables) على platform DB. على prod هذا silently no-op لأن `_prisma_migrations` غير موجود على platform DB، وعلى DB جديدة فارغة سيفشل في أول `CREATE TABLE` (مكرر) أو inconsistency. السطر يجب أن يستبدل بـ:
- لـ platform: psql loop على `prisma/platform-migrations/*.sql`
- لـ tenant: استدعاء `migrate-tenants.ts` (بعد تنفيذه)

---

### V-17b — Prisma middleware: `.delete()` → soft-delete on Invoice/Payment (Engineer 4 scope)

V-17/V-73 added `deleted_at` columns على `invoices` و `payments` + FK RESTRICT يمنع hard DELETE من cascading. لكن application code ما زال يستدعي `prisma.invoice.delete()` / `prisma.payment.delete()` — سيواجه:
- لو invoice له ZATCA submission `submitted`/`cleared`/`reported` → trigger يرفض (23001)
- لو invoice له payments/discounts → FK RESTRICT يرفض (23001)
- لو invoice "نظيف" → DELETE ينجح (hard delete، يخالف نية soft-delete)

**التطبيق (Engineer 4):**
1. أضف Prisma middleware في `apps/api/src/shared/database/` (أو حيث client يُنشأ) يفحص الـ model:
   ```ts
   prisma.$use(async (params, next) => {
     if (params.action === 'delete' && ['Invoice','Payment'].includes(params.model)) {
       params.action = 'update';
       params.args = { where: params.args.where, data: { deletedAt: new Date() } };
     }
     if (params.action === 'deleteMany' && ['Invoice','Payment'].includes(params.model)) {
       params.action = 'updateMany';
       params.args = { ...params.args, data: { deletedAt: new Date() } };
     }
     return next(params);
   });
   ```
2. أضف Prisma middleware ثاني يضيف `deletedAt: null` filter تلقائياً لكل query على `Invoice`/`Payment` (إلا في admin/audit paths صريحة).
3. update `invoices.service.ts` + payments إن لزم لمعاملة الـ behaviour الجديد (e.g. error messages للـ pre-existing hard-delete callers).
4. e2e tests: `prisma.invoice.delete({where:{id}})` → row remains with `deletedAt` set، not removed.
5. **ERRCODE handling في invoice/payment DELETE paths** — حتى بعد middleware، بعض admin/cleanup paths قد تحاول hard DELETE صراحة (e.g. test fixture teardown). يجب أن تتوقّع كلا الـ Postgres error codes:
   - **`23001` (`restrict_violation`)** — تأتي من V-73 trigger `no_delete_finalized_zatca_invoices` (ZATCA submission_status في submitted/cleared/reported)
   - **`23503` (`foreign_key_violation`)** — تأتي من V-17 FK RESTRICT (`payments_invoice_id_fkey`, `discounts_invoice_id_fkey`, إلخ) أو من `zatca_invoices_invoice_id_fkey` لو ZATCA row موجودة بأي state آخر

   Wrapper موحّد (مثال):
   ```ts
   try { await prisma.invoice.delete({where:{id}}); }
   catch (e: any) {
     if (e.code === 'P2003' /* prisma FK */) throw new ConflictException('Cannot delete: has dependent records');
     if (e.meta?.code === '23001') throw new ConflictException('Cannot delete: ZATCA retention applies');
     throw e;
   }
   ```
   ملاحظة: Prisma يلفّ بعض الـ Postgres codes داخل `e.code='P2003'` + `e.meta`. اختبر السلوك الفعلي قبل النشر.

**الملفات Engineer 4:**
- `apps/api/src/modules/salon/invoices/invoices.service.ts`
- `apps/api/src/modules/salon/invoices/invoices.module.ts` (Prisma client provider)
- اختبارات الـ e2e/integration المرتبطة

**مدة متوقعة:** 4 ساعات.

**Engineer 2 dependency:** schema + DB triggers جاهزة من V-17/V-73 — Engineer 4 يبني فقط الـ middleware layer. سأنبّه Engineer 4 عبر مدير المشروع.

---

### V-44b — flip ESLint `no-decimal-to-number` to `error` (after Engineer 4 cleanup)

V-44 landed the rule at severity `warn` because **21 pre-existing call sites across 9 files** in Engineer 4 territory need refactoring first. The rule is `error`-grade in intent — `warn` is purely a temporary CI-not-blocking accommodation.

**Pre-existing violations (Engineer 4 must refactor to `.toString()` / `.toFixed()` / `Prisma.Decimal` arithmetic):**

| File | Lines | Count |
|---|---|---|
| `apps/api/src/modules/public/public.service.ts` | 338, 339, 345, 346 | 4 |
| `apps/api/src/modules/salon/ai-consultant/ai-consultant.service.ts` | 249 | 1 |
| `apps/api/src/modules/salon/booking/booking.service.ts` | 356 | 1 |
| `apps/api/src/modules/salon/client-dna/client-dna.service.ts` | 67, 111 | 2 |
| `apps/api/src/modules/salon/invoices/invoices.service.ts` | 88, 324, 578 | 3 |
| `apps/api/src/modules/salon/packages/packages.service.ts` | 19, 20, 49, 50 | 4 |
| `apps/api/src/modules/salon/pos-shifts/pos-shifts.service.ts` | 138 | 1 |
| `apps/api/src/modules/salon/reports/reports.service.ts` | 268 | 1 |
| `apps/api/src/shared/pdf/pdf.service.ts` | 112, 113, 122, 123 | 4 |
| **Total** | | **21** |

All twenty-one are `Number(decimalField)` on properties whose backing column is `NUMERIC(10, 2)` or wider (Invoice subtotal/taxAmount/discountAmount/total/unitPrice/totalPrice, PosShift.openingBalance, Client.totalSpent, Service/Package prices, Discount values). The conversion loses precision for amounts > ~9 quadrillion halalas — not an immediate risk at current data scale, but a real bug pattern as the platform grows.

**Forward-defense gain:** the rule surfaced 3.5× more technical debt than the original audit ticket scoped (V-44 scoped "Number(decimal) hygiene" loosely; the rule turned it into a precise inventory). Engineer 4 has the full list above for the cleanup PR.

**Replacements:**
```ts
// ❌
const subtotal = Number(invoice.subtotal);

// ✅ for display / external API
const subtotal = invoice.subtotal.toFixed(2);   // "1234.56"
const subtotal = invoice.subtotal.toString();   // "1234.56"

// ✅ for arithmetic
const total = invoice.subtotal.add(invoice.taxAmount);  // Prisma.Decimal
```

**Engineer 2 follow-up (one-line PR after Engineer 4 cleanup PR merges):**
```diff
- '@servix/servix/no-decimal-to-number': 'warn',
+ '@servix/servix/no-decimal-to-number': 'error',
```

In `apps/api/.eslintrc.js`.

---

### V-01b — multi-tenant JWT pinning (Engineer 3 scope, E5)

V-01 introduced strict WS handshake validation: the server now derives `tenantId` from the verified JWT and rejects any handshake whose `query.tenantId` contradicts it. This surfaced a long-standing nuance in the auth flow that Engineer 3 should address as a separate card.

**Behaviour today (still correct after V-01):**

`auth.service.ts:314-318` (login) and `:353-358` (refresh) sign the JWT with `firstTenantUser.tenantId`. Users with multiple `tenant_users` rows (confirmed on prod: `ptoll2055@gmail.com` is linked to both `d8b44c83` and `50268284`) get a JWT pinned to the *first* tenant. Switching context to the other tenant in the UI does not re-issue the JWT, so:

- HTTP requests carrying that JWT will keep targeting the *first* tenant via `TenantGuard`.
- After V-01, WS connections will be pinned to the JWT tenant; switching tenants in the UI without a fresh token will fail to connect to the other tenant's rooms.

**This is the intended security posture** — the JWT is the source of truth and the WS guard treats any contradicting query field as a confusion attack. The UX gap is the missing tenant-switch endpoint.

**Required follow-up (Engineer 3, E5 / V-37–V-43 cluster):**

1. New endpoint `POST /auth/switch-tenant` that takes a target `tenantId`, verifies the requesting user has an active `tenant_users` row for it, then issues a fresh JWT pinned to that tenant. Returns `{ accessToken, refreshToken }`.
2. Dashboard `auth.store` invokes the endpoint on tenant change, then reconnects the WS with the new token.
3. Optional: include `availableTenants: string[]` claim in the JWT so the WS guard could relax the strict equality check at the same security level — but this leaks more info than necessary. The endpoint-based approach is preferred.

Engineer 2 already owns the JWT signing code, so coordination is light: Engineer 3 calls into `authService.generateTokens()` with a new tenant context. No schema change needed.

---

### V-14d — self "logout everywhere" (deferred)

V-14a fixes admin-initiated and reset-flow session invalidation. The self-initiated equivalent — a user clicking "log out of all devices" without changing their password (e.g. "I saw a strange login email, kick everything") — is intentionally out of scope.

**Why deferred:**
- Not in the V-14 threat model. The audit calls out three triggers: password change, admin force-logout, role/suspend change. All three are covered by V-14a + V-14b + V-14c.
- Existing `POST /auth/logout` (Public) blacklists the refresh token only. That is the right behaviour for "I'm done on this device". Expanding it into "kill every session" mixes two UX concepts.
- The actual primitive (`setPasswordChangedAt(req.user.sub)`) is already wired and trivially callable from a future endpoint.

**If/when implemented:** a new authenticated endpoint `POST /auth/logout/everywhere` that calls `cacheService.setPasswordChangedAt(req.user.sub)` + writes an audit row. Estimated 1h. Open the card only if support tickets surface the use case.

---

### V-13b-length — extend booking OTP from 4 → 6 digits

V-13b closed the **predictability** gap on the booking OTP by replacing `Math.random` with `crypto.randomInt`. It did **not** extend the **search space**: 4 digits = 10K possibilities, still weak against a brute-force attacker who can throw 10K attempts at a phone within the OTP TTL window. The existing rate-limit (`cacheService.canSendBookingOtp`, ~5 attempts per phone per window) is what makes the current length acceptable in practice, not the entropy of the code.

**Recommendation:**
- Extend the booking OTP to **6 digits** (1M possibilities) — matches the email OTP and the SMS-OTP industry standard.
- Verify the rate-limit covers verify attempts too, not just send attempts (audit `cacheService.verifyBookingOtp` for an attempt-counter + lockout-on-N-failures).

**Why deferred from V-13b:** length change touches the booking client UX (`apps/booking/src/**`) — Engineer 3 frontend scope. crypto.randomInt fixes predictability but not the search space; the audit's "OTP entropy" finding is the predictability part, which is now closed.

**Owner:** Engineer 3 (booking flow) or Engineer 2 (auth-adjacent). **P2**, ~2h including the frontend input field width + the rate-limit audit.

---

### V-14b-login — auth.service.login should skip suspended tenants (Engineer 2 next slot, post-V-14c)

V-14b makes a suspended tenant fail at HTTP guard + WS handshake + immediate WS disconnect. But `auth.service.login()` still includes suspended tenants in the `tenantUsers` array because it filters on `tenant_user.status='active'`, not on `tenant.status`. A multi-tenant user (we have one on prod: `ptoll2055@gmail.com` linked to 2 tenants) whose `firstTenantUser` points to a suspended tenant gets a JWT pinned to it on login and is immediately blocked on every tenant-scoped request.

**Direction (decided 2026-05-21 after V-14b ship):** filter login server-side. Skip suspended tenants from the `findMany` so multi-tenant users fall through to their next-best active tenant automatically, and single-tenant users see a clean "no active tenant" error at login instead of a successful login that 403s on every subsequent request.

**Rationale:**
- UX: avoids 403 fatigue on every tenant-scoped path post-login.
- Consistency: matches the audit's mental model that suspend = no entry point.
- Security-neutral: HTTP middleware + TenantGuard + WS guard already block suspended-tenant requests; this is cosmetic, not a new control.
- Multi-tenant users gain a working fallback for free.

**Fix (~5 lines):** add `tenant: { status: 'active' }` to the `tenantUsers.findMany` where clause in `auth.service.login` and the parallel path in `auth.service.getMe`. Handle the `tenantUsers.length === 0` branch with a localized error message ("لا يوجد حساب فعّال").

**Frontend coordination:** the dashboard's "switch tenant" UI today renders every link from the login response. After this filter, suspended tenants stop appearing in the picker — that's the desired UX. Confirm with the owner before merging.

**Owner / Scope:** Engineer 2, P2, ~1h. Opens immediately after V-14c (close out the V-14 series before touching the login flow).

---

### tenants.service.suspend orphan — dead code audit

`apps/api/src/core/tenants/tenants.service.ts:144` exposes `suspend(id)` that flips `tenant.status='suspended'` with **no audit log and no cascade**. No controller in the repo calls it; `grep -rn "tenantsService.suspend\|tenants.service.suspend"` returns zero hits.

If this method ever gets called — by accident, by a future controller, or by tests — it would suspend a tenant without the V-14b cascade running, leaving stale tokens and audit gaps. Safer to delete in a tiny cleanup PR.

**Verify first:** `git log -p apps/api/src/core/tenants/tenants.service.ts | grep -A 5 "async suspend"` to confirm no historical caller, then delete. Engineer 2 owns.

---

### V-14a-perf-counter — accurate `affectedUserCount` under partial Redis failure

`admin.service.forceLogoutTenant` writes `affectedUserCount: members.length` to the audit row regardless of how many `setPasswordChangedAt` calls actually succeeded. `setPasswordChangedAt` swallows Redis errors internally, so a partial Redis outage produces an audit row that overstates how many sessions were invalidated.

**Behaviour today (acceptable):** the audit log records "we attempted to log out N users", not "we logged out exactly N users". No security implication — the failure mode is reporting drift under outage, not a privilege escalation.

**Fix (when convenient):** switch the `Promise.all` to `Promise.allSettled`, count the fulfilled entries, and write that count instead. ~5 lines. Bundle with V-14a-perf (batch write) if both land together — same call site.

```ts
// sketch
const results = await Promise.allSettled(
  members.map((m) => this.cacheService.setPasswordChangedAt(m.userId)),
);
const succeeded = results.filter((r) => r.status === 'fulfilled').length;
// audit row gets { affectedUserCount: succeeded, attemptedCount: members.length }
```

Engineer 2 owns.

---

### V-43-mandatory-2fa — tighten admin 2FA from enforce-if-enabled to mandatory

V-43 shipped 2FA as **enforce-if-enabled** (decision 1) — a super_admin without `twoFactorEnabled` logs in with password alone. This was deliberate to avoid locking out an un-enrolled super_admin on deploy.

Once ops confirms ALL active super_admins have `twoFactorEnabled=true` (query in `docs/migrations/v43-apply.md`), this card flips enforcement to **mandatory**:

1. `admin.service.login` rejects password-only login for super_admins whose `twoFactorEnabled=false` with a clear "2FA enrollment required" error.
2. Add an enrollment-grace path: a short-lived token that ONLY permits `/auth/2fa/setup` + `/auth/2fa/verify`, nothing else, so a fresh super_admin can enroll.
3. Audit `admin_login_2fa_enrollment_required`.

**Owner decision required** before flipping (lockout risk). **Engineer 2 owns.** ~2h. Schedule after enrollment is confirmed prod-wide.

---

### V-43-audit-counter — Prometheus counter for blocked-IP admin login attempts

V-43's IP allowlist blocks pre-user-lookup, so there's no `userId` to write a `PlatformAuditLog` row (userId is NOT NULL per V-78). Blocked attempts are currently `logger.warn`'d only.

Add a Prometheus counter `servix_admin_login_blocked_ip_total{ip}` incremented in `assertAdminIpAllowed` on block. Alertmanager rule: alert on ANY increment (admin login from a non-allowlisted IP is always worth investigating — either a misconfigured operator or an attack).

**Engineer 1 (Platform/Infra)** owns Prometheus + alertmanager. Engineer 2 supplies the one-line increment once E1 lands the rule.

---

### V-43-env — Joi validation for ADMIN_IP_ALLOWLIST CSV format

V-43 reads `ADMIN_IP_ALLOWLIST` via `configService.get(..., '')` with no boot-time format validation. A malformed entry fails closed (matches nothing), so the security risk is "operator accidentally locks themselves out," not "allowlist silently disabled." Still, a boot-time Joi check that each CSV entry parses as IPv4 or IPv4-CIDR would catch typos before deploy.

Add to `env.validation.ts`: a custom Joi validator that splits the CSV and validates each entry against an IPv4/CIDR regex (or reuses the `isIpAllowed` helper's parse logic).

**Engineer 1 (Platform/Infra)** owns `env.validation.ts`. Engineer 2 can supply the validator function. Low priority.

---

### V-43-parity — full V-25/V-41 hardening parity on admin login

V-43 added 2FA + IP-allowlist + audit + bcrypt-timing-equalization to admin login, but did NOT add the IP-block + account-lockout layers that user `/auth/login` has (V-25). An attacker who knows a super_admin email + is on the allowlist (or allowlist disabled) can still brute-force the password subject only to `@RateLimit(5, 300)`.

This card brings admin login to full V-25 parity:
1. `cacheService.checkLoginIpBlock` + `incrementLoginFailIp` (shared counter with user login, or admin-specific).
2. `cacheService.isAccountLocked` + `incrementLoginFailAccount` for the super_admin.
3. Account-lock SMS notification (super_admin phone).

Lower priority because `@RateLimit(5, 300)` (5 attempts / 5min / IP) + the tiny known super_admin set make brute-force far less valuable than against the broad user base. **Engineer 2 owns.** ~1.5h. Schedule alongside V-43-mandatory-2fa.

---

### V-41b-resend-otp-uniform — unify `/auth/resend-otp` 4-message variance

`auth.service.resendEmailOtp` (auth.service.ts:1526-1548) returns 4 distinct messages:

1. User not found → `"إذا كان البريد مسجلاً، سيتم إرسال رمز تحقق جديد"` (generic ✓)
2. User found + already verified → `"البريد الإلكتروني مُؤكد بالفعل"` 🚨 reveals existence + state
3. User found + rate-limited → `"يرجى الانتظار 60 ثانية قبل إعادة الإرسال"` 🚨 reveals existence + recent OTP send
4. User found + OK → `"تم إرسال رمز تحقق جديد إلى بريدك الإلكتروني"` 🚨 reveals existence

Branches 2-4 leak existence via message variance + network IO timing (sendEmailOtpInternal fires only on branch 4).

V-41 left this as accepted UX trade-off because unifying breaks "already verified" / "wait 60s" feedback users expect. This follow-up either:

**Option A** — full uniformity: always return branch-1's generic message + apply jitter (similar to V-41's forgotPassword pattern) on branches 1/2 to equalize with branch 4's network IO.
**Option B** — partial: unify branches 1+4 only; keep "already verified" as informational + accept its leak.

Owner choice driven by UX preference. ~1.5h either option. **Engineer 2 owns.**

---

### V-41-audit — Prometheus counter for enumeration-probing patterns

V-41 closes the per-request enumeration channel. An attacker resorting to statistical/sampling attacks (sending N probes to distinguish via aggregate timing variance) is much slower but still possible.

Add Prometheus counters at the V-41-hardened paths:

- `servix_auth_login_unknown_email_total{ip}` — increments inside login's `if (!user)` branch
- `servix_auth_2fa_unknown_email_total{ip}` — same for verify2FALogin
- `servix_auth_forgot_unknown_email_total{ip}` — increments inside forgotPassword's `else` branch

Alertmanager rule: alert if `rate(servix_auth_*_unknown_email_total[10m]) by (ip) > 20`. Operational signal that an IP is iterating email lists — V-41's per-request mitigation works, but the campaign is still visible at aggregate volume.

**Engineer 1 (Platform/Infra)** owns Prometheus + alertmanager wiring. Engineer 2 supplies counter increments as one-liners. Low priority — schedule when WAF / fail2ban telemetry doesn't already cover this.

---

### V-38-cleanup — remove redundant `@UseGuards(TenantGuard)` decorators (~30 files)

V-38 registered `TenantGuard` as a global `APP_GUARD`. The 30 explicit `@UseGuards(TenantGuard)` decorators on salon controllers + 2 non-salon (`core/notifications`, `shared/whatsapp/whatsapp-connect`) became redundant — NestJS dedupes (each guard instance runs once per request even if registered multiply). They serve as inline documentation but represent ~30 lines of future maintenance noise (rename, refactor risk).

This card:
1. Removes `@UseGuards(TenantGuard)` from the 30 salon controllers + 2 non-salon.
2. Removes the `TenantGuard` import where it's the only `@UseGuards` argument (cleaner file head).
3. Where `@UseGuards(TenantGuard, FeatureGuard)` exists (e.g., `ai-consultant.controller.ts`), keeps only `@UseGuards(FeatureGuard)`.
4. Updates V-14e-dry section: the tenant.status redundant check at `tenant.guard.ts:80-82` is still tracked there; this card can bundle the removal if convenient.

**Engineer 2 owns.** ~20 min mechanical edit + run regression battery. Schedule any time post-V-38 ships to prod.

---

### V-38-audit — Prometheus counter for `assertActiveTenantUser` rejections

V-38 closes the global gap for stale-tenant-membership JWTs. Operators may want visibility into how often the new 403 fires (signal: legitimate user with old JWT after support revoked their TenantUser, OR an attack against a stale token).

Add Prometheus counter `servix_tenant_membership_rejected_total{path}` incremented inside `assertActiveTenantUser` when it throws. Alertmanager rule fires if `rate(...) > 5/hour`.

**Engineer 1 (Platform/Infra)** owns the Prometheus + alertmanager wiring. Engineer 2 supplies the counter increment as a one-line change once E1 lands the rule. Low priority — only worth scheduling if 403 frequency becomes operationally noticeable.

---

### V-38-defense-in-depth — re-check `request.user` independently of `request.tenant`

Post-V-38 TenantGuard's `if (!tenant) return true` short-circuits BEFORE checking `request.user`. Designed correctly: TenantMiddleware deliberately skips tenant context for `/admin/*` etc., and admin routes don't need a tenant. But if a bug ever causes JwtAuthGuard to fail-silent (e.g., return true without setting `request.user`), TenantGuard would let an unauthenticated request through to those routes.

Defensive variant — fire `if (!user) throw` BEFORE the tenant check:

```ts
const user = request.user;
if (!user) throw new ForbiddenException(...);   // defense vs upstream JwtAuthGuard bug
const tenant = request.tenant;
if (!tenant) return true;                       // delegation to TenantMiddleware (admin/public)
```

Not currently exploitable (JwtAuthGuard hasn't shown such a bug), but matches the V-14b "trust nothing about upstream guards" philosophy. ~5 min change + 1 new test asserting the throw fires when user is undefined on a non-public route.

**Engineer 2 owns.** Low priority — schedule alongside V-38-cleanup.

---

### V-37b-feature-flag — remove spoofable `x-tenant-id` from feature-flag guard (Engineer 3)

Same spoofable-header pattern as V-37 (now fixed in `quota.guard.ts`) lives at `apps/api/src/shared/feature-flags/feature-flag.guard.ts:35`:

```ts
tenantId: request.tenant?.id || request.headers?.['x-tenant-id'],
```

**Lower severity than the QuotaGuard case** because:
1. JWT-derived `request.tenant?.id` has PRIORITY (header is fallback only — opposite of pre-V-37 QuotaGuard's ordering).
2. Feature-flag decisions are informational ("is this flag on for this tenant?"), not authorization.

Still worth closing: defense-in-depth + audit-log integrity if the flag-eval result is ever persisted with the tenantId. Fix is one line — delete the `|| request.headers?.['x-tenant-id']` fallback.

**Engineer 3 (shared/feature-flags is E3 scope) owns**. ~5 min impl + spec update. Schedule any time.

---

### V-37c-detect-resource — replace controller-name pattern matching with explicit metadata

`quota.guard.ts:61-69` `detectResource` does case-insensitive substring matching on the controller class name:

```ts
const controller = context.getClass().name.toLowerCase();
if (controller.includes('employee')) return 'employees';
if (controller.includes('client'))   return 'clients';
// ...
```

Fragile — rename `EmployeesController` → `StaffController` and quota silently breaks. Replace with an explicit `@QuotaResource('employees')` method decorator + `Reflector.get()` lookup. ~30 min + tests.

**Engineer 2 owns.** Low priority — schedule when refactoring the quota plumbing or when wiring `QuotaGuard` as global `APP_GUARD`.

---

### V-37d-quota-fail-policy — re-evaluate fail-open on DB errors

`quota.guard.ts:96-99` returns `0` on DB-count failure (`return 0; // fail-open on DB errors`). Allows resource creation to proceed when the count query throws — opposite of V-13c's fail-CLOSED stance for security-critical counts.

For quota specifically, fail-open is defensible:
- Wrong direction: a transient DB blip during a quota-near-limit POST shouldn't deny a legitimate user.
- Symmetric: fail-CLOSED on quota would let an attacker DoS the DB to cause widespread feature lockout.

But the policy isn't documented anywhere — a future engineer might flip it inconsistently. This card:
1. Adds an inline comment explaining the chosen policy (fail-open + rationale).
2. Considers a metric `servix_quota_db_error_total` so ops know when the fail-open is exercised.

**Engineer 2 owns**. ~20 min. Schedule at the next quota incident or quarterly hygiene pass.

---

### V-60-audit-fail — forensic audit on ValidationPipe rejections

V-60 hardened 7 auth endpoints with class-validator DTOs + `forbidNonWhitelisted: true`. Malformed payloads now correctly return 400, but the rejection happens at the global `ValidationPipe` BEFORE the controller method runs — services never see the request, so `auditService.log()` is never invoked for these 400s. Operators lose visibility into payload-shape attacks (probing for missing fields, extra fields, type mismatches at scale).

This card adds a thin global exception filter that intercepts `BadRequestException` thrown by `ValidationPipe` and emits a forensic audit row:

```ts
@Catch(BadRequestException)
export class ValidationAuditFilter implements ExceptionFilter {
  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();
    const body = exception.getResponse() as { message?: string[] };

    // Only audit ValidationPipe failures (class-validator wraps messages in
    // a string[] array; other BadRequest paths use a single string).
    if (Array.isArray(body?.message)) {
      this.auditService.log({
        userId: (req.user as { sub?: string })?.sub ?? 'anonymous',
        action: 'http_validation_failed',
        entityType: 'Request',
        entityId: req.url,
        newValues: {
          path: req.url, method: req.method,
          errors: body.message,                 // class-validator messages
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']?.slice(0, 500),
        },
      }).catch(() => {});
    }

    res.status(400).json(exception.getResponse());
  }
}
```

Wire as `useGlobalFilters` in `main.ts` (or `APP_FILTER` provider). Audit volume: bounded by attacker traffic + accidental client misuse; transition-only firing not applicable (every 400 emits one row). Operators should monitor `SELECT count(*) FROM platform_audit_logs WHERE action='http_validation_failed' GROUP BY new_values->>'path'` for spikes signalling probing campaigns.

**Engineer 2 owns** (auth scope, plus shared filter infrastructure). ~1h. Schedule once V-60 is on prod and the 400-rate baseline is established.

---

### V-30 — JWT secret/expiry env validation (verify-only ✅ 2026-05-26)

**Status:** verified clean. No commit needed on the runtime / schema / config side.

V-30 / A2-11 (HIGH P1) was the Joi-hardening of `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET` + `ENCRYPTION_KEY` at `apps/api/src/shared/config/env.validation.ts` — owned and shipped by Engineer 1 in E7 alongside V-29 (`.env.example` sanitization) and the prod-side secret rotation to 80-char base64. See `docs/principal-audit/execution/e8-changelog.md:926-947` for the original work record.

Engineer 2's verify-only audit (this entry) confirmed:

1. **Schema layer** (`env.validation.ts:19-30, 48-56`):
   - `JWT_ACCESS_SECRET` + `JWT_REFRESH_SECRET`: `Joi.string().min(64).pattern(PLACEHOLDER_PATTERN, { invert: true }).required()`. Custom error messages identify the offending env var.
   - `JWT_ACCESS_EXPIRATION` default `15m`; `JWT_REFRESH_EXPIRATION` default `7d`.
   - `ENCRYPTION_KEY`: same shape as JWT secrets, conditional `.when('NODE_ENV', { is: 'production', then: required+min64+pattern })`.
   - `PLACEHOLDER_PATTERN = /<REQUIRED|change[-_ ]?me/i` — case-insensitive, catches `<REQUIRED…`, `change-me`, `change_me`, `CHANGE_ME`, `Change Me`.

2. **Boot gate** (`app.module.ts:48`): `validationSchema: AppConfigValidationSchema` wires Joi into `ConfigModule.forRoot`. NestJS runs validation eagerly at module init — boot fails before any service is instantiated if any required env is missing or invalid.

3. **Config factory** (`jwt.config.ts`): secrets read raw via `process.env.JWT_*_SECRET` (no `|| 'fallback-secret'` literal). Expirations have `'15m'` / `'7d'` factory fallbacks matching Joi defaults — consistent two-layer defense.

4. **20 runtime call sites scanned** — all `configService.get<string>('jwt.accessSecret', '')` and `… || ''` patterns are defensive TypeScript-narrowing fallbacks (the lookup returns `string | undefined`, the fallback satisfies downstream `string` type requirements). Post-Joi these branches are **unreachable** — Joi guarantees the env is set to ≥ 64 chars at boot. The 5 critical sites (auth.service.generateTokens, jwt.strategy, jwt-refresh.strategy, events.module, admin.service ×5) all use the same defensive pattern. No hardcoded literal secrets anywhere.

5. **Boot Joi behavior** verified with 6 representative cases (8-char short, `<REQUIRED…` placeholder, `change-me` placeholder, `CHANGE_ME` case-insensitive, missing required, valid 80-char). All reject/accept correctly. Case-insensitivity confirmed.

6. **Expiry consistency**: user-facing JWT access = 15m, refresh = 7d, consistent across `jwt.config.ts`, `auth.module.ts:27`, `auth.service.generateTokens`. Documented exception: `admin.service.login:163-169` reads `session_duration` from `platform_settings` (default 1440 minutes) — explicit admin-panel UX choice, not an env-bypass. Out of V-30 scope; documented here for cross-reference.

7. **`jwt-refresh.strategy.ts:18`** continues to read `jwt.refreshSecret` even though it became dead code post-V-13c (opaque refresh tokens don't go through Passport JWT verification anymore). The fallback is defensive but the file itself is scheduled for deletion via `V-13c-strategy-cleanup`. Not a V-30 issue.

**No drift in Engineer 2 scope.** No commit to source / tests / migrations. This entry is the verification record.

---

### V-25-sms-cost — SMS-budget monitoring on lockout transitions

V-25 mirrors `login`'s SMS notification on the account-lockout transition (`auth.service.handle2FAFailure` → `smsService.send` when `accResult.locked = true`). Transition-only firing caps the attacker's ability to spam SMS to ~1 message per 24h per victim, which is acceptable.

For owners who want explicit cost visibility:

1. Add a Prometheus counter `servix_auth_lockout_sms_total{path}` incremented on each `smsService.send` from the lockout transition (`login` and `verify2FALogin` both).
2. Alertmanager rule: alert if `rate(servix_auth_lockout_sms_total[1h]) > N` (N to be tuned — likely ~5-10/hour signals an attack campaign vs normal user lockouts).
3. Optional: emit `auth_lockout_sms_sent` audit row with `cost_estimate_sar` populated from the active SMS provider tariff.

**Engineer 1 (Platform/Infra)** owns the Prometheus + alertmanager wiring. Engineer 2 supplies the counter increment as a one-line change once E1 lands the rule. Low priority — only worth scheduling if SMS spend on auth becomes operationally noticeable.

---

### V-24-rename — rename `password_resets.token` → `tokenHash`

V-24 left the column name as `token` even though post-V-24 it holds a sha256 hex exclusively. Renaming to `tokenHash` would make the contract explicit at the schema level and prevent future code from re-introducing a raw-vs-hash confusion. Migration:

1. Prisma schema: `token` → `tokenHash` with `@map("token_hash")` (or rename the column physically — see Phase A decision).
2. Platform SQL migration: `ALTER TABLE password_resets RENAME COLUMN token TO token_hash; ALTER INDEX password_resets_token_key RENAME TO password_resets_token_hash_key;`
3. Update 4 call sites (3 in `auth.service.ts`: `forgotPassword`, `verifyResetToken`, `resetPassword`; 1 in `admin.service.ts:sendPasswordResetLink`).

**Engineer 2 owns.** ~20 min. Schedule any time. Cosmetic; not security-blocking.

---

### V-24-email — wire MailService into AdminModule

`admin.service.sendPasswordResetLink` returns the raw token in the API response body. The admin reads it and delivers manually (Slack, ticket, in-person). The original implementation had a `// TODO: Send email with reset link when MailService is available in AdminModule` comment + a `console.log` leak (the leak is fixed by V-24; the TODO remains).

This card:

1. Import `MailModule` into `AdminModule` (`apps/api/src/core/admin/admin.module.ts`).
2. Inject `MailService` into `AdminService` constructor.
3. In `sendPasswordResetLink`, after the DB tx, call `mailService.send({ to: user.email, subject, body, html })` with a reset-URL containing the raw token (same shape as `auth.service.forgotPassword:673-680`).
4. Decision: keep returning `token` in the API response (defense-in-depth in case the email fails), OR drop it (cleaner). My lean: keep it but mark deprecated; remove in a follow-up once email reliability is proven.
5. New audit field `emailDispatched: boolean` in `admin_password_reset_link_sent` newValues so ops can correlate "audit row present but email failed".

**Engineer 2 owns.** ~1h. Schedule once V-24 is on prod and the response shape is stable.

---

### V-24-audit-completion + V-24-self-serve-audit — bundle: PasswordReset.initiatedBy + completion audits

V-24 enriched `admin_password_reset_link_sent` but did NOT add `admin_password_reset_completed` / `admin_password_reset_failed` audit rows. The reason: `auth.service.resetPassword` is the verifier for BOTH self-serve and admin flows, and it has no way to distinguish initiator today. Pre-V-24 it also has NO audit row on success — a self-serve user redeeming a reset token leaves no trail at all, which is a SOC2 / PDPL gap.

This card bundles both:

1. Schema: add `initiatedBy` column to `PasswordReset` (VARCHAR(20), default 'self_serve', accepted values `self_serve` | `admin`).
2. `admin.service.sendPasswordResetLink` writes `initiatedBy: 'admin'`.
3. `auth.service.forgotPassword` writes `initiatedBy: 'self_serve'` explicitly.
4. `auth.service.resetPassword` reads `reset.initiatedBy` and emits one of:
   - `auth_password_reset_completed` (self-serve)
   - `admin_password_reset_completed` (admin)
5. Failure path (invalid / expired / used token): emit `auth_password_reset_failed` / `admin_password_reset_failed` (only when the token row exists — pure "unknown token" 400 stays silent to avoid audit-log spam from random probing).

**Engineer 2 owns.** ~1.5h + a small platform migration. Schedule alongside `V-24-rename` if convenient (both touch the same schema).

---

### V-13a-frontend — Google sign-in UI + Link-account settings panel

V-13a hardens `POST /auth/google` and adds `POST /auth/google/link`, but no SERVIX-served frontend currently invokes either. This card builds:

1. "Sign in with Google" button on `apps/dashboard/src/app/(auth)/login/page.tsx` (and matching for booking/admin if owners want it elsewhere). Uses Google Sign-In JavaScript SDK (loaded from `https://accounts.google.com/gsi/client`) → on token issue posts to `/auth/google`.
2. Settings panel section: "Connected accounts" with a "Link Google" button. Click → trigger Google Sign-In → POST idToken to `/auth/google/link`. Show success/error messages from API response body (the V-13a Arabic message is already client-friendly).
3. Error handling: surface the 401 from the takeover-block path verbatim — the message instructs the user to sign in with password first, which is the right next step.

**Engineer 3 / dashboard owns** (frontend scope, not Engineer 2). ~6h. Schedule once V-13a is on prod and the API contract is stable. Block on no upstream changes; no schema or backend work required.

---

### V-13a-verify — switch to local JWKS verification via google-auth-library

Current `GoogleAuthService.verifyIdToken` posts the idToken to `https://oauth2.googleapis.com/tokeninfo` and trusts the response. This is acceptable but:

- Adds a sync network round-trip to every `/auth/google` and `/auth/google/link` call.
- Trusts that endpoint to only return valid tokens (it does, but defense-in-depth says verify ourselves).
- Doesn't verify the JWT signature against Google's JWKS locally — we trust Google's response, not the token's signature.

This card:

1. `pnpm add google-auth-library` in `apps/api/` (requires owner dep-add approval).
2. Swap `verifyIdToken` to use `new OAuth2Client(clientId).verifyIdToken({ idToken, audience: clientId })`. This caches Google's JWKS in-process and verifies signature locally. Removes the per-call HTTP hop.
3. Keep the same return shape (`{ sub, email, email_verified, name, picture }`) so no downstream changes.
4. Update existing 1-2 GoogleAuthService unit tests.

**Engineer 2 owns** (auth scope). ~1.5h. Schedule any time. Not security-blocking; pure hardening.

---

### V-13a-unlink — POST /auth/google/unlink endpoint

Once V-13a-frontend ships a "Linked accounts" settings panel, users will want to unlink Google. ~5-line implementation:

```ts
@Post('google/unlink')
@ApiBearerAuth() @RateLimit(10, 60)
async unlinkGoogle(@CurrentUser('sub') userId: string): Promise<{ message: string }> {
  return this.authService.unlinkGoogle(userId);
}
```

```ts
async unlinkGoogle(userId: string): Promise<{ message: string }> {
  const user = await this.prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new UnauthorizedException('المستخدم غير موجود');
  if (!user.googleId) return { message: 'لا يوجد حساب Google مربوط.' };
  // Refuse if the user has no password (authProvider='google' only) — would lock them out.
  if (user.authProvider === AUTH_PROVIDERS.GOOGLE) {
    throw new BadRequestException('عيّن كلمة مرور أولاً قبل إلغاء ربط Google.');
  }
  await this.prisma.user.update({
    where: { id: userId },
    data: { googleId: null, authProvider: AUTH_PROVIDERS.LOCAL },
  });
  // + audit auth_google_unlinked
  return { message: 'تم إلغاء ربط حساب Google.' };
}
```

**Engineer 2 owns**. ~20 min implementation + 3 e2e tests. Schedule after V-13a-frontend lands (UX requirement).

---

### V-13a-phone-placeholder — fix synthetic phone for Google-only users

`auth.service.googleLogin` fresh-create path writes `phone: 'g-${googleUser.sub.slice(0, 10)}'` to satisfy the `User.phone @unique @db.VarChar(15)` constraint. Risks:

- Google `sub` values are 21-character decimal strings. First-10-chars collide once per ~10^10 users (low absolute risk but non-zero, and the constraint failure presents as a confusing 500 to the affected second user).
- The synthetic phone is visible in the user's profile and can be confusing.

Two viable fixes:

**Option A** — make `phone` nullable. Migration: `ALTER TABLE users ALTER COLUMN phone DROP NOT NULL; DROP INDEX users_phone_key; CREATE UNIQUE INDEX users_phone_key ON users(phone) WHERE phone IS NOT NULL;` (partial unique index — multiple NULLs allowed). Removes synthetic phones entirely.

**Option B** — keep NOT NULL but use a distinct format that cannot collide: e.g. `phone: 'google:${sub}'` (longer than 15 chars; requires VARCHAR widening too).

Owner choice. Migration coordination required (touches a column used by many code paths — login lookup by phone, SMS sending, etc.). **Engineer 2 owns**. ~2h impl + careful regression sweep. Schedule when phone-on-Google-users matters operationally.

---

### V-13a-backfill — investigate legacy googleId+authProvider='local' rows

V-13a's runbook (`docs/migrations/v13a-apply.md`) instructs ops to run this query on prod before deploy:

```sql
SELECT COUNT(*) FROM users WHERE google_id IS NOT NULL AND auth_provider = 'local';
```

If the count is non-zero, this card:

1. Reviews the sample (`SELECT id, email, google_id, created_at, last_login_at FROM users WHERE google_id IS NOT NULL AND auth_provider = 'local' ORDER BY created_at LIMIT 50`).
2. For each row, determines whether the Google link was legitimate (user genuinely signed in with Google in the past) or was a silent-link victim of the V-13a takeover gap.
3. Optionally contacts users (out-of-band) to confirm.
4. Either updates `auth_provider` to reflect reality, or revokes the `googleId` for confirmed-takeover rows.

**Engineer 2 owns**. Effort depends on the count. Schedule immediately after V-13a deploy IF the pre-flight query returned > 0.

---

### V-13c-cleanup — consolidate TokenBlacklist into RefreshToken.revokedAt (~30 days post-V-13c)

V-13c (refresh rotation + reuse detection) shipped with the existing `token_blacklist` table still in place. Logout writes to BOTH (revoke the `refresh_tokens` row AND blacklist the hash) as defence-in-depth during cutover. The blacklist read path is no longer consulted on the refresh path — `refresh_tokens` is the new source of truth — but the writes are still there.

After 30 days of clean V-13c operation (no false-positive reuse detections, no operational issues attributable to the new path), this card:

1. Drops the `await this.cacheService.blacklistRefreshToken(...)` calls from `auth.service.logout` and `auth.service.handleReuseDetected`.
2. Adds a Prisma migration to drop `token_blacklist` (the table + the corresponding Prisma model). Leaf table, no FK fan-in, safe to drop in one transaction.
3. Removes the dead `blacklistRefreshToken` / `isRefreshTokenBlacklisted` methods from `cache.service.ts` and their constants/TTL definitions.

**Engineer 2 owns.** Schedule after 2026-06-25 (30 days post the V-13c production deploy, owner to confirm date). ~20 min chore PR.

---

### V-13c-alert — Prometheus counter + alertmanager rule for refresh-reuse events

V-13c emits Sentry warnings on reuse detection but does NOT increment a Prometheus counter. The E1 stack (Prometheus + alertmanager + Telegram) is the project's preferred alert pipe — Sentry is best for crashes, not for security events that need oncall paging.

This card:

1. Adds a counter `servix_auth_refresh_reuse_total` (label: `userId` truncated to first 8 chars for cardinality safety) incremented in `handleReuseDetected`.
2. Adds an alertmanager rule firing on any non-zero increment over 5min (so a single replay attempt is enough to page). Wires to the existing Telegram channel.
3. Optional: companion counter `servix_auth_refresh_rotation_total` for the happy path, useful for "are tokens actually rotating?" observability.

**Engineer 1 (Platform/Infra) owns** — Prometheus + alertmanager are E1 scope. Engineer 2 supplies the counter increment point as a one-line change once E1 lands the rule.

---

### V-13c-race-tuning — optimistic lock on the rotation update

V-13c accepts a known race: two concurrent `/auth/refresh` calls with the same valid token both see `revoked_at IS NULL`, both succeed in issuing successors. The slower write loses `revoked_reason='rotated'` but both tokens are legitimate from the user's perspective.

This is fine for normal usage (clients don't race refresh). It becomes annoying if a single user runs the app on two tabs that auto-refresh simultaneously — they get two parallel families. Not security-broken, just noisy.

The hardening: replace the rotation `UPDATE` with optimistic locking:

```sql
UPDATE refresh_tokens
SET revoked_at = NOW(), revoked_reason = 'rotated', replaced_by_token_id = $new
WHERE id = $old AND revoked_at IS NULL
RETURNING id;
```

If `RETURNING` is empty, the row was rotated by a concurrent request between our `findUnique` and our `update`. Re-read the row; if the concurrent rotation succeeded, treat ours as a benign duplicate (return the OTHER successor we can find by `family_id` + `replaced_by_token_id = $old`). If neither successor exists, treat as reuse (cascade).

~30 min to implement, ~1h to test (race tests are flaky). Engineer 2 owns. Schedule when bored. Not blocking.

---

### V-13c-forensics — thread ip/UA into the 5 non-refresh issuance sites

V-13c persists `ip_address` and `user_agent` columns on every `refresh_tokens` row but only the `/auth/refresh` controller threads them through. The 5 other callers of `generateTokens` (login, register, verify2FALogin, googleLogin × 2, verifyEmailOtp) write null. Reuse-detection forensics asks "what IP started this family?" — and for families started at login (the common case), the answer is currently null.

This card threads ip/UA through all 5 sites. The controllers already extract `ip` for the existing audit logs; UA needs adding to controller signatures. ~1h, low risk. Engineer 2 owns. Schedule alongside V-13c-cleanup if convenient.

---

### V-13c-strategy-cleanup — delete dead JwtRefreshStrategy

`apps/api/src/core/auth/strategies/jwt-refresh.strategy.ts` is a Passport strategy registered as a provider in `auth.module.ts` but no `@UseGuards(AuthGuard('jwt-refresh'))` exists anywhere in the codebase. Post-V-13c it would reject opaque tokens as bad signatures anyway. ~5min: delete the file, drop the import + provider line, drop `JwtRefreshPayload` from `shared/types`. Engineer 2 owns. Bundle into V-13c-cleanup if helpful.

---

### V-13c-gc — periodic cleanup of expired refresh_tokens rows

`refresh_tokens` is append-only — V-13c never deletes rows, only flips `revoked_at`. At realistic traffic (~1k DAU × 1 family/day × 7 rotations/day) the table grows ~50k rows/week. Postgres handles that comfortably for years, but quarterly hygiene is good practice:

```sql
DELETE FROM refresh_tokens
WHERE revoked_at < NOW() - INTERVAL '90 days'
   OR (revoked_at IS NULL AND expires_at < NOW() - INTERVAL '90 days');
```

Wire as a daily Nest cron job (similar to `ai-reception.expirer.ts`) or a Postgres `pg_cron` job. ~1h. Engineer 2 owns. Schedule once table size matters; not urgent.

---

### V-14e-dry — bundled cleanup (one small PR, post-V-14c)

After V-14b shipped, three independent loose ends accumulated. They're each tiny, and the discipline cost of running them as separate PRs exceeds the work. Bundle into one cleanup PR:

1. **`shared/guards/tenant.guard.ts:34`** — inline `if (tenant.status === 'suspended') throw …` check is now redundant with `assertActiveTenantUser` which performs the same check (plus the broader "any non-active state" rejection). Keep the helper, drop the inline guard. Behaviour change: suspended-tenant requests now produce the helper's localized message (`'حساب الصالون غير مفعّل'`) instead of TenantGuard's slightly different message (`'حساب الصالون معلّق'`). Worth flagging in the commit body for ops; not a functional regression.

2. **`apps/api/test/{auth,admin,tenant-isolation}.e2e-spec.ts:7`** — `import * as request from 'supertest';` fails compile (TS2349, V-14e original entry). Switch to `import request from 'supertest';` (default import) consistent with the typing shipped by `@types/supertest`. Three identical one-line fixes.

3. **`admin.service.forceLogoutTenant` / `updateTenantStatus`** — V-14a-perf-counter. Replace `Promise.all` with `Promise.allSettled` and write `affectedUserCount` from the fulfilled count, not `members.length`. ~5 lines per call site.

4. **Pre-existing lint errors surfaced during V-13b** — two errors persist in `pnpm exec eslint 'src/**/*.ts'` that are unrelated to V-13b's scope and were not addressed in the V-13b commit:
   - `apps/api/src/modules/salon/ai-reception/ai-reception.service.ts:382` — `'assistantReplyText' is never reassigned. Use 'const' instead` (`prefer-const`). Engineer 3 / AI-reception scope. Single-line `let` → `const` fix.
   - `apps/api/src/shared/ai/ai-provider.service.spec.ts:19` — `A 'require()' style import is forbidden` (`@typescript-eslint/no-require-imports`). Test file; convert the `require()` to an `import` statement at the top of the spec. Engineer 3 / AI-reception scope.

   Bundle into V-14e-dry only if a member of Engineer 2 scope picks them up incidentally; otherwise hand off to Engineer 3 since both files belong to AI-reception. Calling them out here so the next pre-flight does not re-report them as "V-13b-induced". Pinpointed during V-13b lint verification 2026-05-24.

Estimated total: ~15 min, scoped as a single chore PR. Engineer 2 owns. Opens right after V-14c lands.

---

### V-14e — test-infra: supertest namespace-import TS issue (pre-existing)

`apps/api/test/auth.e2e-spec.ts:7` and `apps/api/test/admin.e2e-spec.ts:7` both use `import * as request from 'supertest';` which TypeScript flags as not-callable under the current `@types/supertest` typing (`TS2349: This expression is not callable.`). The pattern was added in commit `3538b5a` (Initial project commit, 2026-03-19) and no later commit touched it.

The result: `pnpm test:e2e -- auth.e2e-spec` and `pnpm test:e2e -- admin.e2e-spec` fail on compile, not on assertion logic. Every Engineer 2 PR since V-01 has flagged this as a pre-existing regression in its checklist; closing it once will save the discipline cost on every future PR.

**Fix (one line per file):** change to `import request from 'supertest';` or `import * as request from 'supertest';` paired with `request.default(app.getHttpServer())` — depending on which @types/supertest version is pinned. ~10 min, behaviour-identical.

**Engineer 2 owns** (test infrastructure under Engineer 2 scope). Schedule any time; not security-blocking.

---

### V-14a-perf — pwChangedAt batch write for large tenants

`admin.service.forceLogoutTenant` now writes pwChangedAt for every TenantUser via `Promise.all`. Each call is one Redis `SETEX` round-trip. On prod today the largest tenant has < 10 users so total latency is single-digit ms; this comfortably stays under the audit's "<1s p99" requirement.

If a tenant ever crosses ~100 users, the per-row round-trip stacks up. The lossless upgrade is `cacheService.setPasswordChangedAtBatch(userIds[])` using `ioredis.pipeline()` + SETEX per key — one round-trip total regardless of count. Trivial 10-line method.

Open this card only if a real "force logout 500-user tenant" use case surfaces, or proactively if Engineer 3 hits the same shape elsewhere.

---

### V-78b — purge-cron design constraint (Engineer 1 lifecycle scope)

After V-78 lands, `platform_audit_logs.tenant_id_fkey` is `ON DELETE RESTRICT`. Any future "purge after `pendingDeletionAt` grace" cron must NOT call `prisma.tenant.delete()` / `DELETE FROM tenants` — the FK will reject with `ERRCODE 23503`.

**Required purge design:**

| Step | Action | Why |
|---|---|---|
| (a) | `DROP DATABASE servix_tenant_<slug>` | free disk + connection slot |
| (b) | Keep `platform.tenants` row, update `status='cancelled'` + a new `purged_at TIMESTAMPTZ NULL` column | preserves audit FK target |
| (c) | (Optional) extend `TenantStatus` enum with `purged` to distinguish from user-initiated cancel | clearer ops semantics |

Audit logs keep their valid `tenant_id` reference forever — PDPL article 12 + SOC2 retention satisfied.

**Coordinate before implementing:** Engineer 1 owns lifecycle scripts; Engineer 2 owns any new `purged_at` / enum value migration (would land as a small schema-only follow-up).

---

### V-77d — tenant registry ↔ DB reconciliation (Engineer 1 scope)

أثناء التحقّق من حالة prod قبل V-18 runbook، اكتُشف drift بين `tenants` table و state الـ DBs على disk:

| slug | status | DB on disk | تفسير |
|---|---|---|---|
| `dantila-d0f48d47` | `active` | ✅ موجود | سليم |
| `test-ai-reception` | `trial` | ✅ موجود | سليم |
| `hthr-36e0b612` | `pending` | ❌ غير موجود | provisioning لم يكتمل (signup قبل 32 يوم، بلا `pending_deletion_at`) |
| `platform-admin` | `cancelled` | ❌ غير موجود | DB حُذف، registry row متبقّي (cleanup غير مكتمل) |

**التوصيات (Engineer 1 scope — Engineer 2 يطفو القضية فقط، لا يصلح):**
- `status='pending'` لـ > 7 أيام → retry provisioning أو mark `cancelled`
- `status='cancelled'` مع registry row موجود → purge row أو ضع `pendingDeletionAt`
- **Critical guard:** `status='active'/'trial'` بدون DB matching → data-loss alarm (لا يوجد حالياً، لكنه risk مستقبلي يستحق detection)
- **`create-tenant.ts` bidirectional transactional rollback:**
  - لو `CREATE DATABASE` نجح ثم registry insert فشل → احذف الـ DB
  - لو registry insert نجح ثم `CREATE DATABASE` فشل → احذف registry row
- وحدة reconciliation يومية (cron) تكتب drift entries لـ alerting

**Engineer 2 dependency:** الـ V-18 runbook يستثني hthr و platform-admin بدقة. أي tenants مستقبلية تنشأ بـ drift سيُستثنى من V-18 loop تلقائياً (الـ filter في الـ runbook يعتمد على وجود الـ DB).
