import paramiko, os, time
os.environ['PYTHONIOENCODING'] = 'utf-8'

ssh = paramiko.SSHClient()
ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
ssh.connect('130.94.57.77', username='root', password='5j#a9Bmw#+M-*dV', timeout=15)

def run(cmd, timeout=30):
    return ssh.exec_command(cmd, timeout=timeout)[1].read().decode('utf-8', errors='replace').strip()

# Wait for healthy
time.sleep(5)

# The Next.js standalone server doesn't serve public/ files. The fix: use next.config.ts output: 'standalone' usually 
# expects handling via nginx. But actually the _next static files DO work because they're served by next itself.
# For public files, we need to either:
# 1. Turn off standalone mode and run with `next start` 
# 2. Or add a custom server that serves public files

# Let's check if the admin next.config has standalone output
out = run('docker exec servix-admin cat /app/apps/admin/next.config.ts 2>&1 || docker exec servix-admin cat /app/apps/admin/next.config.js 2>&1')
print(f'Config in container:\n{out}')

# Check the local file
ssh.close()
