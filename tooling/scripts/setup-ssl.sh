#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SERVIX — SSL Certificate Setup (Let's Encrypt / Certbot)
# ═══════════════════════════════════════════════════════════════
# Run this AFTER deploying SERVIX to set up auto-renewing SSL.
#
# Usage: sudo bash setup-ssl.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[SSL]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

[ "$(id -u)" -ne 0 ] && err "This script must be run as root (sudo)"

# Configuration
DOMAINS=(
    "servi-x.com"
    "www.servi-x.com"
    "api.servi-x.com"
    "app.servi-x.com"
    "booking.servi-x.com"
    "admin.servi-x.com"
)
EMAIL="${SSL_EMAIL:-admin@servi-x.com}"
SSL_DIR="/opt/servix/tooling/docker/nginx/ssl"
WEBROOT="/opt/servix/tooling/docker/certbot"

log "🔐 Setting up SSL certificates for SERVIX..."

# ── 1. Install Certbot ──
log "Installing Certbot..."
apt-get update -qq
apt-get install -y -qq certbot

# ── 2. Create webroot directory ──
mkdir -p "$WEBROOT"
mkdir -p "$SSL_DIR"

# ── 3. Build domain args ──
DOMAIN_ARGS=""
for domain in "${DOMAINS[@]}"; do
    DOMAIN_ARGS="$DOMAIN_ARGS -d $domain"
done

# ── 4. Check if Nginx is running (for webroot mode) ──
if docker ps | grep -q servix-nginx; then
    log "Nginx running — using webroot mode..."
    
    # Create certbot webroot in the Docker volume
    docker exec servix-nginx mkdir -p /var/www/certbot 2>/dev/null || true
    
    certbot certonly \
        --webroot \
        --webroot-path "$WEBROOT" \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        $DOMAIN_ARGS
else
    log "Nginx not running — using standalone mode..."
    
    certbot certonly \
        --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        --force-renewal \
        $DOMAIN_ARGS
fi

# ── 5. Copy certificates to Nginx SSL directory ──
CERT_DIR="/etc/letsencrypt/live/servi-x.com"
if [ -d "$CERT_DIR" ]; then
    cp "$CERT_DIR/fullchain.pem" "$SSL_DIR/fullchain.pem"
    cp "$CERT_DIR/privkey.pem" "$SSL_DIR/privkey.pem"
    chmod 600 "$SSL_DIR/privkey.pem"
    chmod 644 "$SSL_DIR/fullchain.pem"
    log "✅ Certificates copied to $SSL_DIR"
else
    err "Certificate directory not found: $CERT_DIR"
fi

# ── 6. Set up auto-renewal ──
log "Setting up auto-renewal..."

cat > /etc/cron.d/certbot-renew <<EOF
# Renew SSL certificates twice daily (Certbot best practice)
0 0,12 * * * root certbot renew --quiet --deploy-hook "/opt/servix/tooling/scripts/ssl-deploy-hook.sh" >> /var/log/certbot-renew.log 2>&1
EOF

# Deploy hook — copy new certs and reload Nginx
cat > /opt/servix/tooling/scripts/ssl-deploy-hook.sh <<'HOOK'
#!/bin/bash
# Called by Certbot after successful renewal
CERT_DIR="/etc/letsencrypt/live/servi-x.com"
SSL_DIR="/opt/servix/tooling/docker/nginx/ssl"

cp "$CERT_DIR/fullchain.pem" "$SSL_DIR/fullchain.pem"
cp "$CERT_DIR/privkey.pem" "$SSL_DIR/privkey.pem"
chmod 600 "$SSL_DIR/privkey.pem"

# Reload Nginx without downtime
docker exec servix-nginx nginx -s reload

echo "[$(date)] SSL certificates renewed and Nginx reloaded" >> /var/log/certbot-renew.log
HOOK

chmod +x /opt/servix/tooling/scripts/ssl-deploy-hook.sh

log "✅ Auto-renewal configured (twice daily check)"

# ── 7. Reload Nginx ──
if docker ps | grep -q servix-nginx; then
    docker exec servix-nginx nginx -s reload
    log "✅ Nginx reloaded with new certificates"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🔐 SSL Setup Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo "  ✅ Certificates issued for: ${DOMAINS[*]}"
echo "  ✅ Auto-renewal: twice daily (cron)"
echo "  ✅ Deploy hook: auto-copy + Nginx reload"
echo ""
echo "  Test: curl -I https://api.servi-x.com"
echo "  Verify: certbot certificates"
echo ""
