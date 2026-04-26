#!/usr/bin/env python3
"""Fix workflow connections: add error outputs from HTTP Request nodes to next provider."""
import json
import subprocess
import sys

WF_ID = "wf-servix-ai-reception-0005"

def psql(sql):
    result = subprocess.run(
        ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c", sql],
        capture_output=True, text=True
    )
    return result.stdout.strip()

# Step 1: Get current connections
print("=== Step 1: Get current connections ===")
raw = psql(f"SELECT connections FROM workflow_entity WHERE id='{WF_ID}';")
connections = json.loads(raw)

# Step 2: Add error outputs for HTTP Request nodes
# Current: [1] Gemini [SUCCESS] → Gemini OK?   [ERROR] → nothing
# Needed:  [1] Gemini [SUCCESS] → Gemini OK?   [ERROR] → [2] Groq

error_chain = {
    "[1] Google Gemini": "[2] Groq",
    "[2] Groq": "[3] Cloudflare",
    "[3] Cloudflare": "[4] Cerebras",
    "[4] Cerebras": "[5] OpenRouter",
    "[5] OpenRouter": "All Failed — Fallback"
}

changes = 0
for source_node, target_node in error_chain.items():
    if source_node in connections:
        main = connections[source_node].get("main", [])
        
        # Ensure we have at least 2 output branches (index 0=success, 1=error)
        while len(main) < 2:
            main.append([])
        
        # Check if error output (index 1) already has this target
        error_targets = [c.get("node") for c in main[1] if isinstance(c, dict)]
        if target_node not in error_targets:
            main[1].append({"node": target_node, "type": "main", "index": 0})
            changes += 1
            print(f"  ADDED: {source_node} [ERROR] → {target_node}")
        else:
            print(f"  OK:    {source_node} [ERROR] → {target_node} (already exists)")
        
        connections[source_node]["main"] = main
    else:
        print(f"  WARN:  {source_node} not found in connections!")

if changes == 0:
    print("\nNo changes needed!")
    sys.exit(0)

# Step 3: Update DB
print(f"\n=== Step 2: Updating {changes} connections ===")
new_connections = json.dumps(connections).replace("'", "''")
psql(f"UPDATE workflow_entity SET connections = '{new_connections}'::jsonb WHERE id = '{WF_ID}';")
print("  DB updated")

# Step 4: Verify
print("\n=== Step 3: Verify ===")
raw2 = psql(f"SELECT connections FROM workflow_entity WHERE id='{WF_ID}';")
conn2 = json.loads(raw2)
for node_name in error_chain:
    if node_name in conn2:
        main = conn2[node_name].get("main", [])
        if len(main) >= 2:
            targets = [c.get("node") for c in main[1] if isinstance(c, dict)]
            print(f"  {node_name} [ERROR] → {targets}")
        else:
            print(f"  {node_name} [ERROR] → MISSING!")

print("\n=== DONE — Restart n8n to apply ===")
