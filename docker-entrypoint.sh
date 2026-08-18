#!/bin/sh
set -eu
umask 077

state_dir=/var/lib/ekuiper-manager
key_file="$state_dir/manager.key"

mkdir -p "$state_dir"
if [ -z "${MANAGER_SECRET_KEY:-}" ]; then
  if [ ! -f "$key_file" ]; then
    node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('base64url'))" > "$key_file"
    chmod 600 "$key_file"
  fi
  MANAGER_SECRET_KEY=$(cat "$key_file")
  export MANAGER_SECRET_KEY
fi

node scripts/migrate.mjs
exec "$@"
