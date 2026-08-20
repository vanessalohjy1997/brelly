#!/bin/sh
# SessionStart. AGENTS.md used to require that PLAN.md, NOTES.md and UX.md be
# read before implementing; this puts their contents in context instead, so
# there is nothing left to remember to do.
#
# The whole of NOTES.md and UX.md would be ~150KB, so this injects only the
# parts the rule was ever about: the open task list, the traps section, and the
# UX items still unticked.
root="${CLAUDE_PROJECT_DIR:-.}"

plan=$(cat "$root/PLAN.md" 2>/dev/null)

# NOTES.md: the "Read this before writing code here" section, up to the next
# H2. The round history below it is archive, not a trap.
traps=$(awk '
  /^## Read this before writing code here/ { grab = 1 }
  grab && /^## / && !/^## Read this before writing code here/ { exit }
  grab { print }
' "$root/NOTES.md" 2>/dev/null)

# UX.md: unticked items only, each under the heading it sits below. An item
# runs until the next checkbox or heading.
ux=$(awk '
  /^#/ { heading = $0; next }
  /^[[:space:]]*-[[:space:]]*\[ \]/ {
    if (heading != last_printed) { print ""; print heading; last_printed = heading }
    printing = 1; print; next
  }
  /^[[:space:]]*-[[:space:]]*\[x\]/ { printing = 0; next }
  printing { print }
' "$root/UX.md" 2>/dev/null)

[ -z "$plan$traps$ux" ] && exit 0

ctx=$(printf '%s\n' \
  "Project docs, injected so they do not have to be recalled or re-read." \
  "" \
  "===== PLAN.md (open tasks) =====" \
  "$plan" \
  "" \
  "===== NOTES.md — read this before writing code here =====" \
  "$traps" \
  "" \
  "===== UX.md — items still open =====" \
  "$ux" \
  "" \
  "Round history in NOTES.md and ticked UX items are not included; read those files directly if you need them. Keep all three current: move finished work from PLAN.md into NOTES.md, and tick the UX item you addressed.")

jq -n --arg ctx "$ctx" \
  '{hookSpecificOutput: {hookEventName: "SessionStart", additionalContext: $ctx}}'
