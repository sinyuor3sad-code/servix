#!/usr/bin/env python3
"""Check workflow connections to verify fallback chain."""
import json
import subprocess

result = subprocess.run(
    ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c",
     "SELECT connections FROM workflow_entity WHERE id='wf-servix-ai-reception-0005';"],
    capture_output=True, text=True
)

connections = json.loads(result.stdout.strip())
print("=== WORKFLOW CONNECTIONS ===")
for node_name, outputs in connections.items():
    if not isinstance(outputs, dict):
        continue
    main_outputs = outputs.get("main", [])
    if not isinstance(main_outputs, list):
        continue
    for i, branch in enumerate(main_outputs):
        if not isinstance(branch, list):
            continue
        targets = [c.get("node", "?") for c in branch if isinstance(c, dict)]
        label = "SUCCESS" if i == 0 else "ERROR" if i == 1 else f"OUTPUT_{i}"
        if targets:
            print(f"  {node_name} [{label}] → {', '.join(targets)}")
        else:
            print(f"  {node_name} [{label}] → (DISCONNECTED!)")
