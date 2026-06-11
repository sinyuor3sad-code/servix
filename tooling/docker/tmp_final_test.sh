#!/bin/bash
cat > /tmp/test_valid.json << 'EOF'
{"tenantId":"test-001","phone":"966500000000","message":"book haircut Saturday","context":{"salonName":"Test Salon","services":[{"name":"Haircut","price":50,"duration":30}],"workingHours":"9AM-10PM"}}
EOF

echo "=== Payload ==="
cat /tmp/test_valid.json
echo ""

echo "=== TEST: Valid ==="
curl -s --max-time 90 -X POST 'http://172.18.0.22:5678/webhook/servix-ai-reception' \
  -H 'Content-Type: application/json' \
  -d @/tmp/test_valid.json 2>&1
echo ""

echo ""
echo "=== TEST: Bad Request ==="
curl -s --max-time 10 -X POST 'http://172.18.0.22:5678/webhook/servix-ai-reception' \
  -H 'Content-Type: application/json' \
  -d '{"phone":"966500000000"}' 2>&1
echo ""
