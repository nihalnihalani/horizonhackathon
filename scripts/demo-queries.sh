# Terminal prep for the demo's RawTree segment. Source it once, off camera, from the repo root:
#
#   source scripts/demo-queries.sh
#
# Defines rt (run a read-only query), $DR / $NV (latest finished Dead Reckoning / ordinary-agent run),
# and q1..q5, the five demo queries. Never prints .env values.
export PATH="$HOME/.cargo/bin:$PATH"
set -a; . ./.env; set +a

rt() { rtree query --database "$RAWTREE_DATABASE" "$1"; }
DR="(SELECT run_id FROM epochs WHERE arm = 'dr' AND reason = 'terminal' ORDER BY ts DESC LIMIT 1)"
NV="(SELECT run_id FROM epochs WHERE arm = 'naive' AND reason = 'terminal' ORDER BY ts DESC LIMIT 1)"

# 1. The crash in the log: same key, intent (epoch 1) → confirmed (epoch 2)
q1() { rt "SELECT epoch, slot, status, left(action_key, 10) AS key, receipt_id FROM commitments WHERE run_id = $DR ORDER BY rev"; }
# 2. The ferry receipt recovered from the desk
q2() { rt "SELECT epoch, slot, outcome, receipt_id, amount, recovered FROM receipts WHERE run_id = $DR ORDER BY rev"; }
# 3. Belief revision for Site A: active → stale → superseded → active (closed), Nimble task on every row
q3() { rt "SELECT epoch, status, left(toString(nimble_request_id), 8) AS nimble_task, excerpt FROM facts WHERE run_id = $DR AND key = 'site-A.status' ORDER BY rev"; }
# 4. Liquid's proposals and the validator's verdicts
q4() { rt "SELECT op, key, proposed_by, accepted, decision, curator_ms FROM context_ops WHERE run_id = $DR ORDER BY rev"; }
# 5. Planner context per step, both agents
q5() { rt "SELECT arm, groupArray(t) AS planner_tokens_per_step FROM (SELECT arm, toFloat64(assumeNotNull(context_tokens)) AS t FROM metrics WHERE phase = 'planner' AND (run_id = $DR OR run_id = $NV) ORDER BY toFloat64(assumeNotNull(rev))) GROUP BY arm"; }
# Bonus: the real web facts (ferry schedule, park notices) with their Nimble task ids
q6() { rt "SELECT epoch, key, status, left(toString(nimble_request_id), 8) AS nimble_task, excerpt FROM facts WHERE run_id = $DR AND startsWith(toString(key), 'real.') ORDER BY rev"; }

clear
echo "Demo queries ready: q1 commitments · q2 receipts · q3 Site A facts · q4 Liquid ops · q5 tokens · q6 real web"
