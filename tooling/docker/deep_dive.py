#!/usr/bin/env python3
"""Deep dive into execution 29 - show ALL data from each HTTP node."""
import json, subprocess

raw = subprocess.run(
    ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c",
     'SELECT data FROM execution_data WHERE "executionId" = 29;'],
    capture_output=True, text=True
).stdout.strip()

arr = json.loads(raw)

def resolve(idx, depth=0):
    if depth > 20:
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

for node_name in ["[1] Google Gemini", "[2] Groq", "[3] Cloudflare", "[4] Cerebras", "[5] OpenRouter"]:
    if node_name not in run_data:
        continue
    runs = run_data[node_name]
    if not isinstance(runs, list) or not runs:
        continue
    run = runs[0]
    if not isinstance(run, dict):
        continue
    
    print(f"\n{'='*50}")
    print(f"  {node_name}")
    print(f"{'='*50}")
    
    data = run.get("data", {})
    main = data.get("main", [])
    
    for i, branch in enumerate(main):
        if not isinstance(branch, list):
            continue
        label = "SUCCESS" if i == 0 else "ERROR"
        print(f"  [{label}] branch has {len(branch)} items")
        for item in branch[:1]:
            if isinstance(item, dict):
                j = item.get("json", {})
                if isinstance(j, dict):
                    # Show full response (truncated)
                    print(f"    Full JSON: {json.dumps(j, ensure_ascii=False, indent=2)[:600]}")
