# Disaster Recovery Test Procedure

## Schedule
Every 3 months: January, April, July, October (first Tuesday)

## Pre-requisites
- [ ] DR site (nbg1) is operational
- [ ] Streaming replication is active (lag < 10s)
- [ ] Team notified 24 hours in advance
- [ ] Latest backup verified via `verify-backup.sh`

## Test Procedure

### 1. Preparation (T-0)
```bash
# Record baseline metrics
kubectl get pods -n servix
psql -c "SELECT count(*) FROM \"Tenant\""
psql -c "SELECT count(*) FROM \"User\""
psql -c "SELECT pg_last_wal_replay_lsn()" # on DR
```

### 2. Take Final Backup (T+2min)
```bash
bash tooling/scripts/backup.sh
```

### 3. Execute Failover (T+5min)
```bash
PRIMARY_IP=194.163.158.70 \
DR_IP=<DR_IP> \
CF_ZONE_ID=<zone_id> \
CF_API_TOKEN=<token> \
bash tooling/scripts/failover.sh
```

### 4. Verify Services (T+10min)
| Service | URL | Expected |
|---------|-----|----------|
| API Health | `https://api.servi-x.com/api/v1/health/ready` | 200 |
| Dashboard | `https://dashboard.servi-x.com` | 200 |
| Booking | `https://booking.servi-x.com` | 200 |
| Admin | `https://admin.servi-x.com` | 200 |

### 5. Data Consistency Check (T+15min)
```bash
# Compare record counts with baseline
psql -h <DR_IP> -U servix -c "SELECT count(*) FROM \"Tenant\""
psql -h <DR_IP> -U servix -c "SELECT count(*) FROM \"User\""
```

### 6. Execute Failback (T+20min)
```bash
bash tooling/scripts/failback.sh
```

### 7. Verify Recovery (T+25min)
- [ ] All services responding from primary
- [ ] Replication re-established
- [ ] Monitoring targets updated

## Success Criteria
- [ ] RTO (Recovery Time Objective) < 30 minutes
- [ ] RPO (Recovery Point Objective) < 1 hour
- [ ] Zero data loss during failover
- [ ] All 4 services responding after failover
- [ ] Successful failback to primary

## Results Template

```
Date: YYYY-MM-DD
RTO Actual: ___ minutes
RPO Actual: ___ minutes
Data Loss: None / ___ records
Services Verified: API ✅/❌ | Dashboard ✅/❌ | Booking ✅/❌ | Admin ✅/❌
Failback: ✅/❌
Issues Found: <description>
Action Items: <items>
Conducted By: <name>
```
