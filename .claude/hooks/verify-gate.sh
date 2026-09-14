#!/bin/sh
# Stop hook. After a turn ends, run tsc --noEmit, lint and the test suite so an
# auto-mode turn cannot leave the tree broken. (Coverage is left to CI so the
# gate stays fast enough to run on every code-changing turn.) On failure, block
# the stop and feed the output back so the error gets fixed before control
# returns to the user.

input=$(cat)

# Already inside a stop-triggered continuation: don't re-run and loop forever.
[ "$(printf '%s' "$input" | jq -r '.stop_hook_active // false')" = "true" ] && exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0

# Nothing code-y changed this session: skip the (slow) gate.
if ! git status --porcelain 2>/dev/null | grep -qE '\.(ts|tsx|js|jsx)$'; then
  exit 0
fi

out=$(yarn verify:fast 2>&1)
status=$?

[ "$status" -eq 0 ] && exit 0

# Failed. Block the stop; hand back the tail of the output (last ~150 lines,
# where tsc/lint/jest print what actually broke).
reason=$(printf '%s' "$out" | tail -n 150)
jq -n --arg r "The verification gate failed. Fix this before finishing:

$reason" '{decision: "block", reason: $r}'
