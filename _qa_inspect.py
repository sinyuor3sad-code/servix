import paramiko, os, time
os.environ['PYTHONIOENCODING'] = 'utf-8'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('130.94.57.77', username='root', password='5j#a9Bmw#+M-*dV', timeout=15)

def run(cmd, timeout=300):
    return ssh.exec_command(cmd, timeout=timeout)[1].read().decode('utf-8', errors='replace').strip()

print('1. Pull...')
run('cd /root/servix && git pull origin main 2>&1')

print('2. Build admin...')
out = run('cd /root/servix/tooling/docker && docker compose -f docker-compose.prod.yml build admin 2>&1', timeout=300)
lines = out.split('\n')
for l in lines[-3:]:
    print(f'   {l}')

print('3. Deploy...')
run('cd /root/servix/tooling/docker && docker compose -f docker-compose.prod.yml up -d admin 2>&1')
time.sleep(20)

out = run('docker ps --format "{{.Names}}: {{.Status}}" --filter name=servix-admin')
print(f'4. {out}')

for p in ['/login', '/manifest.json', '/icons/icon-192.png']:
    code = run(f'curl -s -o /dev/null -w "%{{http_code}}" -k https://127.0.0.1{p} -H "Host: admin.servi-x.com" 2>&1')
    print(f'   {p}: HTTP {code}')

ssh.close()
print('\n✅')
