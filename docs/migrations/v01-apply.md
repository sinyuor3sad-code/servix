# V-01 / A2-01 / A5-001 / A5-026 — WebSocket tenant auth runbook

**Severity:** CRITICAL (P0) — open WebSocket tenant takeover today.
**Author:** Engineer 2 (Auth/Identity).
**Created:** 2026-05-20.
**Audit source:** `docs/principal-audit/synthesis-2026-05-14.md`.

## What this card does

Closes the unauthenticated WebSocket handshake at `wss://api.servi-x.com/ws`. Before V-01 the gateway joined `tenant:<id>` rooms based on a `query.tenantId` parameter the client sets — anyone with the URL could subscribe to any tenant's broadcasts.

After V-01:
- Handshake must carry a valid JWT in `handshake.auth.token` (Socket.IO v3+ standard) or `Authorization: Bearer …`.
- JWT is verified with the same `JWT_ACCESS_SECRET` as the HTTP layer.
- Revocation check via `cache.getPasswordChangedAt(sub)` (mirrors HTTP `JwtAuthGuard` semantics — V-14a primitive already shipped).
- Tenant access check via `assertActiveTenantUser` (the same helper the HTTP `TenantGuard` uses — extracted in this card).
- Room joins (`tenant:<id>`, `user:<id>`) use the verified JWT payload, never the query string.
- A contradicting `query.tenantId` is treated as a confusion attack and rejected with `ForbiddenException`.

## Staged rollout — the `WS_AUTH_ENFORCE` flag

Secure-by-default: the Joi env validation defaults `WS_AUTH_ENFORCE=true`. Operators set it to `false` only for a brief soak window to observe traffic before flipping back. Three planned deploy steps:

| Step | Flag | Behaviour | Purpose |
|---|---|---|---|
| 1. Deploy backend (Commit 1) | `false` | Failed validation → warn log + legacy query-based join. Successful validation → strict JWT-pinned rooms. | 24h soak — confirm legitimate clients reach the gateway. |
| 2. Ship frontend (Commit 2) | `false` | Dashboard sockets now send `auth.token`; backend still tolerant. | Verify the new handshake works end-to-end. |
| 3. Flip flag | `true` | Failed validation → `disconnect(true)`. | Production enforcement. |

Step 4 (follow-up PR in 7 days): remove the flag entirely once traffic is stable.

## Pre-conditions

- [ ] Engineer 2 PR with both commits has merged to main.
- [ ] `JWT_ACCESS_SECRET` set in prod (already verified during pre-flight — ✓).
- [ ] No active deploys on `servix-api-1` or `servix-api-2`.

## Step 0 — Backup verification (<1h)

Not strictly required (this is a code change, not a schema change), but follow the standard discipline:

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  sudo ls -lh /var/backups/postgres/ | tail -3
EOF
```

## Step 1 — Deploy backend with `WS_AUTH_ENFORCE=false`

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  cd /home/servix-admin/servix
  # Ensure the .env or compose env has WS_AUTH_ENFORCE=false
  grep WS_AUTH_ENFORCE tooling/docker/.env || \
    echo "WS_AUTH_ENFORCE=false" | sudo tee -a tooling/docker/.env

  # Pull the latest image / restart api-1 first, then api-2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml pull api-1 api-2
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-1
  sleep 10
  curl -fsS https://api.servi-x.com/api/v1/health | head -3
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-2
  sleep 10
  curl -fsS https://api.servi-x.com/api/v1/health | head -3
EOF
```

## Step 2 — Watch logs during soak

```bash
ssh servix-admin@194.163.158.70 'sudo docker logs --since=1m -f $(sudo docker ps --filter name=api-1 -q | head -1)' 2>&1 | grep -E "WS handshake|Client connected"
```

What to look for in the 24h window:
- `Client connected: … | tenant=… user=…` — clients on the new handshake, pinned from JWT (good).
- `Client connected (legacy, flag off): …` — clients still on the old `query.tenantId`. Expected during step 1; they should disappear after step 2.
- `WS handshake would be rejected but WS_AUTH_ENFORCE=false … reason="…"` — clients that fail validation. Investigate the reason before flipping the flag. `Missing access token` for legacy clients is fine; anything else is a bug.

## Step 3 — Ship frontend (Commit 2)

Dashboard already targets the new handshake after this PR merges; deployment is via the standard `apps/dashboard` build pipeline. Verify by:
1. Open the dashboard, sign in.
2. DevTools → Network → WS → confirm the connect request carries `auth: { token: "…" }` in the handshake payload (Socket.IO sends it as a query field on the engine.io polling phase or in the websocket upgrade headers, depending on transport).
3. Backend logs should now show `Client connected: … | tenant=… user=…` for these sessions, not the legacy line.

## Step 4 — Flip the flag

```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  set -e
  cd /home/servix-admin/servix
  sudo sed -i 's/^WS_AUTH_ENFORCE=.*$/WS_AUTH_ENFORCE=true/' tooling/docker/.env
  grep WS_AUTH_ENFORCE tooling/docker/.env
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-1
  sleep 10
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-2
EOF
```

Smoke test:
```bash
# Anonymous probe — must be rejected
node -e "const io=require('socket.io-client');const s=io('https://api.servi-x.com/ws');s.on('disconnect',(r)=>{console.log('rejected:',r);process.exit(0);});setTimeout(()=>{console.error('NOT rejected — V-01 enforcement failed');process.exit(1)},5000);"
```

## Rollback

If clients start failing after step 4:
```bash
ssh servix-admin@194.163.158.70 << 'EOF'
  cd /home/servix-admin/servix
  sudo sed -i 's/^WS_AUTH_ENFORCE=.*$/WS_AUTH_ENFORCE=false/' tooling/docker/.env
  sudo docker compose -f tooling/docker/docker-compose.prod.yml up -d --force-recreate --no-deps api-1 api-2
EOF
```

If the backend code itself is broken (rare — covered by 9 e2e tests + manual smoke), `git revert` the V-01 commits and redeploy.

## Caveats

1. **Multi-tenant JWT pinning** — users linked to more than one tenant (confirmed on prod: `ptoll2055@gmail.com`) get a JWT pinned to *one* tenant. The WS guard treats the JWT as source of truth and will reject mismatched query.tenantId. UX gap is filled by V-01b (Engineer 3, E5) — new `/auth/switch-tenant` endpoint.
2. **Token expiry** — access tokens expire in 15 minutes. The frontend already refreshes via the existing refresh flow; after refresh the WS will reconnect with the new token (the Zustand store update triggers the `useEffect` dependency change).
3. **Smart-Menu / Self-Order** — anonymous customers visit `/m/<slug>/<orderCode>` and subscribe to the `order:<slug>:<code>` room. These have no JWT. Today they continue to work because `orderRoom` is still pulled from query in `handleConnection` (it's not a tenant-scoped room — it's a per-order ephemeral channel that anyone with the order code can join, which is how the QR-code feature works by design). This is intentional and out of V-01 scope. Future card: per-order signed token if needed.
4. **Defense in depth** — even if a client sends an `auth.token` AND a `query.tenantId`, the guard enforces equality (`ForbiddenException` on mismatch) before joining any room. The query field is never trusted to populate the user-pinned rooms.
