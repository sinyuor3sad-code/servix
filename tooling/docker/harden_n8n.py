#!/usr/bin/env python3
"""Add n8n hardening environment variables to docker-compose.prod.yml"""
import subprocess

COMPOSE_FILE = "/root/servix/tooling/docker/docker-compose.prod.yml"

# Read current file
result = subprocess.run(["sudo", "cat", COMPOSE_FILE], capture_output=True, text=True)
content = result.stdout

# Variables to add (after N8N_PERSONALIZATION_ENABLED line)
new_vars = """      EXECUTIONS_DATA_PRUNE: "true"
      EXECUTIONS_DATA_MAX_AGE: "168"
      N8N_VERSION_NOTIFICATIONS_ENABLED: "false"
      N8N_TEMPLATES_ENABLED: "false"
"""

# Check if already added
if "EXECUTIONS_DATA_PRUNE" in content:
    print("Already configured! No changes needed.")
    exit(0)

# Insert after N8N_PERSONALIZATION_ENABLED line
marker = '      N8N_PERSONALIZATION_ENABLED: "false"'
if marker in content:
    content = content.replace(marker, marker + "\n" + new_vars.rstrip())
    
    # Write back
    with open("/tmp/compose_updated.yml", "w") as f:
        f.write(content)
    
    subprocess.run(["sudo", "cp", "/tmp/compose_updated.yml", COMPOSE_FILE])
    print("✅ Added hardening variables:")
    print("  - EXECUTIONS_DATA_PRUNE: true (auto-delete old executions)")
    print("  - EXECUTIONS_DATA_MAX_AGE: 168 (7 days)")
    print("  - N8N_VERSION_NOTIFICATIONS_ENABLED: false")
    print("  - N8N_TEMPLATES_ENABLED: false")
    
    # Verify
    result2 = subprocess.run(["sudo", "grep", "-c", "EXECUTIONS_DATA_PRUNE", COMPOSE_FILE], capture_output=True, text=True)
    print(f"\nVerification: {'✅ OK' if result2.stdout.strip() == '1' else '❌ Failed'}")
else:
    print("❌ Marker line not found!")
