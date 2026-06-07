#!/usr/bin/env bash
# Deploy source files to a Linux server and rebuild the app.
#
# Usage:
#   ./scripts/deploy.sh user@host:/path/to/app
#
# Requirements on the remote server:
#   - Node.js 18+  (npm is included)
#   - pm2           (npm i -g pm2)   — keeps the process alive across rebuilds
#
# If you don't use pm2, replace the last ssh line with:
#   ssh "$HOST" "cd $REMOTE_PATH && nohup npm start > app.log 2>&1 &"

set -euo pipefail

TARGET=${1:?Usage: $0 user@host:/path/to/app}
HOST="${TARGET%%:*}"
REMOTE_PATH="${TARGET#*:}"

echo "==> Syncing files to $TARGET …"
ssh "$HOST" "mkdir -p '$REMOTE_PATH'"
tar --exclude=./node_modules \
    --exclude=./.next \
    --exclude=./data \
    --exclude=./.git \
    --exclude=./screenshots \
    --exclude='./*.env' \
    -czf - . \
  | ssh "$HOST" "cd '$REMOTE_PATH' && tar -xzf -"

echo "==> Building on $HOST …"
ssh "$HOST" bash -s <<EOF
  export NVM_DIR="\$HOME/.nvm"
  [ -s "\$NVM_DIR/nvm.sh" ] && \. "\$NVM_DIR/nvm.sh"
  set -euo pipefail
  cd "$REMOTE_PATH"
  npm ci --omit=dev
  npm run build
  pm2 restart mc-mods 2>/dev/null || PORT=5127 pm2 start npm --name mc-mods -- start
  echo "==> Done. App running via pm2 as 'mc-mods'."
EOF
