#!/usr/bin/env python3
"""Update the published version's connections to match the draft."""
import json
import subprocess

WF_ID = "wf-servix-ai-reception-0005"

def psql(sql):
    r = subprocess.run(
        ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c", sql],
        capture_output=True, text=True
    )
    return r.stdout.strip()

# Get versionId from published_version
version_id = psql(f"""SELECT "publishedVersionId" FROM workflow_published_version WHERE "workflowId" = '{WF_ID}';""")
print(f"Published versionId: {version_id}")

# Get current draft connections
draft_connections = psql(f"SELECT connections FROM workflow_entity WHERE id = '{WF_ID}';")

# Update workflow_history with the new connections
escaped = draft_connections.replace("'", "''")
psql(f"""UPDATE workflow_history SET connections = '{escaped}'::json WHERE "versionId" = '{version_id}';""")
print("Updated workflow_history connections")

# Also get draft nodes and update
draft_nodes = psql(f"SELECT nodes FROM workflow_entity WHERE id = '{WF_ID}';")
escaped_nodes = draft_nodes.replace("'", "''")
psql(f"""UPDATE workflow_history SET nodes = '{escaped_nodes}'::json WHERE "versionId" = '{version_id}';""")
print("Updated workflow_history nodes")

# Verify
print("\nVerifying...")
pub_conn = psql(f"""SELECT connections FROM workflow_history WHERE "versionId" = '{version_id}';""")
pub_connections = json.loads(pub_conn)
for node_name in ["[1] Google Gemini", "[2] Groq", "[3] Cloudflare", "[4] Cerebras", "[5] OpenRouter"]:
    if node_name in pub_connections:
        main = pub_connections[node_name].get("main", [])
        if len(main) >= 2:
            targets = [c.get("node") for c in main[1] if isinstance(c, dict)]
            print(f"  {node_name} [ERROR] → {targets}")

print("\nDONE — Restart n8n one more time")
