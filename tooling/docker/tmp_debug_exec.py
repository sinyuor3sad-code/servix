#!/usr/bin/env python3
import json, subprocess

result = subprocess.run(
    ["sudo", "docker", "exec", "servix-postgres", "psql", "-U", "servix", "-d", "n8n_db", "-t", "-A", "-c",
     'SELECT data FROM execution_data WHERE "executionId" = (SELECT MAX(id) FROM execution_entity);'],
    capture_output=True, text=True
)

raw = result.stdout.strip()
print(f"Type: {type(raw)}")
print(f"Length: {len(raw)}")
print(f"First 200 chars: {raw[:200]}")
print(f"---")

# Try multiple parsing approaches
try:
    d = json.loads(raw)
    print(f"Parsed type: {type(d)}")
    if isinstance(d, list):
        print(f"List length: {len(d)}")
        d = d[0]
        print(f"First element type: {type(d)}")
    if isinstance(d, str):
        d = json.loads(d)
        print(f"Double parsed type: {type(d)}")
    if isinstance(d, dict):
        print(f"Keys: {list(d.keys())}")
        rd = d.get("resultData", {})
        print(f"resultData type: {type(rd)}")
        if isinstance(rd, str):
            rd = json.loads(rd)
        if isinstance(rd, dict):
            run_data = rd.get("runData", {})
            print(f"runData keys: {list(run_data.keys())[:10]}")
            
            # Show Gemini node
            for k in run_data:
                if "Gemini" in k or "Groq" in k or "Fallback" in k or "Respond" in k:
                    v = run_data[k]
                    err = v[0].get("error") if v else None
                    print(f"\n  {k}: error={err is not None}")
                    if err:
                        print(f"    {str(err)[:200]}")
                    else:
                        main = v[0].get("data", {}).get("main", [[]])
                        if main and main[0]:
                            print(f"    output: {json.dumps(main[0][0].get('json',{}), ensure_ascii=False)[:200]}")
except Exception as e:
    print(f"Parse error: {e}")
