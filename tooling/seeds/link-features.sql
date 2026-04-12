INSERT INTO plan_features (plan_id, feature_id)
SELECT p.id, f.id
FROM plans p, features f
WHERE p.name_ar = 'متميز'
  AND f.code IN ('whatsapp-bot', 'ai-consultant')
  AND NOT EXISTS (
    SELECT 1 FROM plan_features pf
    WHERE pf.plan_id = p.id AND pf.feature_id = f.id
  );

SELECT p.name_ar AS plan, f.code, f.name_ar AS feature
FROM plan_features pf
JOIN plans p ON p.id = pf.plan_id
JOIN features f ON f.id = pf.feature_id
WHERE f.code IN ('whatsapp-bot', 'ai-consultant');
