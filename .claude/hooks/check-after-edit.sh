#!/bin/bash
# PostToolUse (Edit|Write): after Claude changes a scholr source file, lint that
# file and run the test suite (about a second). Exit 2 sends the problem to
# Claude on the spot; silence means all clear. The edit is never blocked: the
# tool has already run, so exit 2 only reports.
#
# Only errors matter: the lint baseline is 14 warnings, 0 errors.
command -v jq >/dev/null 2>&1 || exit 0
f=$(jq -r '.tool_input.file_path // empty' 2>/dev/null)
[ -n "$f" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
case "$f" in
  "$root"/src/*.js|"$root"/src/*.jsx|"$root"/server/*.js|"$root"/server/*.mjs) ;;
  *) exit 0 ;;
esac
case "$(basename "$f")" in _*) exit 0 ;; esac   # throwaway scripts (server/_t.mjs)
case "$f" in */node_modules/*) exit 0 ;; esac
[ -f "$f" ] || exit 0

cd "$root" || exit 0
out=$(node_modules/.bin/eslint --quiet "$f" 2>&1)
if [ $? -ne 0 ]; then
  printf 'ESLint errors in %s:\n%s\n' "${f#$root/}" "$out" >&2
  exit 2
fi

case "$f" in
  *.test.js) ;;                                       # a test file: run the suite
  "$root"/src/*.js|"$root"/server/*.js|"$root"/server/*.mjs) ;;  # logic: run the suite
  *) exit 0 ;;                                        # .jsx: lint is enough, no tests cover it
esac
out=$(npm test --silent 2>&1)
if [ $? -ne 0 ]; then
  printf 'Tests failing after editing %s:\n%s\n' "${f#$root/}" "$(printf '%s\n' "$out" | grep -E '^(✖|not ok)|AssertionError|^[[:space:]]+(actual|expected):|^[[:space:]]+at ' | grep -v '✔' | head -30)" >&2
  exit 2
fi
exit 0
