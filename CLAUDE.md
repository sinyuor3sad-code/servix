# CLAUDE.md — SERVIX Project Intelligence (v3.0)

> **This file is the single source of truth for AI assistants working on this project.**
> Claude reads this automatically. Follow every instruction precisely.
> **Updated: March 2026 v3.0 — security fixes + trust features + WhatsApp per-tenant**

---

## 🎯 Project identity

- **Name:** SERVIX
- **Type:** Hybrid SaaS platform for service businesses
- **First sector:** Women's salons in Saudi Arabia
- **Future sectors:** Barbershops, restaurants, clinics, gyms (via new modules — never rebuild core)
- **Revenue model:** Monthly/yearly subscriptions (Basic / Pro / Premium)
- **Language:** Arabic-first (RTL), English supported
- **Currency:** SAR (Saudi Riyal)

---

## 🏗️ Architecture decisions (locked — do not change)

| Decision | Choice | Reason |
|----------|--------|--------|
| Business model | Hybrid SaaS | Salon subscribes + gets dashboard + public booking page |
| Data isolation | Database per tenant | Each salon = isolated PostgreSQL database |
| System structure | Core Platform + Business Modules | Core is shared, modules are sector-specific |
| Multi-tenancy | Tenant middleware extracts tenant from JWT → connects to correct DB | Never query wrong DB |
| Feature control | Feature flags per plan + per tenant override | Enable/disable features granularly |
| Real-time | WebSocket via Socket.io + Redis Pub/Sub | Instant updates across all clients |
| Theming | 4 dashboard themes (velvet/crystal/orchid/noir) + 5 seasonal overlays + salon branding | Each salon looks unique |
| Auth | JWT (access 15min + refresh 7days) + OTP via SMS | Secure stateless auth |
| Roles | RBAC — owner, manager, receptionist, cashier, staff | Granular permissions |

---

## 🛠️ Tech stack (use these exact technologies)

### Backend (apps/api)
- **Framework:** NestJS (latest)
- **Language:** TypeScript (strict mode)
- **ORM:** Prisma (latest)
- **Database:** PostgreSQL 17
- **Cache:** Redis 8
- **Auth:** Passport.js + @nestjs/jwt
- **Validation:** class-validator + class-transformer
- **Queue:** BullMQ (for background jobs)
- **WebSocket:** Socket.io via @nestjs/websockets
- **File upload:** Multer + Sharp (image resize) → S3-compatible storage
- **PDF Generation:** PDFKit (for invoices)
- **Logging:** Winston
- **Docs:** Swagger via @nestjs/swagger
- **Testing:** Jest

### Frontend — Dashboard (apps/dashboard)
- **Framework:** Next.js (latest, App Router)
- **Language:** TypeScript (strict mode)
- **CSS:** Tailwind CSS (latest)
- **UI Components:** Shadcn/UI + Radix UI
- **State:** Zustand
- **Data fetching:** TanStack Query v5
- **Forms:** React Hook Form + Zod
- **Charts:** Recharts
- **Icons:** Lucide React
- **Animation:** Motion (framer-motion)
- **i18n:** next-intl
- **Theme:** next-themes (dark/light/auto)
- **Toast:** Sonner

### Frontend — Landing Page (apps/landing or separate)
- Next.js static site
- SEO optimized
- Arabic-first with English toggle
- Pages: home, pricing, features, terms, privacy, contact

### Infrastructure
- **Monorepo:** Turborepo + pnpm workspaces
- **Container:** Docker + Docker Compose
- **CI/CD:** GitHub Actions
- **CDN:** CloudFlare
- **Hosting:** Hetzner Cloud
- **Monitoring:** Sentry + Uptime Kuma
- **Storage:** S3-compatible (MinIO locally, CloudFlare R2 in production)
- **Backup:** Automated daily PostgreSQL dumps → S3

---

## 🔒 SECURITY REQUIREMENTS (critical — apply before launch)

### SEC-1: Login rate limiting (MISSING — must add)
```
Failed attempts from same IP:
  5 failures  → block 15 minutes
  10 failures → block 1 hour
  20 failures → block 24 hours

Failed attempts on same account:
  5 failures  → require OTP verification
  10 failures → lock account, notify owner via SMS

Implementation: Use @nestjs/throttler on /auth/login endpoint
Store attempt counts in Redis with TTL
```

### SEC-2: Refresh token blacklist (MISSING — must add)
```
On logout:
  1. Add refresh token to Redis blacklist (key: "blacklist:{tokenHash}", TTL: 7 days)
  2. On every refresh request, check blacklist BEFORE verifying token
  3. If blacklisted → reject with 401

On password change:
  1. Blacklist ALL active refresh tokens for this user
  2. Force re-login on all devices
```

### SEC-3: Swagger protection in production (MISSING — must add)
```typescript
// In main.ts:
if (configService.get('NODE_ENV') !== 'production') {
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);
}
// In production: Swagger is completely hidden
// Alternative: protect with admin password via basic auth
```

### SEC-4: Database backup strategy (MISSING — must add)
```
Daily automatic backup:
  - Cron job at 3:00 AM
  - pg_dump each tenant database + platform database
  - Compress with gzip
  - Upload to S3 (CloudFlare R2)
  - Retain: 7 daily, 4 weekly, 3 monthly
  - Restore script: one command to restore any backup
  - Test restore monthly

Implementation: tooling/scripts/backup.sh + GitHub Actions cron
```

### SEC-5: File upload security rules
```
Images (salon logo, service photos, employee avatars):
  - Max size: 5MB
  - Allowed types: image/jpeg, image/png, image/webp ONLY
  - Auto-resize with Sharp: max 1200x1200px, quality 80%
  - Strip EXIF metadata (privacy)
  - Generate unique filename: {uuid}.{ext}
  - Store in S3 bucket per tenant: uploads/{tenantId}/{type}/{filename}

Logo specifically:
  - Max size: 2MB
  - Auto-resize: max 400x400px
  - Used in: dashboard header, booking page, invoice PDF, PWA icon

NEVER accept: .exe, .js, .html, .svg, .pdf uploads from users
ALWAYS validate MIME type on server side (don't trust client Content-Type)
```

### SEC-6: CORS in production
```typescript
// Development:
origin: 'http://localhost:3000'

// Production:
origin: [
  'https://app.servi-x.com',
  'https://*.servi-x.com',
  'https://admin.servi-x.com',
]
// NEVER use origin: '*' in production
```

---

## 💬 WHATSAPP BUSINESS SUITE (per-tenant architecture)

### ⚠️ CRITICAL: WhatsApp credentials are PER SALON, not per platform

Each salon connects their OWN WhatsApp Business account. SERVIX does NOT have a single WhatsApp number.

### WhatsApp settings (stored in TENANT settings table, not .env):
```
whatsapp_enabled              → "true"/"false"
whatsapp_token                → "EAAxxxxxxx..."        ← salon's own token
whatsapp_phone_number_id      → "106xxxxxxx"           ← salon's own number
whatsapp_business_name        → "صالون الأناقة"
whatsapp_verified             → "true"/"false"          ← verified by test message
```

### WhatsApp connection flow for salon owner:
```
1. Owner opens Settings > WhatsApp
2. Clicks "Connect WhatsApp"
3. Sees instructions to get Token + Phone Number ID from Meta Business
4. Pastes credentials
5. System sends test message to owner's phone
6. If received → whatsapp_verified = true
7. Done! All messages now send from salon's own number
```

### WhatsApp service implementation:
```typescript
// WRONG ❌ — reading from .env (platform-level)
const token = this.configService.get('WHATSAPP_TOKEN');

// CORRECT ✅ — reading from tenant settings (salon-level)
const settings = await this.settingsService.getMultiple(tenantDb, [
  'whatsapp_enabled',
  'whatsapp_token',
  'whatsapp_phone_number_id',
]);
if (settings.whatsapp_enabled !== 'true' || !settings.whatsapp_token) {
  return; // WhatsApp not configured for this salon
}
```

### Message types (all check whatsapp_enabled + whatsapp_token first):
1. **Booking confirmation** (auto) — when booking created
2. **Reminder 24hr** (auto) — scheduled job
3. **Reminder 1hr** (auto) — scheduled job
4. **Invoice PDF** (manual) — cashier clicks send
5. **Review request** (auto) — 2hrs after appointment
6. **Win-back 30/60/90 days** (auto) — scheduled job for inactive clients
7. **Marketing campaign** (manual) — admin creates
8. **Daily morning report** (auto) — to manager at 8 AM

### Implementation rules:
- All messages queued via BullMQ — never synchronous
- Failed messages retry 4x with exponential backoff
- Log every message in notifications table
- Check BOTH whatsapp_enabled AND specific toggle (e.g., whatsapp_invoice_send)
- If salon hasn't connected WhatsApp → gracefully skip, no errors

---

## 🎛️ SALON CONTROL PANEL (Toggle System)

All toggles stored in tenant `settings` table (key-value). Changes instant via WebSocket.

### Settings keys:
```
# ═══════ Booking Controls ═══════
online_booking_enabled        → "true"/"false"
auto_confirm_booking          → "true"/"false"
booking_advance_days          → "30"
min_booking_notice_hours      → "2"
cancellation_deadline_hours   → "12"
max_daily_bookings            → "0" (0=unlimited)
walk_in_enabled               → "true"

# ═══════ Vacation / Pause ═══════
vacation_mode                 → "false"
vacation_message_ar           → ""
vacation_start_date           → ""
vacation_end_date             → ""

# ═══════ WhatsApp (per-tenant credentials) ═══════
whatsapp_enabled              → "true"/"false"
whatsapp_token                → ""
whatsapp_phone_number_id      → ""
whatsapp_business_name        → ""
whatsapp_verified             → "false"
whatsapp_booking_confirm      → "true"
whatsapp_booking_reminder     → "true"
whatsapp_invoice_send         → "true"
whatsapp_review_request       → "true"

# ═══════ Other Notifications ═══════
sms_enabled                   → "true"/"false"
email_enabled                 → "true"/"false"

# ═══════ Features ═══════
loyalty_enabled               → "true"/"false"
coupons_enabled               → "true"/"false"
```

When online_booking_enabled=false: booking page shows "الحجز الإلكتروني مغلق حالياً — تواصلي معنا: {phone}"
When vacation_mode=true: no new bookings, custom message shown, existing bookings notified.
ALWAYS check settings before executing toggle-able actions.
Cache settings in Redis (TTL: 5 min).

---

## 👩‍💼 SMART ATTENDANCE SYSTEM

### Design principle: Status is CALCULATED, never manually inputted

### 4 Employee Statuses (NO "busy" status):

| Status | Determined by |
|--------|--------------|
| present | Checked in via dashboard/tablet |
| absent | No check-in after shift start |
| on_break | Schedule-based or manual break toggle |
| off_duty | Outside shift hours or day off |

### Why no "busy" status?
The appointments table already tracks who is booked when. If Sarah has an appointment 2:00-2:30, no one can book that slot. No separate status needed.

### Booking availability logic:
```
Checked in? → NO = hidden
Within shift? → NO = hidden
On break? → YES = hidden
Time slot booked? → Check appointments table
All clear? → Available ✅
```

### CRITICAL: Service completion ≠ Payment
```
Employee track:  start service → finish service → FREE immediately
Cashier track:   client to reception → invoice → pay → WhatsApp (parallel)
Employee does NOT wait for payment.
```

### Safety alerts:
- Service running 150% over expected duration → alert manager
- Service completed but no invoice after 30 min → alert (possible unpaid leave)
- Employee present but no appointments next hour → suggest walk-ins
- No check-in 15 min after shift → alert manager

---

## 🧾 INVOICE PDF GENERATION

### PDF must include:
- Salon logo + name (Arabic + English) + colors from branding
- Salon address + phone + tax number
- Invoice number (INV-XXXX), date, time
- Client name + phone
- Service list with prices + employee names
- Subtotal, discount (with reason), VAT (15%), total
- Payment method + status
- ZATCA QR Code (seller name, tax number, date, total, VAT amount)
- Footer: "شكراً لزيارتكم" + booking link
- Salon's primary color as accent throughout

### Implementation:
- `shared/pdf/pdf.service.ts` — generates PDF buffer
- `GET /api/v1/invoices/:id/pdf` → returns PDF download
- `POST /api/v1/invoices/:id/send` → sends via chosen channel (whatsapp/sms/email)

---

## 📋 SUBSCRIPTION LIFECYCLE (must implement)

### Plans:
| Feature | Basic (199 SAR/mo) | Pro (399 SAR/mo) | Premium (699 SAR/mo) |
|---------|-------------------|-------------------|----------------------|
| Services management | ✅ | ✅ | ✅ |
| Client management | 100 max | unlimited | unlimited |
| Appointments | ✅ | ✅ | ✅ |
| POS / Cashier | ✅ | ✅ | ✅ |
| Invoices | ✅ | ✅ | ✅ |
| Employees | 3 max | 10 max | unlimited |
| Basic reports | ✅ | ✅ | ✅ |
| Online booking page | ❌ | ✅ | ✅ |
| Advanced reports | ❌ | ✅ | ✅ |
| Detailed permissions | ❌ | ✅ | ✅ |
| Coupons | ❌ | ❌ | ✅ |
| Loyalty system | ❌ | ❌ | ✅ |
| WhatsApp integration | ❌ | ❌ | ✅ |
| Multi-branch | ❌ | ❌ | ✅ |
| ZATCA e-invoicing | ❌ | ✅ | ✅ |

### Trial period:
- 14 days free trial on Pro plan
- No credit card required
- Full access to all Pro features
- Day 12: reminder "trial ends in 2 days"
- Day 14: trial ends, prompt to subscribe

### Subscription expiry flow (MUST IMPLEMENT):
```
Day 0:     Subscription expires
           → Send SMS + email + WhatsApp: "اشتراكك انتهى — جدّد الآن"
           → Dashboard shows yellow banner: "اشتراكك منتهي — جدّد للاستمرار"

Day 1-7:   READ-ONLY MODE (grace period)
           → Can view all data but cannot create/edit anything
           → Booking page shows: "الحجز متوقف مؤقتاً"
           → Daily reminder to renew

Day 8-14:  LOCKED MODE
           → Cannot access dashboard at all
           → Redirected to renewal page only
           → Booking page shows: "الصالون غير متاح حالياً"

Day 15:    Final warning
           → SMS: "بياناتك ستُحذف خلال 45 يوم إذا لم تجدد"

Day 60:    DATA DELETION
           → Drop tenant database
           → Remove all files from S3
           → Remove tenant record from platform DB
           → This is IRREVERSIBLE
           → Send final confirmation: "تم حذف حسابك نهائياً"
```

---

## 🤝 TRUST & LEGAL PAGES (must build)

### Terms of Service page (/terms)
- Service description
- Pricing and billing
- Cancellation and refund policy
- Data ownership (salon owns their data)
- Service level agreement (99.9% uptime target)
- Limitation of liability
- Governing law: Saudi Arabia
- Arabic language is the binding version

### Privacy Policy page (/privacy)
- What data is collected
- How data is stored (encrypted, isolated per tenant)
- Who has access
- Data retention periods
- Saudi PDPL compliance
- Right to access, correct, and delete data
- Cookie policy
- Contact for data requests

### Data Export (salon can download all their data):
```
Settings > Account > Export Data
  → Generates ZIP containing:
    - clients.csv (all clients with contact info)
    - appointments.csv (all appointments history)
    - invoices.csv (all invoices with items)
    - services.csv (all services and categories)
    - employees.csv (all employees)
    - settings.json (all salon settings)
  → Download link sent via email (valid 24 hours)
  → Available to owner role only
```

### Account Deletion:
```
Settings > Account > Delete Account
  → Warning: "This will permanently delete all your data"
  → Requires: type salon name to confirm
  → Requires: enter password
  → Process:
    1. Cancel active subscription
    2. Send confirmation email
    3. Mark tenant as "pending_deletion"
    4. 7-day cooling period (can cancel deletion)
    5. After 7 days: permanently delete all data
  → Available to owner role only
```

---

## 🎨 ONBOARDING WIZARD (first-time experience)

### When a new salon registers, show step-by-step setup:

```
Step 1: "مرحباً! خلنا نجهّز صالونك" (Welcome)
  → Salon name (AR + EN)
  → City
  → Phone number
  → Upload logo (optional, can skip)

Step 2: "أوقات العمل" (Working hours)
  → Set opening/closing time per day
  → Pre-filled with common defaults (9AM-10PM, Fri 2PM-10PM)

Step 3: "أضف خدماتك" (Add services)
  → Pre-loaded templates: "صالون نسائي" has common services
  → User can edit names, prices, durations
  → Can add custom services
  → Minimum 1 service to continue

Step 4: "أضف موظفاتك" (Add employees)
  → Name, phone, role
  → Assign services to each employee
  → Minimum 1 employee to continue

Step 5: "صالونك جاهز! 🎉" (Done!)
  → Preview of booking page
  → Quick links: "أضف أول موعد", "شارك رابط الحجز"
  → Share booking link via WhatsApp/copy

### Implementation:
  → Store onboarding progress in settings: "onboarding_completed" → "true"/"false"
  → If false, redirect to wizard on login
  → Can be skipped but show reminder banner
  → Each step validates before proceeding
```

---

## 🌐 LANDING PAGE (servi-x.com)

### Must include:
- Hero section: headline + subheadline + "جرّب مجاناً 14 يوم" button
- Features section: 6-8 key features with icons
- How it works: 3 steps (سجّل → أعدّ → ابدأ)
- Pricing table: 3 plans with comparison
- Testimonials: quotes from salon owners (add later)
- FAQ section: common questions
- Footer: links to terms, privacy, contact
- Arabic-first, English toggle
- Mobile responsive
- SEO optimized (meta tags, structured data)
- Fast loading (static generation)

---

## 🔐 Multi-tenant data isolation

### How it works:
```
HTTP Request
    → AuthGuard (verify JWT)
    → TenantMiddleware (extract tenant_id from JWT → Redis cache → platform DB → connect tenant DB)
    → FeatureGuard (check feature enabled for plan)
    → RolesGuard (check user has permission)
    → Controller (uses tenant-scoped Prisma client)
    → Response
```

### Critical rules:
1. NEVER hardcode a database connection string
2. ALWAYS get Prisma client from `req.tenantDb`
3. NEVER let tenant API access platform DB directly
4. ALWAYS validate user belongs to requested tenant
5. Suspended/expired tenants get 403
6. Use lazy connection pooling
7. ALWAYS check settings toggles before toggle-able actions

---

## 🎨 Theming system

### Dashboard + Cashier (apps/dashboard) — 4 permanent themes × 2 modes = 8 variations:
1. **Velvet** — فخامة نسائية. بنفسجي غامق + ذهبي. خط Amiri للعناوين. borders ذهبية. صالون فاخر.
2. **Crystal** — حداثة ونظافة. أبيض ثلجي + وردي + أزرق سماوي. خط Tajawal. زوايا حادة. عيادة تجميل.
3. **Orchid** — دفء وطبيعة. وردي دافئ + أخضر زيتوني + بيج. خط Cairo. صالون بوتيك.
4. **Noir** — أناقة داكنة. أسود/رمادي + ذهبي. Dark mode أساسي. صالون VIP.

### Booking page (apps/booking) — salon colors + 5 seasonal overlays:
Booking page uses salon's own primaryColor + secondaryColor (no predefined themes).
5 seasonal overlays add decorative SVG elements (banners, particles) ON TOP of salon colors:
1. **Ramadan** — هلال ذهبي + فوانيس + particles. 1-29 رمضان (Hijri via Intl islamic-umalqura).
2. **Eid Fitr** — نجوم متلألئة + أبيض/ذهبي/أخضر. 1-3 شوال.
3. **Eid Adha** — مسجد SVG + ألوان دافئة. 10-13 ذو الحجة.
4. **National Day** — سيف ونخلة SVG + أخضر سعودي. 22-24 سبتمبر.
5. **Foundation Day** — بنفسجي وذهبي + شعار. 21-23 فبراير.

### Settings keys:
- `dashboard_theme` → velvet | crystal | orchid | noir
- `dashboard_mode` → light | dark
- `seasonal_themes_enabled` → true | false (manager can disable overlays)

### Per tenant: primary_color, secondary_color, logo_url, theme (velvet/crystal/orchid/noir), mode (light/dark)

---

## 📡 API design standards

### URL pattern:
```
/api/v1/{resource}                GET (list), POST (create)
/api/v1/{resource}/:id            GET (detail), PUT (update), DELETE (remove)
/api/v1/{resource}/:id/{action}   POST (special actions)
```

### Response format (always):
```json
{
  "success": true,
  "data": { ... },
  "message": "تمت العملية بنجاح",
  "meta": { "page": 1, "perPage": 20, "total": 150, "totalPages": 8 }
}
```

### Error format (always):
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "بيانات غير صالحة",
    "details": [{ "field": "phone", "message": "رقم الجوال مطلوب" }]
  }
}
```

---

## 🚀 FEATURE ROADMAP (prioritized)

### 🔴 Priority 1 — MVP (before launch)
1. ~~Fix 5 code review issues~~ ✅ Done
2. ~~WhatsApp + PDF invoices + toggles + attendance~~ ✅ Done
3. **Apply 6 security fixes (SEC-1 through SEC-6)**
4. **Fix WhatsApp to per-tenant architecture**
5. Quick POS mode (one-screen cashier)
6. Full booking page (mobile-first)
7. Smart dashboard with charts
8. Onboarding wizard
9. Landing page (servi-x.com)
10. Terms of service + privacy policy pages
11. Subscription expiry lifecycle
12. Data export + account deletion

### 🟠 Priority 2 — After 5 clients
13. Client reviews + ratings
14. Loyalty points
15. ZATCA e-invoice compliance
16. Smart alerts for manager
17. Daily morning report (WhatsApp)
18. Advanced reports (revenue, clients, employees)

### 🟡 Priority 3 — After 20 clients
19. Win-back messages for inactive clients
20. Online payment gateway (Moyasar/Tap)
21. Visual calendar with drag & drop
22. Payroll + commission calculator
23. Service packages
24. Post-visit review request

### 🟢 Priority 4 — After 50 clients
25. AI service recommendations
26. Dynamic pricing
27. Multi-branch management
28. Inventory management
29. Referral system
30. Google Business integration

---

## 🚫 Things to NEVER do

1. NEVER put business logic in controllers
2. NEVER return raw Prisma objects — map to DTOs
3. NEVER skip validation
4. NEVER store passwords in plain text — bcrypt 12 rounds
5. NEVER expose internal IDs in errors
6. NEVER use `*` imports
7. NEVER skip error handling
8. NEVER commit .env files
9. NEVER access platform DB from salon module
10. NEVER skip audit logging for writes
11. NEVER return unlimited results — always paginate
12. NEVER add manual "busy/available" button — status is auto-calculated
13. NEVER make employee availability depend on payment — separate tracks
14. NEVER send WhatsApp/SMS without checking settings toggle first
15. NEVER store WhatsApp credentials in .env — they go in tenant settings
16. NEVER show Swagger docs in production
17. NEVER accept file uploads without validating MIME type server-side
18. NEVER use CORS origin '*' in production
19. NEVER skip login rate limiting
20. NEVER allow refresh tokens to work after logout

---

## ✅ Things to ALWAYS do

1. ALWAYS add Arabic translations for all user-facing strings
2. ALWAYS add Swagger decorators
3. ALWAYS validate with Arabic error messages
4. ALWAYS use UUID v4 for IDs
5. ALWAYS use transactions for multi-step ops
6. ALWAYS log errors with context (userId, tenantId, action)
7. ALWAYS check feature flags before premium features
8. ALWAYS check settings toggles before toggle-able actions
9. ALWAYS handle loading, error, and empty states in UI
10. ALWAYS make responsive (mobile-first)
11. ALWAYS support RTL layout
12. ALWAYS separate service completion from payment
13. ALWAYS test tenant isolation
14. ALWAYS read WhatsApp credentials from tenant settings, not .env
15. ALWAYS strip EXIF metadata from uploaded images
16. ALWAYS validate file MIME type on server side
17. ALWAYS check refresh token against blacklist before accepting
18. ALWAYS implement graceful subscription expiry (not instant lockout)

---

## 🔄 Current build status

- [x] Phase 0-8: Initial build (376 files, grade 8.5/10)
- [x] Phase 9: Code review fixes (grade 9.2/10)
- [x] Phase 10-12: WhatsApp + PDF + Toggles + Attendance
- [x] **Phase 13: Security fixes (SEC-1 through SEC-6)** ✓
- [x] **Phase 14: Fix WhatsApp to per-tenant** ✓
- [x] Phase 15: Onboarding wizard + landing page ✓
- [x] Phase 16: Subscription lifecycle + trust pages ✓
- [x] Phase 17: Data export + account deletion ✓
- [ ] Phase 18: Polish UI + booking page + Quick POS
- [ ] Phase 19: Testing + security audit
- [ ] Phase 20: Deploy
- [ ] Phase 21: Launch

**Next: Phase 13 (security) → Phase 14 (WhatsApp per-tenant)**

---

## 🧠 Build checklist (before every feature):

1. Which phase? Don't skip.
2. Core or salon module? Right directory.
3. Needs tenant isolation? Use `req.tenantDb`.
4. Needs permission? Add guard.
5. Needs feature flag? Add `@RequireFeature`.
6. Needs settings check? Check toggle from tenant settings.
7. Needs audit log? Log it.
8. Needs real-time? Emit WebSocket.
9. Needs notification? Queue via BullMQ. Check tenant settings first.
10. Arabic translation added?
11. Swagger docs added?
12. Employee status manual? → NO, calculate it.
13. Service and payment separated? → Must be.
14. WhatsApp credentials from tenant settings? → Must be.
15. Rate limiting applied? → Must be on auth endpoints.
16. File upload validated? → MIME type + size + resize.
17. Subscription status checked? → Expired = read-only.

---

*v3.0 — March 2026 — Security + trust + legal + WhatsApp per-tenant + onboarding + landing page + subscription lifecycle + 30 features*
