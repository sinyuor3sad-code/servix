# تقرير امتثال PDPL — SERVIX

**تاريخ التقرير:** أبريل 2026

---

## 1. جمع البيانات ✅

| المتطلب | الحالة | التنفيذ |
|---------|--------|---------|
| إشعار الخصوصية عند التسجيل | ✅ | privacy-policy-ar.md مُعروض |
| الموافقة الصريحة | ✅ | checkbox عند إنشاء الحساب |
| الغرض من الجمع مُحدد | ✅ | موثق في Privacy Policy |
| جمع أقل قدر ممكن | ✅ | فقط البيانات الضرورية للخدمة |

## 2. حقوق أصحاب البيانات ✅

| الحق | Endpoint | الحالة |
|------|----------|--------|
| حق الوصول (PDPL Art. 14) | `GET /api/v1/data-rights/my-data` | ✅ |
| حق التصحيح (PDPL Art. 15) | `PATCH /api/v1/data-rights/my-data` | ✅ |
| حق الحذف (PDPL Art. 16) | `DELETE /api/v1/data-rights/my-data` | ✅ |
| حق النقل | `GET /api/v1/data-rights/my-data?format=json` | ✅ |
| فترة انتظار 30 يوم | DataRightsService.requestDeletion | ✅ |

## 3. أمن البيانات ✅

| الإجراء | الحالة | التفاصيل |
|---------|--------|---------|
| تشفير أثناء النقل | ✅ | TLS 1.3 via cert-manager |
| تشفير أثناء التخزين | ✅ | AES-256-GCM (EncryptionService) |
| عزل المستأجرين | ✅ | Database-per-tenant |
| سجل تدقيق | ✅ | PlatformAuditLog |
| إدارة الأسرار | ✅ | K8s Secrets / Environment vars |
| حماية CSRF | ✅ | Double-submit cookie |
| سياسة CSP | ✅ | Helmet middleware |
| Rate Limiting | ✅ | RateLimitGuard + Redis |

## 4. نقل البيانات ✅

| المعالج | الموقع | DPA |
|---------|--------|-----|
| Hetzner Cloud | ألمانيا | ✅ |
| CloudFlare | عالمي | ✅ |
| Moyasar | السعودية | ✅ |
| Firebase (Google) | عالمي | ✅ |

## 5. الاحتفاظ بالبيانات ✅

مُوثق في `docs/legal/data-retention-policy.md`

---

# تقرير امتثال ZATCA — SERVIX

## Phase 1: الفوترة الإلكترونية ✅

| المتطلب | الحالة | التنفيذ |
|---------|--------|---------|
| فواتير UBL 2.1 | ✅ | ZatcaXmlBuilder |
| QR Code (TLV 8 tags) | ✅ | ZatcaCryptoService.generateTLV |
| رقم ضريبي | ✅ | seller.vatNumber في XML |
| عنوان البائع/المشتري | ✅ | PostalAddress في XML |

## Phase 2: التكامل والربط ✅

| المتطلب | الحالة | التنفيذ |
|---------|--------|---------|
| تسجيل الجهاز (CSR) | ✅ | ZatcaService.onboardDevice |
| توقيع رقمي ECDSA | ✅ | ZatcaCryptoService.signInvoice |
| XML-DSIG Signature | ✅ | ZatcaCryptoService.embedSignature |
| إرسال لـ ZATCA API | ✅ | ZatcaService.reportToZatca |
| Hash SHA-256 | ✅ | ZatcaCryptoService.hashInvoice |
| تخزين مشفر للمفاتيح | ✅ | EncryptionService.encrypt |

## الاختبارات

- 7 اختبارات Crypto (CSR, hash, TLV, signature)
- 9 اختبارات XML (UBL structure, escaping)
- **16 اختبار — كلها ناجحة ✅**
