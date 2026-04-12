#!/bin/bash
# Seed AI features for مميز plan

PGUSER=servix
PGDB=servix_platform

# Insert features
docker exec -i servix-postgres psql -U $PGUSER -d $PGDB <<'EOF'
INSERT INTO features (id, code, name_ar, description_ar, updated_at)
VALUES
  (gen_random_uuid(), 'whatsapp-bot', 'بوت واتساب الذكي', 'بوت الذكاء الاصطناعي للرد التلقائي على عملاء الواتساب', NOW()),
  (gen_random_uuid(), 'ai-consultant', 'المستشار الذكي', 'مستشار أعمال ذكي لتحليل بيانات الصالون', NOW())
ON CONFLICT (code) DO NOTHING;

-- Link to مميز plan
INSERT INTO plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM plans p, features f
WHERE p.name_ar = 'مميز'
  AND f.code IN ('whatsapp-bot', 'ai-consultant')
  AND NOT EXISTS (
    SELECT 1 FROM plan_features pf
    WHERE pf.plan_id = p.id AND pf.feature_id = f.id
  );

-- Verify
SELECT p.name_ar AS plan, f.code, f.name_ar AS feature
FROM plan_features pf
JOIN plans p ON p.id = pf.plan_id
JOIN features f ON f.id = pf.feature_id
WHERE f.code IN ('whatsapp-bot', 'ai-consultant');
EOF
