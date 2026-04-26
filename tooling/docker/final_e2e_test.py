#!/usr/bin/env python3
"""Full end-to-end test of AI Reception webhook."""
import json, subprocess

ip = subprocess.run(
    ["sudo", "docker", "inspect", "servix-n8n", "--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"],
    capture_output=True, text=True
).stdout.strip()

URL = f"http://{ip}:5678/webhook/servix-ai-reception"
print(f"n8n URL: {URL}\n")

tests = [
    {
        "name": "🧪 TEST 1: طلب عربي (حجز)",
        "data": {
            "tenantId": "test-001",
            "phone": "966500000000",
            "message": "ابي احجز قص شعر يوم السبت الساعه 5",
            "context": {
                "salonName": "صالون الأناقة",
                "services": [
                    {"name": "قص شعر", "price": 50, "duration": 30},
                    {"name": "صبغة", "price": 150, "duration": 60}
                ],
                "workingHours": "9AM-10PM"
            }
        }
    },
    {
        "name": "🧪 TEST 2: English (service inquiry)",
        "data": {
            "tenantId": "test-002",
            "phone": "966511111111",
            "message": "What services do you offer and how much?",
            "context": {
                "salonName": "Elegance Salon",
                "services": [
                    {"name": "Haircut", "price": 50, "duration": 30},
                    {"name": "Beard Trim", "price": 25, "duration": 15},
                    {"name": "Hair Color", "price": 150, "duration": 60}
                ],
                "workingHours": "9AM-10PM"
            }
        }
    },
    {
        "name": "🧪 TEST 3: Bad Request (missing fields)",
        "data": {"phone": "966500000000"}
    }
]

for t in tests:
    print(f"\n{'='*60}")
    print(t["name"])
    print(f"{'='*60}")
    
    r = subprocess.run(
        ["curl", "-s", "--max-time", "90", "-w", "\nHTTP_CODE:%{http_code}",
         "-X", "POST", URL, "-H", "Content-Type: application/json",
         "-d", json.dumps(t["data"], ensure_ascii=False)],
        capture_output=True, text=True
    )
    
    output = r.stdout
    lines = output.strip().split("\n")
    http_code = ""
    body = ""
    for line in lines:
        if line.startswith("HTTP_CODE:"):
            http_code = line.split(":")[1]
        else:
            body += line
    
    print(f"  HTTP: {http_code}")
    
    try:
        resp = json.loads(body)
        print(f"  success: {resp.get('success')}")
        print(f"  intent:  {resp.get('intent', resp.get('error', '?'))}")
        reply = resp.get("reply", "")
        if reply:
            print(f"  reply:   {reply}")
        action = resp.get("proposedAction")
        if action:
            print(f"  action:  {json.dumps(action, ensure_ascii=False)}")
        error = resp.get("error")
        if error:
            print(f"  error:   {error}")
    except:
        print(f"  raw: {body[:300]}")

print(f"\n{'='*60}")
print("✅ ALL TESTS COMPLETE")
print(f"{'='*60}")
