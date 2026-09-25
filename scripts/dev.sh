#!/usr/bin/env bash
# Start, stop and inspect every Dead Reckoning service without port collisions.
#
#   scripts/dev.sh status            which services are up
#   scripts/dev.sh up                start anything that is not already running (skips running ones)
#   scripts/dev.sh down              stop everything this script manages
#   scripts/dev.sh restart <name>    restart one service: liquid | desk | control | ngrok | openbot | public
#   scripts/dev.sh up public         also start the public OpenBot link (proxy + Cloudflare tunnel)
#
# "address already in use" from `npm run dev:desk` / `dev:control` just means that service is already
# running; use `scripts/dev.sh status` instead of starting a second copy.
# Stopping only ever signals the process that LISTENS on a service's own port (plus its npm/bun parent),
# never a range of ports. Logs: artifacts/logs/<service>.log. Never prints .env values.
set -uo pipefail
cd "$(dirname "$0")/.."
ROOT=$(pwd)
LOGS="$ROOT/artifacts/logs"; mkdir -p "$LOGS"
export PATH="$HOME/.bun/bin:$HOME/.cargo/bin:$PATH"

# name | port | start command (run from ROOT unless noted) | readiness URL
declare -a ORDER=(liquid desk control ngrok openbot)
port_of() { case $1 in liquid) echo 8081;; desk) echo 4401;; control) echo 4400;; ngrok) echo 4040;; openbot) echo 3010;; proxy) echo 3020;; esac; }

listening_pid() { lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -1; }
is_up() { [ -n "$(listening_pid "$1")" ]; }

wait_for() { # url, seconds
  for _ in $(seq 1 "$2"); do curl -sf -o /dev/null --max-time 2 "$1" && return 0; sleep 1; done; return 1
}

start_one() {
  local s=$1 p; p=$(port_of "$s")
  if is_up "$p"; then echo "  $s: already running (port $p)"; return 0; fi
  case $s in
    liquid)
      nohup llama-server -hf LiquidAI/LFM2.5-1.2B-Instruct-GGUF -c 4096 --jinja --host 127.0.0.1 --port 8081 \
        --temp 0.1 --top-k 50 --repeat-penalty 1.05 > "$LOGS/llama-server.log" 2>&1 &
      wait_for http://127.0.0.1:8081/health 120 ;;
    desk)
      nohup npm run dev:desk > "$LOGS/desk.log" 2>&1 &
      wait_for http://127.0.0.1:4401/health 30 ;;
    control)
      is_up 4401 || { echo "  control: start the desk first"; return 1; }
      nohup npm run dev:control > "$LOGS/control.log" 2>&1 &
      wait_for http://127.0.0.1:4400/health 40 ;;
    ngrok)
      nohup ngrok http 127.0.0.1:4402 --log stdout > "$LOGS/ngrok.log" 2>&1 &
      wait_for http://127.0.0.1:4040/api/tunnels 20 ;;
    openbot)
      if ! docker ps --format '{{.Names}}' 2>/dev/null | grep -qx dr-postgres; then
        docker info >/dev/null 2>&1 || { colima stop --force >/dev/null 2>&1; colima start >/dev/null 2>&1; }
        docker start dr-postgres >/dev/null 2>&1 || { echo "  openbot: Postgres container dr-postgres will not start"; return 1; }
        sleep 3
      fi
      (cd apps/console && nohup bun run --filter app --filter server --parallel dev > "$LOGS/openbot-dev.log" 2>&1 &)
      wait_for http://127.0.0.1:3001/health 90 && wait_for http://127.0.0.1:3010 60 ;;
  esac
  if is_up "$p"; then echo "  $s: started (port $p)"; else echo "  $s: FAILED to start; see $LOGS"; return 1; fi
}

stop_pid_and_parent() {
  local pid=$1 parent
  [ -z "$pid" ] && return 0
  parent=$(ps -o ppid= -p "$pid" 2>/dev/null | tr -d ' ')
  kill "$pid" 2>/dev/null
  # npm / bun wrapper that launched it (never pid 1)
  if [ -n "$parent" ] && [ "$parent" != 1 ] && ps -o command= -p "$parent" 2>/dev/null | grep -qE 'npm|bun run|dr-run.mjs|tsx'; then kill "$parent" 2>/dev/null; fi
}

stop_one() {
  local s=$1 p; p=$(port_of "$s")
  case $s in
    openbot)
      stop_pid_and_parent "$(listening_pid 3010)"; stop_pid_and_parent "$(listening_pid 3001)"
      pkill -f 'bun run --filter app --filter server --parallel dev' 2>/dev/null ;;
    control)
      stop_pid_and_parent "$(listening_pid 4400)"; pkill -f 'packages/control/src/server.ts' 2>/dev/null ;;
    desk)
      stop_pid_and_parent "$(listening_pid 4401)"; pkill -f 'packages/desk/src/server.ts' 2>/dev/null ;;
    public)
      pkill -f 'cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3020' 2>/dev/null
      pkill -f 'scripts/openbot-public-proxy.mjs' 2>/dev/null; return 0 ;;
    *) stop_pid_and_parent "$(listening_pid "$p")" ;;
  esac
  sleep 1
  if is_up "$p"; then echo "  $s: still running on port $p"; else echo "  $s: stopped"; fi
}

start_public() {
  is_up 3020 || { nohup node scripts/openbot-public-proxy.mjs > "$LOGS/openbot-proxy.log" 2>&1 & sleep 1; }
  if ! pgrep -f 'cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3020' >/dev/null; then
    nohup cloudflared tunnel --no-autoupdate --url http://127.0.0.1:3020 > "$LOGS/cloudflared-openbot.log" 2>&1 &
  fi
  for _ in $(seq 1 30); do
    u=$(grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOGS/cloudflared-openbot.log" 2>/dev/null | tail -1)
    [ -n "$u" ] && break; sleep 1
  done
  echo "  public OpenBot link: ${u:-not ready yet, see $LOGS/cloudflared-openbot.log} (anyone with it is an admin)"
}

status() {
  for s in "${ORDER[@]}"; do
    p=$(port_of "$s"); printf "  %-8s %-6s %s\n" "$s" "$p" "$(is_up "$p" && echo up || echo DOWN)"
  done
  printf "  %-8s %-6s %s\n" postgres 5433 "$(docker ps --format '{{.Names}}' 2>/dev/null | grep -qx dr-postgres && echo up || echo DOWN)"
  printf "  %-8s %-6s %s\n" public 3020 "$(is_up 3020 && pgrep -f 'cloudflared tunnel' >/dev/null && echo up || echo off)"
  t=$(curl -s --max-time 2 http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -oE 'https://[^"]+ngrok[^"]+' | head -1)
  [ -n "$t" ] && echo "  status page tunnel: $t/status.html"
  echo "  board: http://127.0.0.1:4400/board · OpenBot: http://127.0.0.1:3010"
}

case "${1:-status}" in
  status) status ;;
  up)
    for s in "${ORDER[@]}"; do start_one "$s"; done
    [ "${2:-}" = public ] && start_public
    status ;;
  down)
    stop_one public
    for s in openbot control ngrok desk liquid; do stop_one "$s"; done ;;
  restart)
    s=${2:?usage: scripts/dev.sh restart <liquid|desk|control|ngrok|openbot|public>}
    if [ "$s" = public ]; then stop_one public; start_public; else stop_one "$s"; start_one "$s"; fi ;;
  *) sed -n '2,12p' "$0" ;;
esac
