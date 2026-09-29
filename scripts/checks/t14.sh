#!/bin/sh
# t14.sh — NFR3 / D11: retrofit the 4 already-built standalone pages to lock dark.
# Each must wrap its content in <ToneProvider lockedTone="dark"> and its suite (which
# now asserts the emitter's data-tone === "dark") must stay green. Strict tier.
# Emits PASS:/FAIL: lines; final line on success: PASS: t14 ...
set -eu

FE="$(CDPATH= cd -- "$(dirname -- "$0")/../../frontend" && pwd)"
PAGES="NotFound InviteExpired InviteInvalid Welcome"

for P in $PAGES; do
  SRC="$FE/src/pages/$P.tsx"
  [ -f "$SRC" ] || { echo "FAIL: $SRC not found"; exit 1; }
  if grep -qE 'ToneProvider lockedTone="dark"' "$SRC"; then
    echo "PASS: $P locks tone via <ToneProvider lockedTone=\"dark\">"
  else
    echo "FAIL: $P does not wrap in <ToneProvider lockedTone=\"dark\"> (D11)"; exit 1
  fi
done

if ( cd "$FE" && npx vitest run \
      src/pages/NotFound.test.tsx \
      src/pages/InviteExpired.test.tsx \
      src/pages/InviteInvalid.test.tsx \
      src/pages/Welcome.test.tsx >/tmp/janus-t14-vitest.out 2>&1 ); then
  echo "PASS: retrofitted page suites green (data-tone=\"dark\" locked)"
else
  echo "FAIL: page suites — see /tmp/janus-t14-vitest.out"; tail -30 /tmp/janus-t14-vitest.out; exit 1
fi

echo "PASS: t14 standalone pages lock dark"
