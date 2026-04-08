# Runbook: Redis Down

## Severity: 🟡 High (system degrades gracefully but performance drops)

## Symptoms
- Slow API responses (cache misses hit DB directly)
- Tenant middleware logs: `Redis connection error`
- WebSocket real-time updates stop (if using Redis adapter)
- Rate limiting stops working (login brute-force possible)
- BullMQ job processing halts

## Diagnosis

### Step 1: Check container status
```bash
docker ps -a --filter name=servix-redis
docker logs servix-redis --tail 30
```

### Step 2: Test Redis connectivity
```bash
docker exec servix-redis redis-cli -a ${REDIS_PASSWORD} ping
# Expected: PONG
```

### Step 3: Check memory
```bash
docker exec servix-redis redis-cli -a ${REDIS_PASSWORD} info memory
# Watch for: used_memory_peak_human, maxmemory
```

### Step 4: Check API degradation
```bash
# API should still respond (graceful degradation)
curl -s https://api.servi-x.com/api/v1/health/live
```

## Resolution

### A: Container crashed — restart
```bash
docker compose -f tooling/docker/docker-compose.prod.yml restart redis
sleep 5
docker exec servix-redis redis-cli -a ${REDIS_PASSWORD} ping
```

### B: Memory exhaustion
```bash
# Check current usage
docker exec servix-redis redis-cli -a ${REDIS_PASSWORD} info memory

# Flush expired keys
docker exec servix-redis redis-cli -a ${REDIS_PASSWORD} \
  eval "local keys = redis.call('keys', 'servix:*'); local deleted = 0; for i,k in ipairs(keys) do if redis.call('ttl', k) == -1 then redis.call('del', k); deleted = deleted + 1 end end; return deleted" 0

# Last resort: flush all caches (data will rebuild from DB)
docker exec servix-redis redis-cli -a ${REDIS_PASSWORD} FLUSHALL
```

### C: Connection refused — check config
```bash
# Verify password
docker exec servix-redis redis-cli -a ${REDIS_PASSWORD} CONFIG GET requirepass

# Check max connections
docker exec servix-redis redis-cli -a ${REDIS_PASSWORD} CONFIG GET maxclients

# Check connected clients
docker exec servix-redis redis-cli -a ${REDIS_PASSWORD} CLIENT LIST | wc -l
```

## Impact Assessment
| Feature              | Impact when Redis is down        |
|----------------------|----------------------------------|
| Tenant cache         | ⚠️ Slower (hits DB every time)   |
| Settings cache       | ⚠️ Slower (hits DB every time)   |
| Rate limiting        | 🔴 Disabled (security risk)      |
| Token blacklist      | ⚠️ Falls back to DB blacklist    |
| BullMQ jobs          | 🔴 Stops processing              |
| WebSocket (if Redis) | 🔴 Stops in multi-instance       |

## Post-Incident
- [ ] Verify cache is warming up (check logs)
- [ ] Monitor rate limiting is active
- [ ] Check BullMQ DLQ for missed jobs
- [ ] Review Redis memory configuration
