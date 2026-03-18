#!/bin/bash
# Deploy script for EC2 — called by GitHub Actions
# Usage: ./deploy.sh <environment>
# Environments: prod, staging

set -euo pipefail

ENV="${1:-}"

if [ "$ENV" = "prod" ]; then
    BRANCH="prod"
    APP_DIR="/home/ubuntu/PFT"
    API_SERVICE="finance-api"
    MCP_SERVICE="finance-mcp"
elif [ "$ENV" = "staging" ]; then
    BRANCH="staging"
    APP_DIR="/home/ubuntu/PFT-staging"
    API_SERVICE="finance-api-staging"
    MCP_SERVICE="finance-mcp-staging"
else
    echo "Usage: $0 <prod|staging>"
    exit 1
fi

echo "=== Deploying $ENV from branch $BRANCH ==="

cd "$APP_DIR"
git fetch origin "$BRANCH"
git checkout "$BRANCH"
git reset --hard "origin/$BRANCH"

echo "=== Installing API dependencies ==="
cd "$APP_DIR/finance-api"
source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate

echo "=== Installing MCP dependencies ==="
cd "$APP_DIR/finance-mcp"
source venv/bin/activate
pip install -r requirements.txt --quiet
deactivate

echo "=== Restarting services ==="
sudo systemctl restart "$API_SERVICE" "$MCP_SERVICE"

echo "=== Waiting for services to start ==="
sleep 3

# Verify services are running
for svc in "$API_SERVICE" "$MCP_SERVICE"; do
    if sudo systemctl is-active --quiet "$svc"; then
        echo "✓ $svc is running"
    else
        echo "✗ $svc failed to start"
        sudo journalctl -u "$svc" --no-pager -n 20
        exit 1
    fi
done

echo "=== $ENV deploy complete ==="
