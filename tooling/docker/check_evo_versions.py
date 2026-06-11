#!/usr/bin/env python3
"""Check available Evolution API versions and Baileys compatibility."""
import json, subprocess

# Check current
r = subprocess.run(["sudo", "docker", "exec", "servix-evolution", "cat", "package.json"],
                   capture_output=True, text=True)
pkg = json.loads(r.stdout)
deps = pkg.get("dependencies", {})
baileys = deps.get("baileys", deps.get("@whiskeysockets/baileys", "?"))
print(f"Current Evolution: v{pkg.get('version')}")
print(f"Current Baileys:   {baileys}")

# Check current Baileys node_modules version
r2 = subprocess.run(
    ["sudo", "docker", "exec", "servix-evolution", "cat", "/evolution/node_modules/baileys/package.json"],
    capture_output=True, text=True
)
try:
    bp = json.loads(r2.stdout)
    print(f"Installed Baileys: v{bp.get('version')}")
except:
    r3 = subprocess.run(
        ["sudo", "docker", "exec", "servix-evolution", "cat", "/evolution/node_modules/@whiskeysockets/baileys/package.json"],
        capture_output=True, text=True
    )
    try:
        bp3 = json.loads(r3.stdout)
        print(f"Installed Baileys: v{bp3.get('version')} (@whiskeysockets)")
    except:
        print("Could not find Baileys package")

# Check latest pulled image
r4 = subprocess.run(
    ["sudo", "docker", "run", "--rm", "--entrypoint", "cat",
     "atendai/evolution-api:latest", "package.json"],
    capture_output=True, text=True, timeout=15
)
try:
    lpkg = json.loads(r4.stdout)
    ldeps = lpkg.get("dependencies", {})
    lbaileys = ldeps.get("baileys", ldeps.get("@whiskeysockets/baileys", "?"))
    print(f"\nLatest Evolution:  v{lpkg.get('version')}")
    print(f"Latest Baileys:    {lbaileys}")
except:
    print(f"\nCould not inspect latest image")

# Check what versions are available on Docker Hub
print("\n=== Local Docker images ===")
r5 = subprocess.run(["sudo", "docker", "images", "atendai/evolution-api", "--format",
                     "{{.Tag}}\t{{.Size}}\t{{.CreatedSince}}"],
                    capture_output=True, text=True)
print(r5.stdout.strip())
