#!/bin/sh
# Generate PgBouncer userlist.txt from environment variables
# This runs once at container startup to create auth credentials

USERLIST_FILE="/etc/pgbouncer/userlist.txt"

if [ -n "$PGBOUNCER_USER" ] && [ -n "$PGBOUNCER_PASSWORD" ]; then
  echo "\"${PGBOUNCER_USER}\" \"${PGBOUNCER_PASSWORD}\"" > "$USERLIST_FILE"
  echo "pgbouncer-entrypoint: userlist.txt generated for user ${PGBOUNCER_USER}"
else
  echo "pgbouncer-entrypoint: WARNING - PGBOUNCER_USER or PGBOUNCER_PASSWORD not set"
  echo "\"postgres\" \"\"" > "$USERLIST_FILE"
fi

# Start PgBouncer with custom config
exec pgbouncer /etc/pgbouncer/pgbouncer.ini
