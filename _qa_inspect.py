import paramiko, os
os.environ['PYTHONIOENCODING'] = 'utf-8'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('130.94.57.77', username='root', password='5j#a9Bmw#+M-*dV', timeout=15)

def run(cmd, timeout=30):
    return ssh.exec_command(cmd, timeout=timeout)[1].read().decode('utf-8', errors='replace').strip()

print('=== Crash logs ===')
out = run('docker logs servix-admin --tail 30 2>&1')
print(out)

print('\n=== File check ===')
out = run('docker exec servix-admin ls -la /app/apps/admin/ 2>&1 || echo "Container not running"')
print(out)

ssh.close()
