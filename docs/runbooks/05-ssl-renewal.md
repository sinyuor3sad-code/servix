# Runbook: SSL Certificate Renewal

## Severity: 🟡 High (site goes down when cert expires)

## Symptoms
- Browser shows "Your connection is not private" / ERR_CERT_DATE_INVALID
- API calls fail with TLS errors
- Uptime Kuma reports HTTPS monitors down

## Prevention

### Check cert expiry
```bash
# Check all domains
for domain in api.servi-x.com app.servi-x.com booking.servi-x.com admin.servi-x.com; do
  echo -n "$domain: "
  echo | openssl s_client -servername $domain -connect $domain:443 2>/dev/null | \
    openssl x509 -noout -enddate
done
```

### Automated renewal (recommended)
Add to crontab on the host:
```bash
# Renew certs twice daily (certbot only renews if <30 days left)
0 3,15 * * * certbot renew --deploy-hook "docker exec servix-nginx nginx -s reload" >> /var/log/certbot-renew.log 2>&1
```

---

## Manual Renewal

### Step 1: Renew certificate
```bash
# Stop nginx temporarily (standalone mode)
docker compose -f tooling/docker/docker-compose.prod.yml stop nginx

# Renew
sudo certbot renew

# Or renew specific domain
sudo certbot certonly --standalone \
  -d api.servi-x.com \
  -d app.servi-x.com \
  -d booking.servi-x.com \
  -d admin.servi-x.com \
  -d servi-x.com
```

### Step 2: Copy new certificates
```bash
sudo cp /etc/letsencrypt/live/servi-x.com/fullchain.pem \
  tooling/docker/nginx/ssl/fullchain.pem
sudo cp /etc/letsencrypt/live/servi-x.com/privkey.pem \
  tooling/docker/nginx/ssl/privkey.pem
```

### Step 3: Restart nginx
```bash
docker compose -f tooling/docker/docker-compose.prod.yml up -d nginx
```

### Step 4: Verify
```bash
for domain in api.servi-x.com app.servi-x.com booking.servi-x.com admin.servi-x.com; do
  echo -n "$domain: "
  curl -sI "https://$domain" | head -1
done
```

---

## Emergency: Certificate already expired

If the certificate has already expired and certbot standalone can't bind port 80:

```bash
# Method 1: Temporarily redirect nginx to HTTP
docker compose -f tooling/docker/docker-compose.prod.yml stop nginx
sudo certbot renew
# Copy certs (see Step 2 above)
docker compose -f tooling/docker/docker-compose.prod.yml up -d nginx

# Method 2: DNS challenge (no port 80 needed)
sudo certbot certonly --manual --preferred-challenges dns \
  -d "*.servi-x.com" -d servi-x.com
# Follow prompts to add DNS TXT record
```

## Post-Incident
- [ ] Verify automated renewal cron is working
- [ ] Set calendar reminder 7 days before next expiry
- [ ] Add Uptime Kuma monitor for cert expiry
