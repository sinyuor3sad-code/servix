# إصلاح فاتورة PDF + إعادة هيكلة تجربة الضرائب

> **الحالة:** معتمد — جاهز للتنفيذ
> **التاريخ:** 2026-04-30
> **المنفذ:** Claude Opus 4.7

---

## السياق والمشكلة

### مشكلة 1: PDF الفاتورة مكسور
- النص العربي **معكوس/مقلوب** في الـ PDF (مشكلة PDFKit مع RTL)
- رسالة الواتساب تظهر صحيحة لكن ملف الـ PDF غير مقروء
- محتوى الفاتورة **ناقص** — لا يتوافق مع متطلبات ZATCA للفاتورة الضريبية المبسطة
- ملف المشكلة: `apps/api/src/shared/pdf/pdf.service.ts` (يستخدم PDFKit + arabic-reshaper + bidi-js)

### مشكلة 2: تجربة الإعدادات مربكة
- قسم "البيانات الضريبية (ZATCA)" موجود داخل صفحة "بيانات الصالون" (`/settings/salon`)
- صفحة "ZATCA" منفصلة في السايدبار (`/zatca`)
- العميلة (صاحبة الصالون) تتلخبط بين المكانين
- مصطلح "ZATCA" غير مفهوم للعميلة العادية

---

## متطلبات ZATCA — فاتورة ضريبية مبسطة (B2C)

الحقول الإلزامية التي يجب أن تظهر في PDF الفاتورة:

| # | الحقل | مصدر البيانات | حالياً |
|---|-------|--------------|--------|
| 1 | عبارة "فاتورة ضريبية مبسطة" | ثابت | ❌ مفقود |
| 2 | اسم المنشأة (البائع) | `salonInfo.nameAr` | ✅ |
| 3 | عنوان المنشأة | `salonInfo.city + district + street + buildingNumber` | ❌ مفقود |
| 4 | الرقم الضريبي (15 رقم) | `salonInfo.taxNumber` | ✅ في الأسفل فقط |
| 5 | تاريخ ووقت الإصدار | `invoice.createdAt` | ✅ |
| 6 | رقم الفاتورة التسلسلي | `invoice.invoiceNumber` | ✅ |
| 7 | وصف السلع/الخدمات + الكمية + السعر | `invoiceItems` | ✅ |
| 8 | مبلغ الضريبة | `invoice.taxAmount` | ✅ |
| 9 | الإجمالي شامل الضريبة | `invoice.total` | ✅ |
| 10 | رمز QR (ZATCA TLV Base64) | حسابي | ✅ (5 حقول Phase 1) |

ملاحظة: بيانات المشتري (العميل) **غير إلزامية** في الفاتورة المبسطة.

---

## المرحلة 1: إصلاح PDF الفاتورة 🔴

### 1.1 التحول من PDFKit إلى HTML → PDF

**السبب:** PDFKit لا يدعم RTL. الحل هو إنشاء HTML template وتحويله لـ PDF عبر Puppeteer. المتصفح يتعامل مع العربي بشكل native.

#### ملف: `apps/api/src/shared/pdf/pdf.service.ts`
**الإجراء:** إعادة كتابة كاملة

1. حذف imports: `PDFDocument` (pdfkit), `ArabicReshaper`, `bidiFactory`
2. حذف الدالة `shapeArabic()` — لم تعد مطلوبة
3. إضافة import: `puppeteer` (أو `puppeteer-core`)
4. إعادة كتابة `generateInvoicePdf()`:
   - بناء HTML string من template
   - فتح Puppeteer browser → page
   - `page.setContent(html)` → `page.pdf({ format: 'A4' })`
   - إرجاع Buffer

**تنبيه Docker:** السيرفر يعمل في Docker. تأكد من:
- إضافة `chromium` أو `google-chrome-stable` في Dockerfile
- أو استخدام `puppeteer` (الذي يثبت Chromium تلقائياً)
- فحص `tooling/docker/` للـ Dockerfile الحالي

#### ملف جديد: `apps/api/src/shared/pdf/templates/invoice.template.ts`
**الإجراء:** إنشاء ملف جديد

يصدّر دالة:
```typescript
export function buildInvoiceHtml(data: {
  salonName: string;
  salonAddress: string;       // المدينة، الحي، الشارع، مبنى رقم X
  taxNumber: string | null;
  commercialRegistration: string | null;
  invoiceNumber: string;
  date: string;
  time: string;
  clientName: string;
  clientPhone: string;
  items: { description: string; quantity: number; unitPrice: number; totalPrice: number }[];
  subtotal: number;
  discountAmount: number;
  taxPercentage: number;
  taxAmount: number;
  total: number;
  paymentMethod: string | null;
  status: string;
  qrCodeDataUrl: string;     // base64 QR image
  primaryColor: string;
}): string
```

محتوى الـ HTML:
- `<!DOCTYPE html>` مع `<html dir="rtl" lang="ar">`
- CSS مضمن (inline styles) — لا يعتمد على ملفات خارجية
- خط عربي من Google Fonts: `@import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700&display=swap')`
  - أو كبديل: تضمين font-face بـ base64 لتجنب الاعتماد على الإنترنت
- تصميم نظيف واحترافي
- العنوان: **"فاتورة ضريبية مبسطة"** (إلزامي ZATCA)
- header يحتوي: اسم الصالون + العنوان الكامل + الرقم الضريبي + السجل التجاري
- جدول الأصناف بأعمدة: الوصف | الكمية | سعر الوحدة | المجموع
- ملخص: المجموع الفرعي → الخصم (لو موجود) → الضريبة → الإجمالي
- طريقة الدفع والحالة
- QR Code في المنتصف
- footer: "شكراً لزيارتكم 🌸"

#### ملف: `apps/api/src/shared/pdf/pdf.service.ts` — تحديث `generateInvoicePdf()`

الدالة الجديدة يجب أن تسحب من `salonInfo` الحقول التالية (بعضها لا يُسحب حالياً):
```typescript
const salonInfo = await db.salonInfo.findFirst();
// استخدم:
// salonInfo.nameAr
// salonInfo.taxNumber
// salonInfo.commercialRegistration  ← جديد
// salonInfo.city                    ← جديد
// salonInfo.district                ← جديد
// salonInfo.street                  ← جديد
// salonInfo.buildingNumber          ← جديد
// salonInfo.postalCode              ← جديد
```

بناء العنوان الكامل:
```typescript
const addressParts = [salonInfo.city, salonInfo.district, salonInfo.street, 
  salonInfo.buildingNumber ? `مبنى ${salonInfo.buildingNumber}` : null].filter(Boolean);
const fullAddress = addressParts.join('، ');
```

#### ملفات يمكن حذفها بعد التحول:
- `apps/api/src/shared/pdf/fonts/Amiri-Regular.ttf`
- `apps/api/src/shared/pdf/fonts/Amiri-Bold.ttf`
- مجلد `apps/api/src/shared/pdf/fonts/` بالكامل

#### Dependencies:
```bash
# إضافة
npm install puppeteer
# أو للبيئات الخفيفة:
npm install puppeteer-core

# حذف (بعد التأكد من عدم استخدامها في مكان آخر)
npm uninstall pdfkit @types/pdfkit arabic-reshaper bidi-js
```

### 1.2 تحديث QR Code

الـ QR Code الحالي يحتوي 5 حقول (ZATCA Phase 1). هذا كافٍ الآن.
لا تغيير مطلوب على `buildZatcaQrData()` — فقط تأكد من نقلها للملف الجديد أو الاحتفاظ بها.

---

## المرحلة 2: إعادة هيكلة تجربة الإعدادات 🟡

### 2.1 تنظيف صفحة "بيانات الصالون"

#### ملف: `apps/dashboard/src/app/(dashboard)/settings/salon/page.tsx`
**الإجراء:** تعديل

1. **حذف** قسم "البيانات الضريبية (ZATCA)" بالكامل (السطور ~139-173):
   - الـ div الذي يحتوي عنوان "البيانات الضريبية (ZATCA)"
   - حقول: taxNumber, commercialRegistration, street, district, buildingNumber, postalCode
   - تحذير "هذه البيانات مطلوبة لتفعيل الفوترة الإلكترونية"
2. **إبقاء** كل شي ثاني: اسم الصالون + التواصل + الموقع (address, city) + الوصف
3. **تحديث** schema (Zod): إزالة الحقول الضريبية من الـ validation
4. **تحديث** mutation: إزالة الحقول الضريبية من الـ API call
5. **تحديث** useEffect reset: إزالة الحقول الضريبية

### 2.2 إنشاء صفحة "الفوترة والضرائب"

#### ملف جديد: `apps/dashboard/src/app/(dashboard)/settings/billing/page.tsx`
**الإجراء:** إنشاء

صفحة جديدة بتصميم stepper بسيط تحتوي:

**القسم 1: البيانات الضريبية**
- نفس الحقول المحذوفة من صفحة الصالون:
  - الرقم الضريبي (VAT) — placeholder: "300000000000003"
  - السجل التجاري — placeholder: "1010000000"
  - الشارع — placeholder: "شارع الملك فهد"
  - الحي — placeholder: "حي العليا"
  - رقم المبنى — placeholder: "1234"
  - الرمز البريدي — placeholder: "12345"
- شريط حالة بصري في الأعلى:
  - ✅ "البيانات مكتملة" (أخضر) — لو كل الحقول المطلوبة معبأة
  - ⚠️ "بيانات ناقصة" (أصفر) — مع توضيح أي حقل ناقص
- نفس API: `GET /salon` و `PUT /salon` (نفس الـ endpoint الحالي)

**القسم 2: تفعيل الفوترة الإلكترونية**
- يظهر فقط إذا البيانات الضريبية مكتملة
- نقل محتوى صفحة ZATCA القديمة هنا:
  - حالة التفعيل (✅ مفعّل / ⚠️ غير مفعّل)
  - عدد الشهادات
  - زر "تفعيل" يفتح نموذج OTP
  - قائمة الشهادات المسجلة
- **تبسيط المصطلحات:**
  - "OTP" → "رمز التحقق"
  - "CSR" → لا يظهر للعميلة
  - "Sandbox" → "بيئة تجريبية"
  - "Onboard" → "تفعيل"
- شرح الخطوات بالعربي البسيط:
  1. "ادخلي على موقع هيئة الزكاة واطلبي رمز التحقق"
  2. "الصقي الرمز هنا"
  3. "تم التفعيل! ✅"
- كارد "متطلبات الامتثال" — نقله من الصفحة القديمة

### 2.3 تحديث السايدبار

#### ملف: `apps/dashboard/src/components/layout/Sidebar.tsx`
**الإجراء:** تعديل

- البحث عن عنصر "ZATCA" في قائمة السايدبار
- تغيير:
  - الاسم: `"ZATCA"` → `"الفوترة والضرائب"`
  - الأيقونة: استخدام `Receipt` بدل الأيقونة الحالية
  - الرابط: `"/zatca"` → `"/settings/billing"`
- أو إذا كان ZATCA تحت الإعدادات أصلاً، نقل العنصر ليكون sub-item تحت الإعدادات

#### ملف: `apps/dashboard/src/components/layout/BottomNav.tsx`
**الإجراء:** فحص — لو فيه رابط ZATCA، نفس التغيير

### 2.4 تحديث صفحة الإعدادات الرئيسية

#### ملف: `apps/dashboard/src/app/(dashboard)/settings/page.tsx`
**الإجراء:** تعديل

- تغيير وصف كارد "بيانات الصالون" — إزالة أي ذكر للضرائب
- إضافة كارد جديد: "الفوترة والضرائب" 🧾
  - الوصف: "الرقم الضريبي، الفوترة الإلكترونية"
  - الرابط: `/settings/billing`
  - أيقونة: `Receipt` بلون بنفسجي

### 2.5 حذف صفحة ZATCA القديمة

#### ملف: `apps/dashboard/src/app/(dashboard)/zatca/page.tsx`
**الإجراء:** حذف

بعد التأكد من نقل كل المحتوى للصفحة الجديدة.

---

## المرحلة 3: تحسينات إضافية 🟢

### 3.1 Validation عند إرسال الفاتورة

#### ملف: `apps/api/src/modules/salon/invoices/invoices.service.ts`
**الإجراء:** تعديل `sendInvoice()` method

قبل توليد PDF، فحص اكتمال البيانات:
```typescript
const salonInfo = await db.salonInfo.findFirst();
const missingFields: string[] = [];
if (!salonInfo?.taxNumber) missingFields.push('الرقم الضريبي');
if (!salonInfo?.street) missingFields.push('الشارع');
if (!salonInfo?.city && !salonInfo?.district) missingFields.push('العنوان');

if (missingFields.length > 0) {
  this.logger.warn(`Invoice ${invoiceId}: Missing ZATCA fields: ${missingFields.join(', ')}`);
  // لا نمنع الإرسال — فقط warning في الـ log
}
```

### 3.2 تحسين رسالة واتساب

#### ملف: `apps/api/src/modules/salon/invoices/invoices.service.ts`
**الإجراء:** تعديل `buildInvoiceWhatsAppCaption()`

إضافة في أعلى الرسالة:
```
فاتورة ضريبية مبسطة
*اسم الصالون*
الرقم الضريبي: XXXXXXXXXXXXXXX
──────────────
فاتورة رقم: INV-0118
...
```

---

## ملاحظات تنفيذية

1. **Docker:** فحص `tooling/docker/Dockerfile` لإضافة Chromium إذا لزم الأمر
2. **الخطوط:** بما أننا ننتقل لـ HTML، نستخدم Google Fonts (Cairo أو Noto Sans Arabic) بدل ملفات TTF المحلية
3. **الأداء:** Puppeteer browser يجب أن يكون singleton أو يُستخدم connection pool لتجنب فتح browser جديد لكل فاتورة
4. **الفاتورة عربي فقط** (ليست ثنائية اللغة)
5. **الرابط `/zatca` القديم:** أضف redirect من `/zatca` إلى `/settings/billing` لتجنب كسر bookmarks

---

## ترتيب التنفيذ المقترح

```
1.1 → 1.2 → 1.3 (PDF أولاً — الأهم)
    ↓
2.1 → 2.2 → 2.3 → 2.4 → 2.5 (UX ثانياً)
    ↓
3.1 → 3.2 (تحسينات أخيراً)
```
