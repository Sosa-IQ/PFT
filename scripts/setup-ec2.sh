#!/bin/bash
# One-time EC2 setup script
# Run this on EC2 to set up staging environment + systemd services for both envs.
#
# Prerequisites:
#   - Production repo already cloned at /home/ubuntu/PFT (on prod branch)
#   - Production .env files already in place
#
# Usage: bash scripts/setup-ec2.sh

set -euo pipefail

echo "============================================"
echo "  EC2 Setup: Production + Staging Services"
echo "============================================"

# -----------------------------------------------
# 1. Clone staging environment
# -----------------------------------------------
if [ ! -d /home/ubuntu/PFT-staging ]; then
    echo ""
    echo "=== Cloning staging repo ==="
    git clone https://github.com/Sosa-IQ/PFT.git /home/ubuntu/PFT-staging
    cd /home/ubuntu/PFT-staging
    git checkout staging

    echo "=== Setting up staging API venv ==="
    cd /home/ubuntu/PFT-staging/finance-api
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate

    echo "=== Setting up staging MCP venv ==="
    cd /home/ubuntu/PFT-staging/finance-mcp
    python3 -m venv venv
    source venv/bin/activate
    pip install -r requirements.txt
    deactivate

    echo ""
    echo ">>> IMPORTANT: Copy and edit .env files for staging:"
    echo "    cp /home/ubuntu/PFT/finance-api/.env /home/ubuntu/PFT-staging/finance-api/.env"
    echo "    cp /home/ubuntu/PFT/finance-mcp/.env /home/ubuntu/PFT-staging/finance-mcp/.env"
    echo ""
    echo "    Then edit staging .env files to update:"
    echo "    - finance-api: ALLOWED_ORIGINS should include your Vercel preview URL"
    echo "    - finance-mcp: MCP_SERVER_URL=https://staging-mcp.budgitbuddy.com"
    echo ""
else
    echo "Staging directory already exists, skipping clone."
fi

# -----------------------------------------------
# 2. Ensure production branch is correct
# -----------------------------------------------
echo ""
echo "=== Ensuring production is on prod branch ==="
cd /home/ubuntu/PFT
git fetch origin
git checkout prod 2>/dev/null || echo "Already on prod branch"

# -----------------------------------------------
# 3. Create systemd services
# -----------------------------------------------
echo ""
echo "=== Creating systemd services ==="

# --- Production API ---
sudo tee /etc/systemd/system/finance-api.service > /dev/null <<'EOF'
[Unit]
Description=Finance API - Production (FastAPI)
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/PFT/finance-api
ExecStart=/home/ubuntu/PFT/finance-api/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000
EnvironmentFile=/home/ubuntu/PFT/finance-api/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# --- Production MCP ---
sudo tee /etc/systemd/system/finance-mcp.service > /dev/null <<'EOF'
[Unit]
Description=Finance MCP Server - Production
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/PFT/finance-mcp
ExecStart=/home/ubuntu/PFT/finance-mcp/venv/bin/python server.py
EnvironmentFile=/home/ubuntu/PFT/finance-mcp/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# --- Staging API ---
sudo tee /etc/systemd/system/finance-api-staging.service > /dev/null <<'EOF'
[Unit]
Description=Finance API - Staging (FastAPI)
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/PFT-staging/finance-api
ExecStart=/home/ubuntu/PFT-staging/finance-api/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8002
EnvironmentFile=/home/ubuntu/PFT-staging/finance-api/.env
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# --- Staging MCP ---
sudo tee /etc/systemd/system/finance-mcp-staging.service > /dev/null <<'EOF'
[Unit]
Description=Finance MCP Server - Staging
After=network.target

[Service]
User=ubuntu
WorkingDirectory=/home/ubuntu/PFT-staging/finance-mcp
ExecStart=/home/ubuntu/PFT-staging/finance-mcp/venv/bin/python server.py
EnvironmentFile=/home/ubuntu/PFT-staging/finance-mcp/.env
Environment=PORT=8003
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable finance-api finance-mcp finance-api-staging finance-mcp-staging

echo "✓ All 4 systemd services created and enabled"

# -----------------------------------------------
# 4. Update Caddy config
# -----------------------------------------------
echo ""
echo "=== Updating Caddy config ==="

sudo tee /etc/caddy/Caddyfile > /dev/null <<'CADDYEOF'
# Production
api.budgitbuddy.com {
    reverse_proxy localhost:8000
}

mcp.budgitbuddy.com {
    reverse_proxy localhost:8001
}

# Staging (add IP allowlist later with: @allowed remote_ip <your-ip>)
staging-api.budgitbuddy.com {
    reverse_proxy localhost:8002
}

staging-mcp.budgitbuddy.com {
    reverse_proxy localhost:8003
}
CADDYEOF

sudo systemctl restart caddy
echo "✓ Caddy updated with staging subdomains"

# -----------------------------------------------
# 5. Start all services
# -----------------------------------------------
echo ""
echo "=== Starting all services ==="
sudo systemctl restart finance-api finance-mcp
sudo systemctl start finance-api-staging finance-mcp-staging

sleep 3
echo ""
for svc in finance-api finance-mcp finance-api-staging finance-mcp-staging; do
    if sudo systemctl is-active --quiet "$svc"; then
        echo "✓ $svc is running"
    else
        echo "✗ $svc is NOT running — check: sudo journalctl -u $svc -n 30"
    fi
done

echo ""
echo "============================================"
echo "  Setup complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Add DNS A records for staging-api.budgitbuddy.com"
echo "     and staging-mcp.budgitbuddy.com pointing to this EC2 IP"
echo ""
echo "  2. Copy and edit staging .env files (if not done already):"
echo "     cp /home/ubuntu/PFT/finance-api/.env /home/ubuntu/PFT-staging/finance-api/.env"
echo "     cp /home/ubuntu/PFT/finance-mcp/.env /home/ubuntu/PFT-staging/finance-mcp/.env"
echo ""
echo "  3. Add GitHub repo secrets:"
echo "     EC2_HOST = <your-elastic-ip>"
echo "     EC2_SSH_KEY = <contents of your .pem file>"
echo ""
echo "  4. To add IP restriction later, edit /etc/caddy/Caddyfile:"
echo "     staging-api.budgitbuddy.com {"
echo "         @allowed remote_ip <your-ip>"
echo "         handle @allowed {"
echo "             reverse_proxy localhost:8002"
echo "         }"
echo "         respond 403"
echo "     }"
echo ""
