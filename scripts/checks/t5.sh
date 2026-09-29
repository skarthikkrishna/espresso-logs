#!/bin/sh
# t5.sh — FR4 / D11: HouseholdNew migrated onto the tone system (strict tier).
# Pattern A form page: the shared migration bar plus the D11 dark lock (standalone
# pages ignore persisted tone). Emits PASS:/FAIL: lines; final line on success:
#   PASS: HouseholdNew migrated
set -eu

DIR="$(dirname -- "$0")"
SRC="$(CDPATH= cd -- "$DIR/../../frontend" && pwd)/src/pages/HouseholdNew.tsx"

[ -f "$SRC" ] || { echo "FAIL: $SRC not found"; exit 1; }

if grep -qE 'ToneProvider lockedTone="dark"' "$SRC"; then
  echo "PASS: HouseholdNew locks tone via <ToneProvider lockedTone=\"dark\"> (D11)"
else
  echo "FAIL: HouseholdNew does not wrap in <ToneProvider lockedTone=\"dark\"> (D11)"; exit 1
fi

exec sh "$DIR/_page_migrated.sh" HouseholdNew
