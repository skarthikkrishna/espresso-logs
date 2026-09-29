#!/bin/sh
# t6.sh — FR2 / D11: Register migrated onto the tone system (strict tier).
# Pattern A form page: shared migration bar plus the D11 dark lock (standalone
# pages ignore persisted tone). Emits PASS:/FAIL: lines; final line on success:
#   PASS: Register migrated
set -eu

DIR="$(dirname -- "$0")"
SRC="$(CDPATH= cd -- "$DIR/../../frontend" && pwd)/src/pages/Register.tsx"

[ -f "$SRC" ] || { echo "FAIL: $SRC not found"; exit 1; }

if grep -qE 'ToneProvider lockedTone="dark"' "$SRC"; then
  echo "PASS: Register locks tone via <ToneProvider lockedTone=\"dark\"> (D11)"
else
  echo "FAIL: Register does not wrap in <ToneProvider lockedTone=\"dark\"> (D11)"; exit 1
fi

exec sh "$DIR/_page_migrated.sh" Register
