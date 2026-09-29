#!/bin/sh
# t13.sh — NFR3 / D11: ToneProvider gains an optional `lockedTone` that fixes the
# tone, no-ops setTone/toggleTone, and never reads or writes localStorage. The bare
# provider (no lockedTone) keeps following persisted tone (D8). Strict tier.
# Emits PASS:/FAIL: lines; final line on success: PASS: t13 ...
set -eu

FE="$(CDPATH= cd -- "$(dirname -- "$0")/../../frontend" && pwd)"
SRC="$FE/src/contexts/ToneContext.tsx"
TEST="src/components/tone-system/__tests__/ToneContext.test.tsx"
[ -f "$SRC" ] || { echo "FAIL: $SRC not found"; exit 1; }

# Prop present on the provider signature.
grep -qE 'lockedTone\?: *Tone' "$SRC" \
  && echo "PASS: ToneProvider accepts an optional lockedTone prop" \
  || { echo "FAIL: ToneProvider has no optional lockedTone prop"; exit 1; }

# Read is short-circuited when locked (no localStorage read).
grep -qE 'lockedTone \?\? readStoredTone\(\)' "$SRC" \
  && echo "PASS: locked provider short-circuits the persisted read" \
  || { echo "FAIL: locked provider still reads persisted tone (no 'lockedTone ?? readStoredTone()')"; exit 1; }

# The context value is forced to the locked tone.
grep -qE 'tone: lockedTone \?\? tone' "$SRC" \
  && echo "PASS: context value is fixed to lockedTone when locked" \
  || { echo "FAIL: context value not forced to lockedTone"; exit 1; }

# setTone/toggleTone bail out when locked (no write).
[ "$(grep -cE 'if \(lockedTone\) return' "$SRC")" -ge 2 ] \
  && echo "PASS: setTone & toggleTone no-op while locked" \
  || { echo "FAIL: setTone/toggleTone missing the 'if (lockedTone) return' guard"; exit 1; }

if ( cd "$FE" && npx vitest run "$TEST" >/tmp/janus-t13-vitest.out 2>&1 ); then
  echo "PASS: ToneContext suite green (incl. lockedTone lock cases)"
else
  echo "FAIL: ToneContext suite — see /tmp/janus-t13-vitest.out"; tail -30 /tmp/janus-t13-vitest.out; exit 1
fi

echo "PASS: t13 ToneProvider lockedTone locks tone + skips localStorage"
