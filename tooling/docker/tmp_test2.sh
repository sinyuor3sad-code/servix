#!/bin/bash
set -euo pipefail

# Create test payload
cat > /tmp/test_payload.json << 'JSONEOF'
{
  "tenantId": "test-001",
  "phone": "966500000000",
  "message": "Hello I want to book a haircut Saturday",
  "context": {
    "salonName": "Elegance Salon",
    "services": [{"name": "Haircut", "price": 50, "duration": 30}],
    "workingHours": "9AM-10PM"
  }
}
JSONEOF

# Copy into n8n container
sudo docker cp /tmp/test_payload.json servix-n8n:/tmp/test_payload.json

echo "=== TEST: Valid request ==="
sudo docker exec servix-n8n wget -qO- \
  --post-file=/tmp/test_payload.json \
  --header='Content-Type: application/json' \
  --timeout=90 \
  'http://127.0.0.1:5678/webhook/servix-ai-reception' 2>&1 || echo "WGET_EXIT: $?"

echo ""
echo ""

# Test 2: bad request
cat > /tmp/test_bad.json << 'JSONEOF'
{"phone": "966500000000"}
JSONEOF
sudo docker cp /tmp/test_bad.json servix-n8n:/tmp/test_bad.json

echo "=== TEST: Bad request ==="
sudo docker exec servix-n8n wget -qO- \
  --post-file=/tmp/test_bad.json \
  --header='Content-Type: application/json' \
  --timeout=10 \
  'http://127.0.0.1:5678/webhook/servix-ai-reception' 2>&1 || echo "WGET_EXIT: $?"
