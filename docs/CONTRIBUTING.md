# دليل المساهمة — SERVIX

## معايير الكود

### الإلزامي
- ✅ ESLint + Prettier بدون أخطاء
- ✅ كل ملف جديد يحتاج ملف اختبار مقابل (.spec.ts)
- ✅ تغطية الملف الجديد ≥ 80%
- ✅ كل endpoint جديد يحتاج `@ApiProperty` على DTOs
- ✅ TypeScript strict mode بدون `any` إلا لسبب موثق

### المُستحسن
- 💡 كل مكون UI جديد يحتاج Story في Storybook
- 💡 كل قرار معماري يحتاج ADR في `docs/adr/`
- 💡 استخدم Feature Flags للميزات الجديدة

## أسلوب Commit

نستخدم [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[body]

[footer]
```

### الأنواع

| النوع | الاستخدام |
|-------|----------|
| `feat` | ميزة جديدة |
| `fix` | إصلاح خطأ |
| `refactor` | إعادة هيكلة بدون تغيير سلوك |
| `test` | إضافة/تعديل اختبارات |
| `docs` | وثائق فقط |
| `chore` | مهام صيانة (deps, CI, config) |
| `perf` | تحسين أداء |
| `ci` | تغييرات CI/CD |

### أمثلة
```
feat(bookings): add recurring appointment support
fix(auth): prevent token refresh race condition
test(zatca): add XML builder edge case tests
docs(adr): add ADR-013 for caching strategy
```

## مراجعة الكود

### القواعد
1. كل PR يحتاج **مراجعة واحدة** على الأقل
2. CI يجب أن يمر بالكامل:
   - ✅ Tests (Jest + Vitest)
   - ✅ Lint (ESLint)
   - ✅ Type check (tsc --noEmit)
   - ✅ Coverage thresholds
3. لا breaking changes بدون ADR
4. لا `console.log` — استخدم `Logger`
5. لا hard-coded secrets أو credentials

### نصائح للمراجع
- ركّز على المنطق وليس التنسيق (Prettier يتكفل بالتنسيق)
- تحقق من edge cases في الاختبارات
- تحقق من أمان الـ tenant isolation

## هيكل Branch

```
main              # الإنتاج
├── staging       # بيئة الاختبار
└── feat/*        # ميزات جديدة
    fix/*         # إصلاحات
    test/*        # اختبارات
    docs/*        # وثائق
    refactor/*    # إعادة هيكلة
```

## كيفية إضافة ميزة جديدة

1. **Branch**: `git checkout -b feat/feature-name`
2. **Code**: اكتب الكود مع الاختبارات
3. **Test**: `pnpm test` + `pnpm lint`
4. **Commit**: استخدم conventional commits
5. **Push**: `git push origin feat/feature-name`
6. **PR**: افتح PR مع وصف واضح
7. **Review**: انتظر مراجعة واحدة على الأقل
8. **Merge**: Squash and merge

## الإبلاغ عن مشاكل

استخدم GitHub Issues مع:
- وصف واضح للمشكلة
- خطوات إعادة الإنتاج
- البيئة (OS, Node version, Browser)
- لقطات شاشة إن أمكن
