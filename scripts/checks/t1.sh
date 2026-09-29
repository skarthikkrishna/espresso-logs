#!/bin/sh
# t1.sh — walking skeleton + idempotent refresh command (guards: FR11).
# Doubles as the build/verify boot-exercise: frontend typechecks+builds, design tokens
# pass, and FR11 NotFound is migrated onto ToneStateCard (first page adopter of it).
# Reuse this as the refresh command; per-page checks t2..t11 skip the full build.
set -eu

FE="$(CDPATH= cd -- "$(dirname -- "$0")/../../frontend" && pwd)"

if ( cd "$FE" && npm run build >/tmp/janus-t1-build.out 2>&1 ); then
  echo "PASS: frontend build (tsc && vite build)"
else
  echo "FAIL: frontend build — see /tmp/janus-t1-build.out"; tail -20 /tmp/janus-t1-build.out; exit 1
fi

if ( cd "$FE" && npm run test:tokens >/tmp/janus-t1-tokens.out 2>&1 ); then
  echo "PASS: test:tokens (token unification + tone guards)"
else
  echo "FAIL: test:tokens — see /tmp/janus-t1-tokens.out"; tail -20 /tmp/janus-t1-tokens.out; exit 1
fi

# FR11 NotFound migration (grep + vitest), via the shared helper.
sh "$(dirname -- "$0")/_page_migrated.sh" NotFound

echo "PASS: t1 walking skeleton green"
