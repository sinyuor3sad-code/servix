#!/usr/bin/env python3
"""Test WhatsApp WebSocket connectivity and diagnose QR issue."""
import socket, ssl, time, subprocess, json

print("=" * 60)
print("WHATSAPP CONNECTIVITY DIAGNOSIS")
print("=" * 60)

# 1. DNS resolution
print("\n1. DNS Resolution:")
hosts = ["web.whatsapp.com", "w1.web.whatsapp.com", "w2.web.whatsapp.com"]
for host in hosts:
    try:
        ips = socket.getaddrinfo(host, 443, socket.AF_UNSPEC, socket.SOCK_STREAM)
        ip_list = list(set([ip[4][0] for ip in ips]))
        print(f"  {host} -> {ip_list[:3]}")
    except Exception as e:
        print(f"  {host} -> FAILED: {e}")

# 2. TCP/TLS connectivity
print("\n2. TCP/TLS Connectivity:")
for host in hosts:
    try:
        start = time.time()
        sock = socket.create_connection((host, 443), timeout=10)
        elapsed = round((time.time() - start) * 1000)
        ctx = ssl.create_default_context()
        ssock = ctx.wrap_socket(sock, server_hostname=host)
        tls = ssock.version()
        print(f"  {host} -> OK ({elapsed}ms, {tls})")
        ssock.close()
    except Exception as e:
        print(f"  {host} -> FAILED: {e}")

# 3. Test from inside Evolution container
print("\n3. WebSocket from Evolution container:")
ws_test = """
const WebSocket = require('ws');
const ws = new WebSocket('wss://web.whatsapp.com/ws/chat', {
  headers: { 'Origin': 'https://web.whatsapp.com' },
  timeout: 15000
});
ws.on('open', () => { console.log('WS_CONNECTED'); ws.close(); process.exit(0); });
ws.on('error', (e) => { console.log('WS_ERROR: ' + e.message); process.exit(1); });
ws.on('close', (code, reason) => { console.log('WS_CLOSED: ' + code); });
setTimeout(() => { console.log('WS_TIMEOUT'); process.exit(1); }, 15000);
"""
r = subprocess.run(
    ["sudo", "docker", "exec", "servix-evolution", "node", "-e", ws_test],
    capture_output=True, text=True, timeout=20
)
print(f"  Result: {r.stdout.strip()}")
if r.stderr.strip():
    print(f"  Stderr: {r.stderr.strip()[:200]}")

# 4. Check current Evolution API version and available updates
print("\n4. Evolution API Version:")
r = subprocess.run(
    ["sudo", "docker", "exec", "servix-evolution", "cat", "package.json"],
    capture_output=True, text=True
)
try:
    pkg = json.loads(r.stdout)
    print(f"  Current: v{pkg.get('version', '?')}")
except:
    print(f"  Could not read")

# Check latest available
r2 = subprocess.run(
    ["sudo", "docker", "pull", "--quiet", "atendai/evolution-api:latest"],
    capture_output=True, text=True, timeout=60
)
if r2.returncode == 0:
    r3 = subprocess.run(
        ["sudo", "docker", "run", "--rm", "atendai/evolution-api:latest", "cat", "package.json"],
        capture_output=True, text=True, timeout=15
    )
    try:
        latest_pkg = json.loads(r3.stdout)
        print(f"  Latest:  v{latest_pkg.get('version', '?')}")
    except:
        print(f"  Latest pull succeeded but version check failed")
else:
    print(f"  Could not pull latest: {r2.stderr[:200]}")

# 5. Check IPv6 vs IPv4 issue
print("\n5. IPv6/IPv4 Check:")
r = subprocess.run(
    ["sudo", "docker", "exec", "servix-evolution", "node", "-e",
     "const dns = require('dns'); dns.resolve4('web.whatsapp.com', (e,a) => { console.log('IPv4:', a||e); dns.resolve6('web.whatsapp.com', (e2,a2) => { console.log('IPv6:', a2||e2); process.exit(0); }); });"],
    capture_output=True, text=True, timeout=10
)
print(f"  {r.stdout.strip()}")

print(f"\n{'=' * 60}")
print("DIAGNOSIS COMPLETE")
print(f"{'=' * 60}")
