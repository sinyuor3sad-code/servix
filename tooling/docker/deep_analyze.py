#!/usr/bin/env python3
"""Deep analysis of the Gemini node execution to see what happened."""
import json
import subprocess

result = subprocess.run(
    ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c",
     'SELECT data FROM execution_data WHERE "executionId" = 23;'],
    capture_output=True, text=True
)

arr = json.loads(result.stdout.strip())

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

# Deep inspect Gemini node
gemini_key = "[1] Google Gemini"
if gemini_key in run_data:
    runs = run_data[gemini_key]
    if isinstance(runs, list):
        for i, run in enumerate(runs):
            if not isinstance(run, dict):
                continue
            print(f"=== Gemini Run {i} ===")
            print(f"  executionTime: {run.get('executionTime')}")
            print(f"  source: {run.get('source')}")
            print(f"  startTime: {run.get('startTime')}")
            error = run.get("error")
            if error:
                print(f"  ERROR: {json.dumps(error, ensure_ascii=False)[:500]}")
            
            data = run.get("data", {})
            main = data.get("main", [[]])
            if isinstance(main, list):
                print(f"  main outputs: {len(main)}")
                for j, branch in enumerate(main):
                    if isinstance(branch, list):
                        print(f"    branch[{j}]: {len(branch)} items")
                        for k, item in enumerate(branch[:1]):
                            if isinstance(item, dict):
                                json_data = item.get("json", {})
                                # Show status code and response keys
                                print(f"      statusCode: {json_data.get('statusCode', '?')}")
                                if isinstance(json_data, dict):
                                    print(f"      keys: {list(json_data.keys())[:10]}")
                                    # Check for Gemini response
                                    candidates = json_data.get("candidates")
                                    error_resp = json_data.get("error")
                                    if candidates:
                                        print(f"      candidates: {json.dumps(candidates, ensure_ascii=False)[:300]}")
                                    if error_resp:
                                        print(f"      API error: {json.dumps(error_resp, ensure_ascii=False)[:300]}")
                                    if not candidates and not error_resp:
                                        print(f"      full json: {json.dumps(json_data, ensure_ascii=False)[:400]}")

# Check all executed nodes
print("\n=== ALL EXECUTED NODES ===")
for name in run_data:
    runs = run_data[name]
    if isinstance(runs, list) and runs:
        r = runs[0]
        if isinstance(r, dict):
            exec_time = r.get("executionTime", "?")
            print(f"  {name}: {exec_time}ms")

# Check execution metadata
print(f"\n=== EXECUTION META ===")
print(f"  lastNodeExecuted: {root.get('resultData', {}).get('lastNodeExecuted', '?')}")
exec_data = root.get("executionData", {})
print(f"  waitingExecution: {exec_data.get('waitingExecution')}")
node_stack = exec_data.get("nodeExecutionStack", [])
print(f"  nodeExecutionStack length: {len(node_stack) if isinstance(node_stack, list) else '?'}")
