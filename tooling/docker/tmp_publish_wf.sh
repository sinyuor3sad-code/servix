#!/bin/bash
set -euo pipefail

WF_ID="wf-servix-ai-reception-0005"
PSQL="sudo docker exec servix-postgres psql -U servix -d n8n_db -t -A"

echo "=== Step 1: Get latest versionId ==="
VERSION_ID=$($PSQL -c "SELECT \"versionId\" FROM workflow_history WHERE \"workflowId\" = '$WF_ID' ORDER BY \"createdAt\" DESC LIMIT 1;")
echo "Latest versionId: $VERSION_ID"

if [ -z "$VERSION_ID" ]; then
    echo "ERROR: No workflow_history found. Cannot publish."
    exit 1
fi

echo ""
echo "=== Step 2: Insert published version ==="
$PSQL -c "INSERT INTO workflow_published_version (\"workflowId\", \"publishedVersionId\") VALUES ('$WF_ID', '$VERSION_ID') ON CONFLICT (\"workflowId\") DO UPDATE SET \"publishedVersionId\" = '$VERSION_ID', \"updatedAt\" = NOW();"
echo "Published version created"

echo ""
echo "=== Step 3: Verify ==="
echo "Published versions:"
$PSQL -c "SELECT \"workflowId\", \"publishedVersionId\", \"createdAt\" FROM workflow_published_version;"

echo ""
echo "Workflow active state:"
$PSQL -c "SELECT id, active FROM workflow_entity WHERE id = '$WF_ID';"

echo ""
echo "=== DONE ==="
