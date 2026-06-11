#!/usr/bin/env python3
"""
Send a test request and extract ACTUAL error messages from each provider.
The devalue format needs full resolution to get error details.
"""
import json, subprocess, time

def psql(sql):
    r = subprocess.run(
        ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c", sql],
        capture_output=True, text=True
    )
    return r.stdout.strip()

# Step 1: Send test request
ip = subprocess.run(
    ["sudo", "docker", "inspect", "servix-n8n", "--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"],
    capture_output=True, text=True
).stdout.strip()

payload = json.dumps({
    "tenantId": "test-001", "phone": "966500000000",
    "message": "book haircut Saturday",
    "context": {"salonName": "Test", "services": [{"name": "Haircut", "price": 50, "duration": 30}], "workingHours": "9AM-10PM"}
})

print("Sending test request...")
r = subprocess.run(
    ["curl", "-s", "--max-time", "90", "-X", "POST", f"http://{ip}:5678/webhook/servix-ai-reception",
     "-H", "Content-Type: application/json", "-d", payload],
    capture_output=True, text=True
)
print(f"Response: {r.stdout[:200]}")
time.sleep(2)

# Step 2: Get latest execution
exec_id = psql("SELECT MAX(id) FROM execution_entity;")
print(f"\nExecution ID: {exec_id}")

# Step 3: Get raw execution data and fully resolve
raw = psql(f'SELECT data FROM execution_data WHERE "executionId" = {exec_id};')
arr = json.loads(raw)

# Full resolution with high depth limit
def resolve(idx, depth=0, max_depth=50):
    if depth > max_depth:
        return f"<MAX:{idx}>"
    if isinstance(idx, str):
        if idx.isdigit():
            return resolve(int(idx), depth + 1, max_depth)
        return idx
    if isinstance(idx, int) and 0 <= idx < len(arr):
        val = arr[idx]
        if isinstance(val, dict):
            return {k: resolve(v, depth + 1, max_depth) for k, v in val.items()}
        if isinstance(val, list):
            return [resolve(v, depth + 1, max_depth) for v in val]
        return val
    return idx

root = resolve(0)
run_data = root.get("resultData", {}).get("runData", {})

# Step 4: For each HTTP node, find the error details
print(f"\n{'='*60}")
print("PROVIDER ERROR DETAILS")
print(f"{'='*60}")

for node_name in ["[1] Google Gemini", "[2] Groq", "[3] Cloudflare", "[4] Cerebras", "[5] OpenRouter"]:
    if node_name not in run_data:
        continue
    runs = run_data[node_name]
    if not isinstance(runs, list) or not runs:
        continue
    run = runs[0]
    if not isinstance(run, dict):
        continue

    print(f"\n--- {node_name} ---")
    
    # Check for node-level error
    error = run.get("error")
    if error:
        if isinstance(error, dict):
            print(f"  Node Error: {error.get('message', '')[:300]}")
            print(f"  HTTP Code: {error.get('httpCode', error.get('statusCode', error.get('code', '?')))}")
            desc = error.get("description", error.get("cause", ""))
            if desc:
                print(f"  Description: {str(desc)[:300]}")
        else:
            print(f"  Node Error: {str(error)[:300]}")
    
    # Check error branch data
    data = run.get("data", {})
    main = data.get("main", [])
    if isinstance(main, list) and len(main) > 1:
        err_branch = main[1]
        if isinstance(err_branch, list) and err_branch:
            item = err_branch[0]
            if isinstance(item, dict):
                j = item.get("json", {})
                if isinstance(j, dict) and "error" in j:
                    err_info = j["error"]
                    print(f"  API Error: {json.dumps(err_info, ensure_ascii=False)[:300]}")

# Step 5: Also check if credentials are being used
print(f"\n{'='*60}")
print("CREDENTIAL CHECK")
print(f"{'='*60}")

# Get workflow nodes to see credential config
nodes_raw = psql("SELECT nodes FROM workflow_entity WHERE id='wf-servix-ai-reception-0005';")
nodes = json.loads(nodes_raw)
for n in nodes:
    name = n.get("name", "")
    if name.startswith("["):
        creds = n.get("credentials", {})
        auth = n.get("parameters", {}).get("authentication", "")
        auth_type = n.get("parameters", {}).get("genericAuthType", "")
        print(f"  {name}: auth={auth}, type={auth_type}, creds={json.dumps(creds)}")
