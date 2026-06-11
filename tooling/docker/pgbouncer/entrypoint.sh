#!/bin/sh
# Generate PgBouncer userlist.txt from environment variables.
# Runs once at container startup.
#
# V-28: PGBOUNCER_USER / PGBOUNCER_PASSWORD now refer to the dedicated
# pgbouncer_auth role (NOSUPERUSER, EXECUTE-only on pgbouncer.user_lookup).
# A leaked userlist.txt therefore exposes a role that can ONLY call that
# one SECURITY DEFINER function — not the postgres superuser.

set -eu

USERLIST_FILE="/etc/pgbouncer/userlist.txt"

if [ -z "${PGBOUNCER_USER:-}" ] || [ -z "${PGBOUNCER_PASSWORD:-}" ]; then
  echo "pgbouncer-entrypoint: FATAL — PGBOUNCER_USER or PGBOUNCER_PASSWORD is empty. Refusing to start." >&2
  exit 1
fi

printf '"%s" "%s"\n' "${PGBOUNCER_USER}" "${PGBOUNCER_PASSWORD}" > "$USERLIST_FILE"
chmod 600 "$USERLIST_FILE"
echo "pgbouncer-entrypoint: userlist.txt generated for user ${PGBOUNCER_USER} (mode $(stat -c %a "$USERLIST_FILE" 2>/dev/null || echo '?'))"

exec pgbouncer /etc/pgbouncer/pgbouncer.ini
