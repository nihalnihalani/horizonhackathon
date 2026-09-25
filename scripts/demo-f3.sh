#!/usr/bin/env bash
# One command: start the desk and control if they are not already listening, then run fixture F3 end to end.
# Logs: artifacts/logs/{desk,control}.log. Everything binds 127.0.0.1. Never prints .env values.
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p artifacts/logs
listening() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }
if ! listening 4401; then nohup npm run dev:desk > artifacts/logs/desk.log 2>&1 & sleep 3; fi
if ! curl -fsS http://127.0.0.1:4400/health 2>/dev/null | grep -q '"mode":"control"'; then
  if listening 4400; then echo "port 4400 is held by something other than DR control (stub?) — stop it first: lsof -tiTCP:4400 -sTCP:LISTEN | xargs kill"; exit 2; fi
  nohup npm run dev:control > artifacts/logs/control.log 2>&1 & sleep 4
fi
curl -fsS http://127.0.0.1:4401/health >/dev/null && curl -fsS http://127.0.0.1:4400/health >/dev/null
npm run --silent demo:f3 -- "$@"
