#!/usr/bin/env python3
"""Update Gemini API credential with new key via n8n API."""
import json, subprocess

N8N_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJiY2EwYWFlZS0yZmJlLTQ1MTUtYmVjYy0wMWQ5Y2ZlYWUzNWIiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiOWE2MGQ3Y2MtMzUyOS00NDIwLWEwM2YtYjc4OTA1NWNjZmRmIiwiaWF0IjoxNzc2OTUxNDYzfQ.WD4fxPJDWS6QYWHknyp6hDxHtBKVAEUfWzZLU6YEo14"
N8N_IP = subprocess.run(
    ["sudo", "docker", "inspect", "servix-n8n", "--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"],
    capture_output=True, text=True
).stdout.strip()
BASE = f"http://{N8N_IP}:5678/api/v1"

CRED_ID = "cred-gemini-004"
NEW_KEY = "AIzaSyByE90lHH7OAbjlHohdAocoy3o0_V5TrN8"

# Update via PATCH
payload = json.dumps({
    "name": "Gemini API",
    "type": "httpQueryAuth",
    "data": {
        "name": "key",
        "value": NEW_KEY
    }
})

r = subprocess.run(
    ["curl", "-s", "--max-time", "15", "-X", "PATCH",
     f"{BASE}/credentials/{CRED_ID}",
     "-H", f"X-N8N-API-KEY: {N8N_API_KEY}",
     "-H", "Content-Type: application/json",
     "-d", payload],
    capture_output=True, text=True
)

print(f"Response: {r.stdout[:500]}")

# Verify: test Gemini directly
print("\n=== Testing Gemini API directly ===")
test = subprocess.run(
    ["curl", "-s", "--max-time", "15",
     f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key={NEW_KEY}",
     "-H", "Content-Type: application/json",
     "-d", json.dumps({"contents": [{"parts": [{"text": "Say hello in Arabic, one line"}]}]})],
    capture_output=True, text=True
)

try:
    resp = json.loads(test.stdout)
    if "candidates" in resp:
        text = resp["candidates"][0]["content"]["parts"][0]["text"]
        print(f"  ✅ Gemini works: {text[:100]}")
    elif "error" in resp:
        print(f"  ❌ Gemini error: {resp['error'].get('message', '')[:200]}")
except:
    print(f"  ❌ Parse error: {test.stdout[:200]}")
