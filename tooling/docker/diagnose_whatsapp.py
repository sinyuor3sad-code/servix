#!/usr/bin/env python3
"""Diagnose WhatsApp QR code issue."""
import json, subprocess, sys

EVO_KEY = "3b4d9a8d92c02f85714b48ad9d59b1012839f0ad4523f58c65d476b2ede76c12"

def evo_api(path, method="GET", data=None):
    """Call Evolution API from nginx container."""
    cmd = ["sudo", "docker", "exec", "servix-nginx", "curl", "-s", "--max-time", "10",
           f"http://evolution-api:8080{path}", "-H", f"apikey: {EVO_KEY}"]
    if method == "POST":
        cmd.extend(["-X", "POST", "-H", "Content-Type: application/json"])
        if data:
            cmd.extend(["-d", json.dumps(data)])
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout

def servix_api(path):
    """Call Servix API."""
    cmd = ["sudo", "docker", "exec", "servix-nginx", "curl", "-s", "--max-time", "10",
           f"http://api-1:4000{path}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    return r.stdout

# 1. Check Evolution API instances
print("=" * 60)
print("1. EVOLUTION API INSTANCES")
print("=" * 60)
raw = evo_api("/instance/fetchInstances")
try:
    instances = json.loads(raw)
    if isinstance(instances, list):
        for inst in instances:
            info = inst.get("instance", {})
            name = info.get("instanceName", "?")
            status = info.get("status", "?")
            owner = info.get("owner", "?")
            print(f"  {name}: status={status}, owner={owner}")
    else:
        print(f"  Response: {raw[:300]}")
except:
    print(f"  Raw: {raw[:300]}")

# 2. Check WhatsApp settings API endpoint
print(f"\n{'=' * 60}")
print("2. SERVIX API - WhatsApp endpoints")
print(f"{'=' * 60}")

# Check if the API has whatsapp routes
api_check = servix_api("/api/health")
print(f"  API health: {api_check[:100]}")

# 3. Check API logs for QR errors
print(f"\n{'=' * 60}")
print("3. API LOGS (WhatsApp related)")
print(f"{'=' * 60}")
r = subprocess.run(
    ["sudo", "docker", "logs", "servix-api-1", "--tail", "100", "--since", "1h"],
    capture_output=True, text=True
)
logs = r.stdout + r.stderr
for line in logs.split("\n"):
    lower = line.lower()
    if any(kw in lower for kw in ["whatsapp", "qr", "evolution", "wa_", "instance"]):
        print(f"  {line.strip()[:200]}")

# 4. Check Evolution API connectivity from API container
print(f"\n{'=' * 60}")
print("4. API → EVOLUTION connectivity")
print(f"{'=' * 60}")
r = subprocess.run(
    ["sudo", "docker", "exec", "servix-api-1", "curl", "-s", "--max-time", "5",
     "http://evolution-api:8080/instance/fetchInstances",
     "-H", f"apikey: {EVO_KEY}"],
    capture_output=True, text=True
)
try:
    data = json.loads(r.stdout)
    print(f"  API→Evolution: OK ({len(data)} instances)")
except:
    print(f"  API→Evolution: {r.stdout[:200]} | err: {r.stderr[:200]}")

# 5. Try to create instance and get QR
print(f"\n{'=' * 60}")
print("5. QR CODE TEST - Create instance")
print(f"{'=' * 60}")
test_instance = "test-qr-diagnostic"
# First delete if exists
evo_api(f"/instance/delete/{test_instance}", method="POST")

# Create instance
create_data = {
    "instanceName": test_instance,
    "qrcode": True,
    "integration": "WHATSAPP-BAILEYS"
}
create_resp = evo_api("/instance/create", method="POST", data=create_data)
try:
    resp = json.loads(create_resp)
    if "qrcode" in resp:
        qr = resp["qrcode"]
        if isinstance(qr, dict):
            base64_qr = qr.get("base64", "")
            code = qr.get("code", "")
            print(f"  QR base64: {'YES (' + str(len(base64_qr)) + ' chars)' if base64_qr else 'NO'}")
            print(f"  QR code: {'YES' if code else 'NO'}")
        else:
            print(f"  QR: {str(qr)[:200]}")
    else:
        print(f"  No QR in response. Keys: {list(resp.keys()) if isinstance(resp, dict) else '?'}")
        print(f"  Response: {json.dumps(resp, ensure_ascii=False)[:300]}")
except:
    print(f"  Raw: {create_resp[:300]}")

# Cleanup
evo_api(f"/instance/delete/{test_instance}", method="POST")
print(f"  Cleaned up test instance")

# 6. Check .env for Evolution settings
print(f"\n{'=' * 60}")
print("6. ENVIRONMENT CONFIG")
print(f"{'=' * 60}")
r = subprocess.run(["sudo", "grep", "-iE", "EVOLUTION|WHATSAPP|WA_", "/root/servix/tooling/docker/.env"],
                   capture_output=True, text=True)
for line in r.stdout.strip().split("\n"):
    if "KEY" in line.upper() or "SECRET" in line.upper() or "PASSWORD" in line.upper():
        key, _, val = line.partition("=")
        print(f"  {key}={val[:8]}...{val[-4:]}" if len(val) > 12 else f"  {line}")
    else:
        print(f"  {line}")

print(f"\n{'=' * 60}")
print("DIAGNOSIS COMPLETE")
print(f"{'=' * 60}")
