#!/bin/bash
set -euo pipefail

WF_ID="wf-servix-ai-reception-0005"
VERSION_ID="c8b988b6-75b4-4c47-b3f6-53a7d121ef41"
PSQL="sudo docker exec servix-postgres psql -U servix -d n8n_db"

echo "=== Current activeVersionId ==="
$PSQL -t -A -c "SELECT \"activeVersionId\" FROM workflow_entity WHERE id = '$WF_ID';"

echo ""
echo "=== Setting activeVersionId ==="
$PSQL -c "UPDATE workflow_entity SET \"activeVersionId\" = '$VERSION_ID' WHERE id = '$WF_ID';"

echo ""
echo "=== Verify ==="
$PSQL -t -A -c "SELECT id, active, \"activeVersionId\" FROM workflow_entity WHERE id = '$WF_ID';"
$PSQL -t -A -c "SELECT * FROM workflow_published_version;"

echo ""
echo "=== Restarting n8n ==="
sudo docker restart servix-n8n
echo "RESTARTED"
sleep 20

echo ""
echo "=== Check logs ==="
sudo docker logs servix-n8n --tail 20 2>&1 | grep -iE 'webhook|active|publish|draft|error' | tail -10

echo ""
echo "=== Test webhook ==="
sudo docker exec servix-n8n wget -qO- --post-data='{"tenantId":"test-001","phone":"966500000000","message":"Hello","context":{"salonName":"Test","services":[],"workingHours":"9-5"}}' --header='Content-Type: application/json' --timeout=60 'http://127.0.0.1:5678/webhook/servix-ai-reception' 2>&1 | head -c 500
echo ""
echo "=== DONE ==="
