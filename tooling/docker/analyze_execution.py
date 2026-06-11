#!/usr/bin/env python3
"""Analyze n8n executions - check last 3."""
import json
import subprocess

def get_execution_ids():
    result = subprocess.run(
        ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c",
         'SELECT id, finished, status, mode FROM execution_entity ORDER BY id DESC LIMIT 5;'],
        capture_output=True, text=True
    )
    print("Recent executions:")
    print(result.stdout)
    return [line.split("|")[0] for line in result.stdout.strip().split("\n") if line]

def analyze_execution(exec_id):
    result = subprocess.run(
        ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c",
         f'SELECT data FROM execution_data WHERE "executionId" = {exec_id};'],
        capture_output=True, text=True
    )
    if not result.stdout.strip():
        print(f"  No data for execution {exec_id}")
        return

    arr = json.loads(result.stdout.strip())

    def resolve(idx, depth=0):
        if depth > 15:
            return f"<depth:{idx}>"
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
    last_node = root.get("resultData", {}).get("lastNodeExecuted", "?")
    
    print(f"\n  Execution {exec_id}: Last node = {last_node}")
    
    nodes_of_interest = ["[1] Google Gemini", "[2] Groq", "[3] Cloudflare", "[4] Cerebras", "[5] OpenRouter",
                         "Gemini OK?", "Groq OK?", "Cloudflare OK?", "Cerebras OK?", "OpenRouter OK?",
                         "Parse AI Response", "Respond OK", "All Failed — Fallback",
                         "Validate Payload", "Build Prompt"]
    
    for node_name in nodes_of_interest:
        if node_name in run_data:
            runs = run_data[node_name]
            if not isinstance(runs, list):
                continue
            for run in runs:
                if not isinstance(run, dict):
                    continue
                error = run.get("error")
                status = "ERR" if error else "OK "
                print(f"    [{status}] {node_name}", end="")
                if error:
                    msg = error.get("message", str(error))[:150] if isinstance(error, dict) else str(error)[:150]
                    print(f" → {msg}")
                else:
                    main = run.get("data", {}).get("main", [[]])
                    if isinstance(main, list) and len(main) > 0 and isinstance(main[0], list) and len(main[0]) > 0:
                        item = main[0][0]
                        if isinstance(item, dict):
                            j = item.get("json", {})
                            # Show condensed output
                            keys = list(j.keys()) if isinstance(j, dict) else []
                            print(f" → keys={keys}")
                    else:
                        print()

ids = get_execution_ids()
for eid in ids[:3]:
    analyze_execution(eid)
