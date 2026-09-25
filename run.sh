#!/usr/bin/env bash
# Dead Reckoning — run the whole project from one script.
#
#   ./run.sh              same as ./run.sh up
#   ./run.sh up [--phone] start everything that is not already running (idempotent):
#                         Liquid llama-server · Postgres (pgvector) · public status-feed tunnel · desk · control ·
#                         OpenBot console; --phone also starts the allowlisted phone gateway + its tunnel
#   ./run.sh status       what is up, on which address, and the URLs to open
#   ./run.sh demo [f3b]   run the scripted live demo (fixture F3, or F3b: no accessible campsite)
#   ./run.sh test         type checks, lint, unit, recovery and bench tests (no live services needed)
#   ./run.sh doctor       readiness check (env presence, services, sockets) — never prints secret values
#   ./run.sh down         stop what this script started (by recorded PID / owned port only)
#
# Everything binds 127.0.0.1. The only public tunnels are the read-only status feed (4402, for Nimble) and,
# with --phone, the allowlisted phone gateway (4410). Never tunnel 4400, 4401, 3001 or 3010.
# Logs: artifacts/logs/*.log · PIDs: artifacts/run/*.pid · URLs: artifacts/run/*.url
set -uo pipefail
cd "$(dirname "$0")"
ROOT=$(pwd)
LOGS="$ROOT/artifacts/logs"; RUN="$ROOT/artifacts/run"; mkdir -p "$LOGS" "$RUN"
# Append (never prepend) tool paths so the project's own Node stays first (native modules are built for it).
export PATH="$PATH:$HOME/.bun/bin:/opt/homebrew/bin:/opt/homebrew/opt/postgresql@17/bin"

say()  { printf '\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '  \033[31m✗\033[0m %s\n' "$*"; exit 1; }

# ---- .env (read values into this shell without printing them)
[ -f .env ] || die "missing root .env — copy .env.example to .env and fill in the keys"
envval() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'; }
for k in RAWTREE_API_KEY NIMBLE_API_KEY OPENAI_API_KEY DR_PLANNER_MODEL DR_OPERATOR_TOKEN DR_WORLD_TOKEN DR_INTERNAL_TOKEN; do
  [ -n "$(envval "$k")" ] || warn "$k is empty in .env"
done

pid_on()   { lsof -nP -tiTCP:"$1" -sTCP:LISTEN 2>/dev/null | head -1; }
up_on()    { [ -n "$(pid_on "$1")" ]; }
wait_url() { for _ in $(seq 1 "$2"); do curl -sf -o /dev/null --max-time 2 "$1" && return 0; sleep 1; done; return 1; }
bg()       { local name=$1; shift; nohup "$@" > "$LOGS/$name.log" 2>&1 < /dev/null & echo $! > "$RUN/$name.pid"; disown 2>/dev/null || true; }
tunnel_url(){ grep -oE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOGS/$1.log" 2>/dev/null | tail -1; }

LIQ_URL=$(envval DR_LIQUID_BASE_URL); LIQ_URL=${LIQ_URL:-http://127.0.0.1:8080/v1}
LIQ_PORT=$(echo "$LIQ_URL" | sed -E 's#.*:([0-9]+).*#\1#')
# Prefer a llama-server that is already listening (it may be on a different port than .env says).
if ! lsof -nP -tiTCP:"$LIQ_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
  _other=$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk '/llama-ser/{print $9}' | sed -E 's/.*://' | head -1)
  [ -n "$_other" ] && { LIQ_PORT=$_other; LIQ_URL="http://127.0.0.1:$_other/v1"; }
fi

start_liquid() {
  if up_on "$LIQ_PORT"; then ok "Liquid already on 127.0.0.1:$LIQ_PORT"; return; fi
  # A llama-server may already be listening on another port (e.g. 8080 vs .env's 8081): reuse it.
  local other; other=$(lsof -nP -iTCP -sTCP:LISTEN 2>/dev/null | awk '/llama-ser/{print $9}' | sed -E 's/.*://' | head -1)
  if [ -n "$other" ]; then LIQ_PORT=$other; LIQ_URL="http://127.0.0.1:$other/v1"; ok "Liquid already on 127.0.0.1:$other (using it instead of .env's port)"; return; fi
  command -v llama-server >/dev/null || { warn "llama-server not installed (brew install llama.cpp); the curator will be unavailable"; return; }
  bg liquid llama-server -hf LiquidAI/LFM2.5-1.2B-Instruct-GGUF --host 127.0.0.1 --port "$LIQ_PORT" -c 4096 --jinja
  wait_url "http://127.0.0.1:$LIQ_PORT/v1/models" 600 && ok "Liquid started on 127.0.0.1:$LIQ_PORT" || warn "Liquid not ready yet (first run downloads ~1 GB); see $LOGS/liquid.log"
}

start_postgres() {
  if up_on 5433; then ok "Postgres already on 127.0.0.1:5433"; return; fi
  if command -v docker >/dev/null && docker info >/dev/null 2>&1 && docker ps -a --format '{{.Names}}' | grep -qx dr-postgres; then
    docker start dr-postgres >/dev/null && sleep 3 && ok "Postgres (docker dr-postgres) started" && return
  fi
  command -v postgres >/dev/null || { warn "no Postgres (brew install postgresql@17 pgvector); OpenBot will not start"; return; }
  local D="$ROOT/artifacts/pgdata"
  [ -d "$D" ] || initdb -D "$D" -U postgres --auth=trust >/dev/null
  bg postgres postgres -D "$D" -p 5433 -k "$RUN" -c listen_addresses=127.0.0.1
  for _ in $(seq 1 20); do psql -h 127.0.0.1 -p 5433 -U postgres -Atc 'select 1' >/dev/null 2>&1 && break; sleep 1; done
  for db in openbot openbot_test; do psql -h 127.0.0.1 -p 5433 -U postgres -Atc "select 1 from pg_database where datname='$db'" | grep -q 1 || createdb -h 127.0.0.1 -p 5433 -U postgres "$db"; done
  psql -h 127.0.0.1 -p 5433 -U postgres -d openbot -c 'create extension if not exists vector' >/dev/null 2>&1
  ok "Postgres started on 127.0.0.1:5433 (data: artifacts/pgdata)"
}

start_desk_control() {
  # Status page the runners observe: an existing tunnel URL (recorded or ngrok), else a new cloudflared quick tunnel.
  local feed=""
  if up_on 4401; then ok "desk already on 127.0.0.1:4401/4402"; fi
  if [ -f "$RUN/feed.url" ] && curl -sf -o /dev/null -A Mozilla/5.0 --max-time 5 "$(cat "$RUN/feed.url")/status.html"; then feed=$(cat "$RUN/feed.url"); fi
  if [ -z "$feed" ]; then feed=$(curl -s --max-time 2 http://127.0.0.1:4040/api/tunnels 2>/dev/null | grep -oE 'https://[^"]+' | head -1); fi
  if up_on 4400; then ok "control already on 127.0.0.1:4400 (restart with ./run.sh down && ./run.sh up to change its settings)"; return; fi
  export DR_LIQUID_BASE_URL="$LIQ_URL"
  local model; model=$(curl -s --max-time 3 "$LIQ_URL/models" 2>/dev/null | grep -oE '"id":"[^"]+"' | head -1 | cut -d'"' -f4)
  [ -n "$model" ] && export DR_LIQUID_MODEL="$model"
  export DR_OPENBOT_URL=${DR_OPENBOT_URL:-http://127.0.0.1:3001}
  export DR_REQUIRE_AGUI_ASSERTION=${DR_REQUIRE_AGUI_ASSERTION:-true}
  [ -n "$feed" ] && export DR_STATUS_URL="$feed/status.html"
  bg core node scripts/dev-core.mjs
  wait_url http://127.0.0.1:4400/health 40 && ok "desk 127.0.0.1:4401 (+feed 4402) and control 127.0.0.1:4400 started" || die "control did not start; see $LOGS/core.log"
  if [ -z "$feed" ]; then start_feed_tunnel; fi
}

start_feed_tunnel() {
  # Public read-only status feed for Nimble. Control resolves the URL at mission start, so restart control once it exists.
  if command -v ngrok >/dev/null && ngrok config check >/dev/null 2>&1; then
    bg feed-tunnel ngrok http 127.0.0.1:4402 --log stdout; sleep 4
    local u; u=$(curl -s --max-time 2 http://127.0.0.1:4040/api/tunnels | grep -oE 'https://[^"]+' | head -1)
  elif command -v cloudflared >/dev/null; then
    bg feed-tunnel cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4402
    local u=""; for _ in $(seq 1 30); do u=$(tunnel_url feed-tunnel); [ -n "$u" ] && break; sleep 1; done
  else
    warn "no ngrok/cloudflared: the runner will read the status page directly (labelled FALLBACK, not Nimble)"; return
  fi
  [ -n "${u:-}" ] || { warn "status-feed tunnel did not come up; see $LOGS/feed-tunnel.log"; return; }
  wait_url "$u/status.html" 30 >/dev/null
  echo "$u" > "$RUN/feed.url"; ok "status-feed tunnel $u/status.html"
  # restart control so the runners observe the tunnel (Nimble needs a public URL)
  kill "$(cat "$RUN/core.pid" 2>/dev/null)" 2>/dev/null; sleep 2
  export DR_STATUS_URL="$u/status.html"; bg core node scripts/dev-core.mjs
  wait_url http://127.0.0.1:4400/health 40 && ok "control restarted with DR_STATUS_URL=<tunnel>/status.html"
}

start_openbot() {
  if up_on 3010 && up_on 3001; then ok "OpenBot already on 127.0.0.1:3010 (API 3001)"; return; fi
  up_on 5433 || { warn "OpenBot skipped: no Postgres on 5433"; return; }
  [ -f apps/console/.env ] || { warn "OpenBot skipped: apps/console/.env missing (copy the OpenBot section of .env, DATABASE_URL on 5433)"; return; }
  command -v bun >/dev/null || { warn "OpenBot skipped: bun not installed"; return; }
  ( cd apps/console && { [ -d node_modules ] || bun install --frozen-lockfile >"$LOGS/openbot-install.log" 2>&1; } \
    && bun run --filter server db:migrate >"$LOGS/openbot-migrate.log" 2>&1 ) || { warn "OpenBot install/migrate failed; see $LOGS/openbot-*.log"; return; }
  ( cd apps/console && bg openbot bun run dev )
  wait_url http://127.0.0.1:3001/health 90 && wait_url http://127.0.0.1:3010/ 60 && ok "OpenBot started: http://127.0.0.1:3010" || warn "OpenBot not ready; see $LOGS/openbot.log"
}

start_phone() {
  up_on 4410 || { bg phone-gateway node scripts/phone-gateway.mjs; sleep 1; }
  if ! pgrep -f 'cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4410' >/dev/null; then
    command -v cloudflared >/dev/null || { warn "cloudflared not installed; phone tunnel skipped"; return; }
    bg phone-tunnel cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4410
  fi
  local u=""; for _ in $(seq 1 30); do u=$(tunnel_url phone-tunnel); [ -n "$u" ] && break; sleep 1; done
  [ -n "$u" ] && { echo "$u" > "$RUN/phone.url"; wait_url "$u/board" 30 >/dev/null; ok "phone board: $u/board  (paste the operator token once)"; } || warn "phone tunnel not ready; see $LOGS/phone-tunnel.log"
}

status() {
  say "Dead Reckoning services"
  for s in "Liquid:$LIQ_PORT" "Postgres:5433" "desk:4401" "status-feed:4402" "control:4400" "OpenBot-API:3001" "OpenBot-app:3010" "phone-gateway:4410"; do
    local n=${s%%:*} p=${s##*:} a; a=$(lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null | awk 'NR==2{print $9}')
    if [ -n "$a" ]; then printf '  %-15s up    %s\n' "$n" "$a"; else printf '  %-15s DOWN  (port %s)\n' "$n" "$p"; fi
  done
  [ -f "$RUN/feed.url" ] && echo "  status feed:   $(cat "$RUN/feed.url")/status.html"
  [ -f "$RUN/phone.url" ] && echo "  phone board:   $(cat "$RUN/phone.url")/board"
  echo "  board:         http://127.0.0.1:4400/board   (operator token: copy with"
  echo "                 grep -E '^DR_OPERATOR_TOKEN=' .env | cut -d= -f2- | tr -d '\\n' | pbcopy )"
  echo "  OpenBot chat:  http://127.0.0.1:3010  → Agents → Dead Reckoning → Start;"
  echo "                 say: plan my Angel Island trip · kill · close site A · resume"
}

down() {
  say "Stopping what run.sh started"
  for n in phone-tunnel phone-gateway openbot core feed-tunnel postgres liquid; do
    local f="$RUN/$n.pid"; [ -f "$f" ] || continue
    local pid; pid=$(cat "$f")
    if kill -0 "$pid" 2>/dev/null; then pkill -TERM -P "$pid" 2>/dev/null; kill "$pid" 2>/dev/null; ok "stopped $n (pid $pid)"; fi
    rm -f "$f"
  done
  rm -f "$RUN/phone.url"
  warn "services started outside run.sh (e.g. by scripts/dev.sh) were left running"
}

case "${1:-up}" in
  up)
    say "Starting Dead Reckoning (everything on 127.0.0.1)"
    [ -d node_modules ] || npm install --no-audit --no-fund >"$LOGS/npm-install.log" 2>&1
    start_liquid; start_postgres; start_desk_control; start_openbot
    [ "${2:-}" = "--phone" ] && start_phone
    echo; status ;;
  status) status ;;
  demo)
    up_on 4400 || die "control is not running; ./run.sh up first"
    if [ "${2:-}" = "f3b" ]; then npm run -s demo:f3b; else ./scripts/demo-f3.sh; fi ;;
  test)
    say "Checks (no live services needed)"
    npm run -s check:types && npm run -s check:lint && npm run -s test:unit && npm run -s test:recovery \
      && npx vitest run --config bench/vitest.config.ts && ok "all checks passed" ;;
  doctor) npm run -s demo:doctor ;;
  down) down ;;
  *) sed -n '2,17p' "$0" ;;
esac
