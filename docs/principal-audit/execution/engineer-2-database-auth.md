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
