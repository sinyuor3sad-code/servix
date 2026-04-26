#!/bin/bash
set -euo pipefail

echo "=== TEST 1: Valid request ==="
RESULT=$(sudo docker exec servix-n8n wget -qO- --post-data='{
  "tenantId": "test-001",
  "phone": "966500000000",
  "message": "Hello I want to book a haircut Saturday",
  "context": {
    "salonName": "Elegance Salon",
    "services": [{"name": "Haircut", "price": 50, "duration": 30}],
    "workingHours": "9AM-10PM"
  }
}' --header='Content-Type: application/json' --timeout=60 'http://127.0.0.1:5678/webhook/servix-ai-reception' 2>&1) || true
echo "$RESULT" | head -c 500
echo ""

echo ""
echo "=== TEST 2: Missing fields ==="
RESULT2=$(sudo docker exec servix-n8n wget -qO- --post-data='{"phone": "966500000000"}' --header='Content-Type: application/json' --timeout=10 'http://127.0.0.1:5678/webhook/servix-ai-reception' 2>&1) || true
echo "$RESULT2" | head -c 300
echo ""

echo ""
echo "=== DONE ==="
