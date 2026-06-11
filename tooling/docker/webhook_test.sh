#!/bin/bash
echo "=== TEST 1: Valid Request ==="
curl -s --max-time 90 -X POST http://172.18.0.22:5678/webhook/servix-ai-reception \
  -H 'Content-Type: application/json' \
  -d '{"tenantId":"test-001","phone":"966500000000","message":"I want to book a haircut on Saturday","context":{"salonName":"Elegance Salon","services":[{"name":"Haircut","price":50,"duration":30}],"workingHours":"9AM-10PM"}}' \
  > /tmp/test_result.txt 2>&1
echo "HTTP exit: $?"
echo "Response:"
cat /tmp/test_result.txt
echo ""
echo ""
echo "=== TEST 2: Bad Request ==="
curl -s --max-time 10 -X POST http://172.18.0.22:5678/webhook/servix-ai-reception \
  -H 'Content-Type: application/json' \
  -d '{"phone":"966500000000"}'
echo ""
