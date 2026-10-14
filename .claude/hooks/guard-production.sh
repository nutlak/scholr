#!/bin/bash
# PreToolUse (Bash): scholr's local server/.env holds PRODUCTION credentials, and
# a booted server with workers on sends real email to real users. CLAUDE.md says
# DISABLE_WORKERS=1 must stay set; this makes that a rule instead of a habit.
# Exit 2 blocks the command and tells Claude why.
command -v jq >/dev/null 2>&1 || exit 0
cmd=$(jq -r '.tool_input.command // empty' 2>/dev/null)
[ -n "$cmd" ] || exit 0
root="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# 1. Starting the API server (node index.js, node server/index.js, npm start).
if printf '%s' "$cmd" | grep -Eq '(^|[;&|(]|[[:space:]])(node( --watch)?[[:space:]]+(\./)?(server/)?index\.js|npm[[:space:]]+(run[[:space:]]+)?start)([[:space:]]|$|[;&|)])'; then
  if ! printf '%s' "$cmd" | grep -q 'DISABLE_WORKERS=1' && ! grep -Eq '^[[:space:]]*DISABLE_WORKERS=1' "$root/server/.env" 2>/dev/null; then
    echo "Blocked: this would start the API server with workers ON, against the production database. DISABLE_WORKERS=1 is not set in server/.env or in the command. Set it (CLAUDE.md > Verify before you claim), then retry." >&2
    exit 2
  fi
fi

# 2. Calling the real mailers directly from an inline script.
if printf '%s' "$cmd" | grep -Eq '(sendWeeklyRecaps|processPendingEmails|sendOnboardingEmail|sendRecapEmail|sendOtpEmail|sendInviteEmail)[[:space:]]*\(' && ! printf '%s' "$cmd" | grep -q 'ALLOW_REAL_EMAIL=1'; then
  echo "Blocked: this calls a real email sender with production credentials, which emails real people. Preview with the *Html / planRecaps builders instead, or set ALLOW_REAL_EMAIL=1 on the command if Noah asked you to send." >&2
  exit 2
fi
exit 0
