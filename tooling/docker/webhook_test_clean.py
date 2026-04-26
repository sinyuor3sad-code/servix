#!/usr/bin/env python3
"""Clean webhook test - generates JSON properly and tests via curl."""
import json
import subprocess

payload = {
    "tenantId": "test-001",
    "phone": "966500000000",
    "message": "I want to book a haircut on Saturday",
    "context": {
        "salonName": "Elegance Salon",
        "services": [{"name": "Haircut", "price": 50, "duration": 30}],
        "workingHours": "9AM-10PM"
    }
}

bad_payload = {"phone": "966500000000"}

# Get n8n IP
ip_result = subprocess.run(
    ["sudo", "docker", "inspect", "servix-n8n", "--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"],
    capture_output=True, text=True
)
n8n_ip = ip_result.stdout.strip()
url = f"http://{n8n_ip}:5678/webhook/servix-ai-reception"

print(f"n8n IP: {n8n_ip}")
print(f"URL: {url}")

# Write clean JSON to file
with open("/tmp/payload_clean.json", "w") as f:
    json.dump(payload, f)

print(f"\nPayload: {json.dumps(payload)}")

# Test 1: Valid request
print("\n" + "=" * 50)
print("TEST 1: Valid Request")
print("=" * 50)
result = subprocess.run(
    ["curl", "-s", "--max-time", "90", "-w", "\nHTTP_CODE:%{http_code}",
     "-X", "POST", url,
     "-H", "Content-Type: application/json",
     "-d", json.dumps(payload)],
    capture_output=True, text=True
)
print(f"stdout: {result.stdout}")
print(f"stderr: {result.stderr}")

# Test 2: Bad request
print("\n" + "=" * 50)
print("TEST 2: Bad Request (missing fields)")
print("=" * 50)
result2 = subprocess.run(
    ["curl", "-s", "--max-time", "10", "-w", "\nHTTP_CODE:%{http_code}",
     "-X", "POST", url,
     "-H", "Content-Type: application/json",
     "-d", json.dumps(bad_payload)],
    capture_output=True, text=True
)
print(f"stdout: {result2.stdout}")
print(f"stderr: {result2.stderr}")
