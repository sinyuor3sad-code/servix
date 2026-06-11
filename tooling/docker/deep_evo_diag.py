#!/usr/bin/env python3
"""Deep diagnosis of Evolution API QR code issue."""
import json, subprocess

EVO_KEY = "3b4d9a8d92c02f85714b48ad9d59b1012839f0ad4523f58c65d476b2ede76c12"

def evo_via_nginx(path):
    r = subprocess.run(
        ["sudo", "docker", "exec", "servix-nginx", "curl", "-s", "--max-time", "30",
         f"http://evolution-api:8080{path}",
         "-H", f"apikey: {EVO_KEY}"],
        capture_output=True, text=True
    )
    return r.stdout

# 1. Version
print("=== Evolution Version ===")
r = subprocess.run(["sudo", "docker", "exec", "servix-evolution", "cat", "package.json"],
                   capture_output=True, text=True)
try:
    print(f"  Version: {json.loads(r.stdout).get('version', '?')}")
except:
    print(f"  Could not read version")

# 2. Fetch instances
print("\n=== Instances ===")
raw = evo_via_nginx("/instance/fetchInstances")
try:
    instances = json.loads(raw)
    for inst in instances:
        i = inst.get("instance", {})
        print(f"  Name: {i.get('instanceName')}")
        print(f"  Status: {i.get('status')}")
        print(f"  Owner: {i.get('owner')}")
        print(f"  Integration: {i.get('integration')}")
        # Check for connectionStatus
        cs = inst.get("instance", {}).get("connectionStatus")
        if cs:
            print(f"  ConnectionStatus: {cs}")
except Exception as e:
    print(f"  Error: {e}")
    print(f"  Raw: {raw[:300]}")

# 3. Connect endpoint (this generates QR)
print("\n=== Connect (QR generation) ===")
instance_name = "salon-dantila-d0f48d47"
connect_raw = evo_via_nginx(f"/instance/connect/{instance_name}")
try:
    data = json.loads(connect_raw)
    print(f"  Keys: {list(data.keys())}")
    base64 = data.get("base64", "")
    code = data.get("code", "")
    count = data.get("count")
    print(f"  base64: {'YES (' + str(len(base64)) + ' chars)' if base64 else 'NO'}")
    print(f"  code: {'YES' if code else 'NO'}")
    print(f"  count: {count}")
    if not base64 and not code:
        print(f"  Full response: {json.dumps(data, ensure_ascii=False)[:500]}")
except Exception as e:
    print(f"  Error parsing: {e}")
    print(f"  Raw: {connect_raw[:300]}")

# 4. Wait 5 seconds and try again (sometimes QR needs time)
import time
print("\n=== Waiting 5s and retrying connect ===")
time.sleep(5)
connect_raw2 = evo_via_nginx(f"/instance/connect/{instance_name}")
try:
    data2 = json.loads(connect_raw2)
    base64_2 = data2.get("base64", "")
    code_2 = data2.get("code", "")
    count_2 = data2.get("count")
    print(f"  base64: {'YES (' + str(len(base64_2)) + ' chars)' if base64_2 else 'NO'}")
    print(f"  code: {'YES' if code_2 else 'NO'}")
    print(f"  count: {count_2}")
    if not base64_2 and not code_2:
        print(f"  Full: {json.dumps(data2, ensure_ascii=False)[:500]}")
except:
    print(f"  Raw: {connect_raw2[:300]}")

# 5. Delete and recreate fresh
print("\n=== Delete & Recreate fresh ===")
test_name = "test-qr-fresh"
# Delete if exists
evo_via_nginx(f"/instance/delete/{test_name}")
time.sleep(1)

# Create with POST
create_r = subprocess.run(
    ["sudo", "docker", "exec", "servix-nginx", "curl", "-s", "--max-time", "30",
     "-X", "POST", "http://evolution-api:8080/instance/create",
     "-H", f"apikey: {EVO_KEY}",
     "-H", "Content-Type: application/json",
     "-d", json.dumps({
         "instanceName": test_name,
         "qrcode": True,
         "integration": "WHATSAPP-BAILEYS"
     })],
    capture_output=True, text=True
)
print(f"  Create response:")
try:
    cr = json.loads(create_r.stdout)
    print(f"    Keys: {list(cr.keys())}")
    if "qrcode" in cr:
        qr = cr["qrcode"]
        if isinstance(qr, dict):
            print(f"    QR keys: {list(qr.keys())}")
            print(f"    base64: {'YES (' + str(len(qr.get('base64',''))) + ')' if qr.get('base64') else 'NO'}")
            print(f"    code: {'YES' if qr.get('code') else 'NO'}")
        else:
            print(f"    QR: {str(qr)[:200]}")
    if "instance" in cr:
        print(f"    Instance: {json.dumps(cr['instance'])[:200]}")
    if "hash" in cr:
        print(f"    Hash: {json.dumps(cr['hash'])[:100]}")
    # Print full if QR missing
    if "qrcode" not in cr:
        print(f"    Full: {json.dumps(cr, ensure_ascii=False)[:500]}")
except:
    print(f"    Raw: {create_r.stdout[:500]}")

# Wait and connect
time.sleep(3)
print("\n  Connect after create:")
connect_new = evo_via_nginx(f"/instance/connect/{test_name}")
try:
    d = json.loads(connect_new)
    b64 = d.get("base64", "")
    print(f"    base64: {'YES (' + str(len(b64)) + ')' if b64 else 'NO'}")
    print(f"    code: {'YES' if d.get('code') else 'NO'}")
    print(f"    count: {d.get('count')}")
    if not b64 and not d.get("code"):
        print(f"    Full: {json.dumps(d)[:300]}")
except:
    print(f"    Raw: {connect_new[:300]}")

# Cleanup
evo_via_nginx(f"/instance/delete/{test_name}")

# 6. Check Evolution logs for QR/websocket
print("\n=== Evolution Logs (last 30 lines, QR-related) ===")
r = subprocess.run(["sudo", "docker", "logs", "servix-evolution", "--tail", "50"],
                   capture_output=True, text=True)
logs = r.stdout + r.stderr
for line in logs.split("\n"):
    lower = line.lower()
    if any(kw in lower for kw in ["qr", "websocket", "timed out", "error", "connect", "close"]):
        print(f"  {line.strip()[:200]}")

print("\n=== DIAGNOSIS DONE ===")
