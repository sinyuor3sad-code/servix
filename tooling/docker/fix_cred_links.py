#!/usr/bin/env python3
"""Fix: Link credentials to workflow nodes."""
import json, subprocess

WF_ID = "wf-servix-ai-reception-0005"

def psql(sql):
    r = subprocess.run(
        ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c", sql],
        capture_output=True, text=True
    )
    return r.stdout.strip()

# Step 1: Get all credentials
cred_raw = psql("SELECT id, name, type FROM credentials_entity ORDER BY id;")
print("=== Available Credentials ===")
creds = {}
for line in cred_raw.split("\n"):
    parts = line.split("|")
    if len(parts) >= 3:
        cid, cname, ctype = parts[0], parts[1], parts[2]
        creds[cname] = {"id": cid, "type": ctype}
        print(f"  {cid} | {cname} | {ctype}")

# Step 2: Define credential-to-node mapping
# Gemini uses httpQueryAuth (API key in URL param)
# Others use httpHeaderAuth (Bearer token in Authorization header)
node_cred_map = {
    "[1] Google Gemini": {
        "auth": "genericCredentialType",
        "genericAuthType": "httpQueryAuth",
        "cred_name": "Gemini API",
        "cred_type": "httpQueryAuth"
    },
    "[2] Groq": {
        "auth": "genericCredentialType", 
        "genericAuthType": "httpHeaderAuth",
        "cred_name": "Groq API",
        "cred_type": "httpHeaderAuth"
    },
    "[3] Cloudflare": {
        "auth": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "cred_name": "Groq API",  # Cloudflare uses Workers AI, no separate cred
        "cred_type": "httpHeaderAuth"
    },
    "[4] Cerebras": {
        "auth": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth", 
        "cred_name": "Cerebras API",
        "cred_type": "httpHeaderAuth"
    },
    "[5] OpenRouter": {
        "auth": "genericCredentialType",
        "genericAuthType": "httpHeaderAuth",
        "cred_name": "OpenRouter API",
        "cred_type": "httpHeaderAuth"
    }
}

# Step 3: Get workflow nodes
nodes_raw = psql(f"SELECT nodes FROM workflow_entity WHERE id='{WF_ID}';")
nodes = json.loads(nodes_raw)

# Step 4: Update each node with credential reference
changes = 0
for node in nodes:
    name = node.get("name", "")
    if name in node_cred_map:
        mapping = node_cred_map[name]
        cred_name = mapping["cred_name"]
        
        if cred_name not in creds:
            print(f"\n  WARN: Credential '{cred_name}' not found for node '{name}'!")
            continue
        
        cred = creds[cred_name]
        
        # Set authentication parameters
        node["parameters"]["authentication"] = mapping["auth"]
        node["parameters"]["genericAuthType"] = mapping["genericAuthType"]
        
        # Set credential reference
        node["credentials"] = {
            mapping["cred_type"]: {
                "id": cred["id"],
                "name": cred_name
            }
        }
        
        changes += 1
        print(f"\n  LINKED: {name} → {cred_name} (id={cred['id']}, type={mapping['cred_type']})")

if changes == 0:
    print("\nNo changes needed!")
    exit(0)

# Step 5: Update workflow in DB
print(f"\n=== Saving {changes} changes ===")
nodes_json = json.dumps(nodes).replace("'", "''")
psql(f"UPDATE workflow_entity SET nodes = '{nodes_json}'::jsonb WHERE id = '{WF_ID}';")
print("  Draft updated")

# Step 6: Also update published version
version_id = psql(f"""SELECT "publishedVersionId" FROM workflow_published_version WHERE "workflowId" = '{WF_ID}';""")
if version_id:
    psql(f"""UPDATE workflow_history SET nodes = '{nodes_json}'::json WHERE "versionId" = '{version_id}';""")
    print(f"  Published version updated ({version_id})")

# Step 7: Verify
print("\n=== Verification ===")
verify = psql(f"SELECT nodes FROM workflow_entity WHERE id='{WF_ID}';")
verify_nodes = json.loads(verify)
for n in verify_nodes:
    name = n.get("name", "")
    if name.startswith("["):
        c = n.get("credentials", {})
        auth = n.get("parameters", {}).get("authentication", "")
        print(f"  {name}: auth={auth}, creds={json.dumps(c)}")

print("\n=== DONE — Restart n8n ===")
