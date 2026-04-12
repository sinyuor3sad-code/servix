-- ═══════════════════════════════════════════
-- SERVIX: Seed AI Features for مميز (Premium) Plan
-- Run this on the platform database
-- ═══════════════════════════════════════════

-- 1. Create AI features if they don't exist
INSERT INTO "Feature" ("id", "code", "nameAr", "descriptionAr", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'whatsapp-bot', 'بوت واتساب الذكي', 'بوت الذكاء الاصطناعي للرد التلقائي على عملاء الواتساب', NOW(), NOW()),
  (gen_random_uuid(), 'ai-consultant', 'المستشار الذكي', 'مستشار أعمال ذكي لتحليل بيانات الصالون وتقديم النصائح', NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- 2. Link AI features to مميز plan only
INSERT INTO "PlanFeature" ("id", "planId", "featureId", "createdAt")
SELECT gen_random_uuid(), p.id, f.id, NOW()
FROM "Plan" p, "Feature" f
WHERE p."nameAr" = 'مميز'
  AND f."code" IN ('whatsapp-bot', 'ai-consultant')
  AND NOT EXISTS (
    SELECT 1 FROM "PlanFeature" pf
    WHERE pf."planId" = p.id AND pf."featureId" = f.id
  );

-- 3. Verify
SELECT p."nameAr" AS plan, f."code" AS feature, f."nameAr" AS feature_name
FROM "PlanFeature" pf
JOIN "Plan" p ON p.id = pf."planId"
JOIN "Feature" f ON f.id = pf."featureId"
WHERE f."code" IN ('whatsapp-bot', 'ai-consultant')
ORDER BY p."nameAr", f."code";
