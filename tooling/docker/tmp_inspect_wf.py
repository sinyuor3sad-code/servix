#!/usr/bin/env python3
import json, subprocess

result = subprocess.run(
    ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c",
     "SELECT nodes FROM workflow_entity WHERE id='wf-servix-ai-reception-0005';"],
    capture_output=True, text=True
)

nodes = json.loads(result.stdout.strip())

print("=== NODES WITH CREDENTIALS ===")
for n in nodes:
    name = n.get("name", "?")
    ntype = n.get("type", "?")
    creds = n.get("credentials", {})
    if creds or "httpRequest" in ntype.lower():
        print(f"  {name}")
        print(f"    type: {ntype}")
        print(f"    credentials: {json.dumps(creds, indent=6)}")
        print()
