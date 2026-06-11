#!/usr/bin/env python3
"""Send request to PRODUCTION webhook and immediately analyze the execution."""
import json, subprocess, time

# Step 1: Send request
payload = json.dumps({
    "tenantId": "test-001",
    "phone": "966500000000",
    "message": "I want to book a haircut Saturday",
    "context": {
        "salonName": "Elegance Salon",
        "services": [{"name": "Haircut", "price": 50, "duration": 30}],
        "workingHours": "9AM-10PM"
    }
})

ip = subprocess.run(
    ["sudo", "docker", "inspect", "servix-n8n", "--format", "{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}"],
    capture_output=True, text=True
).stdout.strip()

print(f"Sending to http://{ip}:5678/webhook/servix-ai-reception ...")
r = subprocess.run(
    ["curl", "-s", "--max-time", "90", "-w", "\nHTTP:%{http_code}",
     "-X", "POST", f"http://{ip}:5678/webhook/servix-ai-reception",
     "-H", "Content-Type: application/json",
     "-d", payload],
    capture_output=True, text=True
)
print(f"Response: {r.stdout[:500]}")
time.sleep(2)

# Step 2: Get latest execution ID
exec_id = subprocess.run(
    ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c",
     "SELECT MAX(id) FROM execution_entity;"],
    capture_output=True, text=True
).stdout.strip()
print(f"\nLatest execution ID: {exec_id}")

# Step 3: Get execution data
raw = subprocess.run(
    ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c",
     f'SELECT data FROM execution_data WHERE "executionId" = {exec_id};'],
    capture_output=True, text=True
).stdout.strip()

arr = json.loads(raw)

def resolve(idx, depth=0):
    if depth > 15:
        return f"<d:{idx}>"
    if isinstance(idx, str) and idx.isdigit():
        return resolve(int(idx), depth + 1)
    if isinstance(idx, int) and 0 <= idx < len(arr):
        val = arr[idx]
        if isinstance(val, dict):
            return {k: resolve(v, depth + 1) for k, v in val.items()}
        if isinstance(val, list):
            return [resolve(v, depth + 1) for v in val]
        return val
    return idx

root = resolve(0)
run_data = root.get("resultData", {}).get("runData", {})

print(f"\n{'='*60}")
print("EXECUTION FLOW ANALYSIS")
print(f"{'='*60}")
print(f"Last node: {root.get('resultData', {}).get('lastNodeExecuted', '?')}")

# Analyze each node
nodes_order = [
    "Webhook", "Validate Payload", "Build Prompt",
    "[1] Google Gemini", "Gemini OK?",
    "[2] Groq", "Groq OK?",
    "[3] Cloudflare", "Cloudflare OK?",
    "[4] Cerebras", "Cerebras OK?",
    "[5] OpenRouter", "OpenRouter OK?",
    "Parse AI Response", "Respond OK",
    "Respond Bad Request", "All Failed — Fallback"
]

for node_name in nodes_order:
    if node_name not in run_data:
        continue
    runs = run_data[node_name]
    if not isinstance(runs, list) or not runs:
        continue
    run = runs[0]
    if not isinstance(run, dict):
        continue
    
    error = run.get("error")
    data = run.get("data", {})
    main = data.get("main", [[]])
    
    # Determine which output was used
    active_branches = []
    if isinstance(main, list):
        for i, branch in enumerate(main):
            if isinstance(branch, list) and len(branch) > 0:
                active_branches.append(i)
    
    status = "❌ ERR" if error else "✅ OK "
    branch_info = f"[out:{','.join(map(str, active_branches))}]" if active_branches else "[no output]"
    
    print(f"\n  {status} {node_name} {branch_info}")
    
    if error:
        if isinstance(error, dict):
            msg = error.get("message", str(error))
            print(f"       Error: {str(msg)[:200]}")
        else:
            print(f"       Error: {str(error)[:200]}")
    
    # Show response details for HTTP nodes
    if node_name.startswith("[") and active_branches:
        for bi in active_branches:
            branch = main[bi]
            if isinstance(branch, list) and branch:
                item = branch[0]
                if isinstance(item, dict):
                    j = item.get("json", {})
                    if isinstance(j, dict):
                        # Check for API errors
                        if "error" in j:
                            print(f"       API Error: {json.dumps(j['error'], ensure_ascii=False)[:200]}")
                        elif "candidates" in j:
                            print(f"       Gemini OK: has candidates")
                        elif "choices" in j:
                            text = j.get("choices", [{}])[0].get("message", {}).get("content", "")[:80]
                            print(f"       AI Response: {text}")
                        elif "message" in j:
                            print(f"       API msg: {str(j['message'])[:200]}")
                        else:
                            print(f"       Keys: {list(j.keys())[:8]}")
