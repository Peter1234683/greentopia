#!/bin/bash
# 브라우저 E2E 회귀 테스트 (Playwright). 프로덕션 빌드 후 실행:
#   npm run build && bash e2e/run.sh
# 각 그룹마다 DB를 다시 시드하고 서버(포트 3000)를 새로 띄운다.
set -u
cd "$(dirname "$0")/.."
mkdir -p e2e/shots
start() {
  pkill -f "[n]ext-server" ; sleep 1
  npm run db:seed > /dev/null 2>&1
  SHOW_DEMO_ACCOUNTS=1 DEMO_TOOLS=1 PORT=3000 nohup npx next start > e2e/shots/server.log 2>&1 &
  for _ in $(seq 1 60); do curl -s -o /dev/null localhost:3000 && return; sleep 0.5; done
}
fail=0
run() {
  local out; out=$(node "e2e/$1.js" 2>&1)
  local oks; oks=$(echo "$out" | grep -c '^ok')
  local bad; bad=$(echo "$out" | grep -E 'FAIL|Error' | grep -v 'agent-proxy' )
  echo "== $1: $oks ok"
  if [ -n "$bad" ]; then echo "$bad" | head -5; fail=1; fi
}
for group in "e2e-p2" "e2e-m1 e2e-m2 e2e-m3" "e2e-m4" "e2e-m5" "e2e-m6" "e2e-m7 e2e-m8" "e2e-m9" "e2e-demo"; do
  start
  for t in $group; do run "$t"; done
done
pkill -f "[n]ext-server"
exit $fail
