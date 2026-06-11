#!/bin/bash
# Test with INSTANCE TOKEN (not master key) — this is what the app uses
INSTANCE="salon-dantila-d0f48d47-ee6892"

# Get the full token from DB
TOKEN=$(docker exec servix-api node -e '
const p = require("./generated/platform");
const c = new p.PrismaClient();
c.whatsAppInstance.findFirst({where:{instanceName:"salon-dantila-d0f48d47-ee6892"},select:{instanceToken:true}})
  .then(r => { console.log(r.instanceToken); c.$disconnect(); })
  .catch(e => { console.error(e.message); c.$disconnect(); });
')

echo "TOKEN: ${TOKEN:0:12}..."

# Test sendText with INSTANCE TOKEN
echo "=== Test sendText with instance token ==="
docker exec servix-evolution curl -s -X POST \
  -H "apikey: $TOKEN" \
  -H "Content-Type: application/json" \
  "http://localhost:8080/message/sendText/$INSTANCE" \
  -d '{"number":"966595518338","text":"test with instance token"}'

echo ""
echo "=== Done ==="
