import paramiko, time, json, os
os.environ['PYTHONIOENCODING'] = 'utf-8'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('130.94.57.77', username='root', password='5j#a9Bmw#+M-*dV', timeout=15)

def run(cmd, timeout=30):
    stdin, stdout, stderr = ssh.exec_command(cmd, timeout=timeout)
    out = stdout.read().decode('utf-8', errors='replace').strip()
    err = stderr.read().decode('utf-8', errors='replace').strip()
    return out, err

print('=== 1. BACKUP CONTAINER DIAGNOSIS ===')
# Check why backup is restarting
out, _ = run('docker logs servix-backup --tail 30 2>&1')
print(f'Backup logs:\n{out}')

print('\n=== 2. BACKUP COMPOSE CONFIG ===')
out, _ = run("grep -A 20 'backup:' /root/servix/tooling/docker/docker-compose.prod.yml")
print(out)

print('\n=== 3. BACKUP SCRIPT ===')
out, _ = run('cat /root/servix/tooling/docker/backup.sh 2>&1 || echo "Not found"')
print(f'backup.sh:\n{out[:800]}')

print('\n=== 4. HOST POSTGRESQL STATUS ===')
out, _ = run('systemctl is-active postgresql@14-main.service 2>&1')
print(f'Host PostgreSQL: {out}')

print('\n=== 5. DASHBOARD CONTAINER STATUS ===')
out, _ = run('docker ps --format "table {{.Names}}\t{{.Status}}" | grep -E "dashboard|booking|landing|admin|api|nginx"')
print(f'Containers:\n{out}')

print('\n=== 6. DASHBOARD HEALTH ===')
out, _ = run('curl -s -o /dev/null -w "%{http_code}" -k https://127.0.0.1 -H "Host: app.servi-x.com" 2>&1')
print(f'Dashboard HTTP: {out}')

print('\n=== 7. ALL PINGS ===')
for host in ['servi-x.com', 'api.servi-x.com', 'admin.servi-x.com', 'app.servi-x.com', 'booking.servi-x.com']:
    out, _ = run(f'curl -s -o /dev/null -w "%{{http_code}}" -k https://127.0.0.1 -H "Host: {host}" 2>&1')
    print(f'  {host}: HTTP {out}')

print('\n=== 8. DISK SPACE ===')
out, _ = run('df -h / | tail -1')
print(f'Disk: {out}')

print('\n=== 9. MEMORY ===')
out, _ = run('free -h | head -2')
print(f'Memory:\n{out}')

print('\n=== 10. DOCKER VOLUMES ===')
out, _ = run('docker volume ls --format "{{.Name}}" | grep servix')
print(f'Volumes: {out}')

ssh.close()
