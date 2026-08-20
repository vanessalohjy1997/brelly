#!/bin/sh
# PreToolUse on Edit|Write. PLAN.md, NOTES.md and UX.md are injected wholesale
# at SessionStart, so this is left with the one requirement that cannot be
# injected from a local file: the Expo docs are versioned and live on the web.
path=$(jq -r '.tool_input.file_path // ""')

case "$path" in
  *.ts|*.tsx|*.js|*.jsx) ;;
  *) exit 0 ;;
esac

jq -n --arg ctx "Expo here is v57. For any Expo or React Native API you are not certain of, check https://docs.expo.dev/versions/v57.0.0/ rather than recalling an older SDK — a v52-era answer often typechecks and is still wrong." \
  '{hookSpecificOutput: {hookEventName: "PreToolUse", additionalContext: $ctx}}'
