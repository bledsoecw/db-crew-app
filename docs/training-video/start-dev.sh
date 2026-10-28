#!/bin/bash
# Serve the app for the recording: the static public/ folder on :8100, with no
# cache. The phone in the video talks only to dev/mock.js (fixtures.js's data);
# studio.mjs refuses every request that is not this server or the dev board.
#
#   ./start-dev.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PUB="$HERE/../../dbtimeclock-pwa/public"
for pid in $(pgrep -f "[h]ttp-server .*8100" || true); do kill "$pid" 2>/dev/null || true; done
sleep 1
nohup npx --yes http-server "$PUB" -p 8100 -c-1 -s > /tmp/crew-video-http.log 2>&1 &
until curl -s -o /dev/null "http://localhost:8100/index.html"; do sleep 1; done
echo "app up on :8100"
