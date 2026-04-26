#!/usr/bin/env python3
"""Analyze the last n8n execution to see which AI providers succeeded/failed."""
import json
import subprocess

# Get latest execution data
result = subprocess.run(
    ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c",
     'SELECT data FROM execution_data WHERE "executionId" = (SELECT MAX(id) FROM execution_entity);'],
    capture_output=True, text=True
)

if result.returncode != 0:
    print(f"ERROR: {result.stderr}")
    exit(1)

raw = json.loads(result.stdout.strip())
data = raw[0] if isinstance(raw, list) else raw
if isinstance(data, str):
    data = json.loads(data)
run_data = data.get("resultData", {}).get("runData", {})

print("=" * 60)
print("LAST EXECUTION ANALYSIS")
print("=" * 60)

important_nodes = [
    "[1] Google Gemini", "Gemini OK?",
    "[2] Groq", "Groq OK?",
    "[3] Cloudflare", "Cloudflare OK?",
    "[4] Cerebras", "Cerebras OK?",
    "[5] OpenRouter", "OpenRouter OK?",
    "Parse AI Response", "Respond OK", "All Failed — Fallback",
    "Validate Payload", "Build Prompt", "Respond Bad Request"
]

for node_name in important_nodes:
    if node_name in run_data:
        node_runs = run_data[node_name]
        for run in node_runs:
            error = run.get("error")
            status = "ERROR" if error else "OK"
            
            # Get output data
            main_data = run.get("data", {}).get("main", [[]])
            output_items = main_data[0] if main_data and main_data[0] else []
            
            print(f"\n  [{status}] {node_name}")
            
            if error:
                err_msg = error.get("message", str(error)) if isinstance(error, dict) else str(error)
                print(f"    Error: {err_msg[:200]}")
            
            if output_items:
                for item in output_items[:1]:
                    item_json = item.get("json", {})
                    # Truncate long values
                    summary = {}
                    for k, v in item_json.items():
                        sv = str(v)
                        summary[k] = sv[:100] + "..." if len(sv) > 100 else sv
                    print(f"    Output: {json.dumps(summary, ensure_ascii=False)[:300]}")
