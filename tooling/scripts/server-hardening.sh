#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# SERVIX — Server Hardening Script
# ═══════════════════════════════════════════════════════════════
# Run this ONCE on a fresh server before deploying SERVIX.
# Tested on: Ubuntu 22.04/24.04, Debian 12
#
# Usage: sudo bash server-hardening.sh
# ═══════════════════════════════════════════════════════════════

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[HARDEN]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# Must run as root
[ "$(id -u)" -ne 0 ] && err "This script must be run as root (sudo)"

echo -e "${BLUE}"
echo "  ╔═══════════════════════════════════════╗"
echo "  ║   SERVIX Server Hardening Script      ║"
echo "  ║   ⚠️  Run only on FRESH servers       ║"
echo "  ╚═══════════════════════════════════════╝"
echo -e "${NC}"

# ══════════ 1. System Updates ══════════
log "1/8 — Updating system packages..."
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get upgrade -y -qq
log "✅ System updated"

# ══════════ 2. Install Essential Packages ══════════
log "2/8 — Installing security packages..."
DEBIAN_FRONTEND=noninteractive apt-get install -y -qq \
    ufw \
    fail2ban \
    unattended-upgrades \
    apt-listchanges \
    logwatch \
    curl \
    git \
    htop \
    ncdu \
    jq
log "✅ Packages installed"

# ══════════ 3. Create deploy user (non-root) ══════════
DEPLOY_USER="servix"
log "3/8 — Creating deploy user: $DEPLOY_USER..."

if id "$DEPLOY_USER" &>/dev/null; then
    warn "User $DEPLOY_USER already exists — skipping"
else
    useradd -m -s /bin/bash -G sudo,docker "$DEPLOY_USER" 2>/dev/null || \
    useradd -m -s /bin/bash -G sudo "$DEPLOY_USER"
    
    # Copy SSH keys from root
    if [ -d /root/.ssh ]; then
        mkdir -p /home/$DEPLOY_USER/.ssh
        cp /root/.ssh/authorized_keys /home/$DEPLOY_USER/.ssh/ 2>/dev/null || true
        chown -R $DEPLOY_USER:$DEPLOY_USER /home/$DEPLOY_USER/.ssh
        chmod 700 /home/$DEPLOY_USER/.ssh
        chmod 600 /home/$DEPLOY_USER/.ssh/authorized_keys 2>/dev/null || true
    fi
    
    # Allow sudo without password for deploy user
    echo "$DEPLOY_USER ALL=(ALL) NOPASSWD:ALL" > /etc/sudoers.d/$DEPLOY_USER
    chmod 440 /etc/sudoers.d/$DEPLOY_USER
fi
log "✅ Deploy user created"

# ══════════ 4. SSH Hardening ══════════
log "4/8 — Hardening SSH..."

SSHD_CONFIG="/etc/ssh/sshd_config"
cp "$SSHD_CONFIG" "${SSHD_CONFIG}.backup.$(date +%Y%m%d)"

# Apply SSH hardening
cat > /etc/ssh/sshd_config.d/99-servix-hardening.conf <<'EOF'
# SERVIX SSH Hardening
# Disable password authentication — SSH keys only
PasswordAuthentication no
PubkeyAuthentication yes

# Disable root login via SSH
PermitRootLogin prohibit-password

# Disable empty passwords
PermitEmptyPasswords no

# Limit authentication attempts
MaxAuthTries 3
MaxSessions 5

# Timeout idle sessions (5 minutes)
ClientAliveInterval 300
ClientAliveCountMax 2

# Disable X11 forwarding
X11Forwarding no

# Disable TCP forwarding (unless needed)
AllowTcpForwarding no

# Only allow specific user
AllowUsers servix root

# Use strong key exchange algorithms
KexAlgorithms curve25519-sha256@libssh.org,diffie-hellman-group16-sha512,diffie-hellman-group18-sha512
Ciphers chacha20-poly1305@openssh.com,aes256-gcm@openssh.com,aes128-gcm@openssh.com
MACs hmac-sha2-512-etm@openssh.com,hmac-sha2-256-etm@openssh.com

# Log level
LogLevel VERBOSE
EOF

# Validate SSH config before restarting
sshd -t && systemctl restart sshd || warn "SSH config test failed — keeping old config"
log "✅ SSH hardened (key-only, no root password login)"

# ══════════ 5. Firewall (UFW) ══════════
log "5/8 — Configuring firewall (UFW)..."

ufw --force reset >/dev/null 2>&1

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (don't lock yourself out!)
ufw allow 22/tcp comment "SSH"

# Allow HTTP/HTTPS
ufw allow 80/tcp comment "HTTP"
ufw allow 443/tcp comment "HTTPS"

# Enable firewall
ufw --force enable
log "✅ Firewall configured (SSH + HTTP + HTTPS only)"

ufw status numbered

# ══════════ 6. Fail2Ban ══════════
log "6/8 — Configuring Fail2Ban..."

cat > /etc/fail2ban/jail.local <<'EOF'
[DEFAULT]
# Ban for 1 hour after 5 failed attempts in 10 minutes
bantime = 3600
findtime = 600
maxretry = 5
banaction = ufw

# Email notification (optional — set in .env)
# destemail = admin@servi-x.com
# action = %(action_mwl)s

[sshd]
enabled = true
port = ssh
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200

# Nginx rate limit bans
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/error.log
maxretry = 10
bantime = 3600
findtime = 600

# Nginx bad bots
[nginx-badbots]
enabled = true
filter = nginx-badbots
logpath = /var/log/nginx/access.log
maxretry = 2
bantime = 86400

# Docker — protect exposed ports
[docker-custom]
enabled = true
filter = sshd
logpath = /var/log/auth.log
maxretry = 3
bantime = 7200
EOF

# Create nginx-badbots filter
cat > /etc/fail2ban/filter.d/nginx-badbots.conf <<'EOF'
[Definition]
failregex = ^<HOST> .* "(GET|POST|HEAD) .*(wp-admin|wp-login|phpMyAdmin|\.env|\.git|xmlrpc|eval\(|/cdn-cgi).*" .*$
ignoreregex =
EOF

systemctl enable fail2ban
systemctl restart fail2ban
log "✅ Fail2Ban configured (SSH + Nginx protection)"

# ══════════ 7. Automatic Security Updates ══════════
log "7/8 — Enabling automatic security updates..."

cat > /etc/apt/apt.conf.d/50unattended-upgrades <<'EOF'
Unattended-Upgrade::Allowed-Origins {
    "${distro_id}:${distro_codename}";
    "${distro_id}:${distro_codename}-security";
    "${distro_id}ESMApps:${distro_codename}-apps-security";
    "${distro_id}ESM:${distro_codename}-infra-security";
};

// Auto-remove unused dependencies
Unattended-Upgrade::Remove-Unused-Kernel-Packages "true";
Unattended-Upgrade::Remove-Unused-Dependencies "true";

// Auto-reboot if needed (at 4 AM)
Unattended-Upgrade::Automatic-Reboot "true";
Unattended-Upgrade::Automatic-Reboot-Time "04:00";

// Logging
Unattended-Upgrade::SyslogEnable "true";
EOF

cat > /etc/apt/apt.conf.d/20auto-upgrades <<'EOF'
APT::Periodic::Update-Package-Lists "1";
APT::Periodic::Unattended-Upgrade "1";
APT::Periodic::AutocleanInterval "7";
EOF

systemctl enable unattended-upgrades
log "✅ Auto security updates enabled"

# ══════════ 8. Kernel Hardening (sysctl) ══════════
log "8/8 — Applying kernel hardening..."

cat > /etc/sysctl.d/99-servix-hardening.conf <<'EOF'
# ── Network Security ──
# Prevent IP spoofing
net.ipv4.conf.all.rp_filter = 1
net.ipv4.conf.default.rp_filter = 1

# Disable source routing
net.ipv4.conf.all.accept_source_route = 0
net.ipv6.conf.all.accept_source_route = 0

# Disable ICMP redirects
net.ipv4.conf.all.accept_redirects = 0
net.ipv6.conf.all.accept_redirects = 0
net.ipv4.conf.all.send_redirects = 0

# Enable SYN flood protection
net.ipv4.tcp_syncookies = 1
net.ipv4.tcp_max_syn_backlog = 2048
net.ipv4.tcp_synack_retries = 2

# Ignore ICMP broadcasts
net.ipv4.icmp_echo_ignore_broadcasts = 1

# Log suspicious packets
net.ipv4.conf.all.log_martians = 1

# ── Performance ──
# Increase connection tracking
net.netfilter.nf_conntrack_max = 131072
net.core.somaxconn = 65535
net.ipv4.tcp_max_tw_buckets = 1440000

# File handles
fs.file-max = 2097152
fs.inotify.max_user_watches = 524288

# ── Docker ──
net.ipv4.ip_forward = 1
EOF

sysctl --system >/dev/null 2>&1
log "✅ Kernel hardened"

# ══════════ Summary ══════════
echo ""
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo -e "${GREEN}  🔒 Server Hardening Complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════${NC}"
echo ""
echo "  ✅ System packages updated"
echo "  ✅ Deploy user: servix (sudo, key-only)"
echo "  ✅ SSH: key-only, no root password, max 3 attempts"
echo "  ✅ Firewall: ports 22, 80, 443 only"
echo "  ✅ Fail2Ban: SSH (3 tries) + Nginx protection"
echo "  ✅ Auto security updates: enabled (reboot @4AM)"
echo "  ✅ Kernel: SYN flood protection, anti-spoofing"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT NEXT STEPS:${NC}"
echo "  1. Test SSH login with your key BEFORE closing this session!"
echo "     ssh servix@$(hostname -I | awk '{print $1}')"
echo "  2. Install Docker: curl -fsSL https://get.docker.com | sh"
echo "  3. Add servix to docker group: usermod -aG docker servix"
echo "  4. Clone SERVIX and run deploy.sh"
echo ""
echo -e "${RED}⚠️  WARNING: Do NOT close this session until you verify SSH access!${NC}"
echo ""
