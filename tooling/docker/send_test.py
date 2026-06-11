#!/usr/bin/env python3
import json, subprocess

payload = json.dumps({
    "tenantId": "test-001",
    "phone": "966500000000",
    "message": "I want to book a haircut Saturday",
    "context": {
        "salonName": "Elegance Salon",
        "services": [{"name": "Haircut", "price": 50, "duration": 30}],
        "workingHours": "9AM-10PM"
    }
})

r = subprocess.run(
    ["curl", "-s", "--max-time", "90", "-X", "POST",
     "http://172.18.0.22:5678/webhook-test/servix-ai-reception",
     "-H", "Content-Type: application/json",
     "-d", payload],
    capture_output=True, text=True
)
print("Response:", r.stdout[:500])
