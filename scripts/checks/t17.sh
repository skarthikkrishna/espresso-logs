#!/bin/sh
# t17.sh — NFR3 / D12 refinement (strict tier): ghost/tertiary = outlined button,
# grouped in the EntityFormActions action row next to the primary.
#   (1) .kk-tc-btn--ghost gains a visible border (was transparent — read as stray text).
#   (2) EntityFormActions accepts secondaryVariant (default 'edit').
#   (3) Welcome + HouseholdNew render Cancel/← Back as a ghost secondary INSIDE
#       EntityFormActions (no standalone full-width ghost sibling).
# Grep gates the mechanics; the running-instance eval is the visual proof.
set -eu

DIR="$(dirname -- "$0")"
FE="$(CDPATH= cd -- "$DIR/../../frontend" && pwd)"
CSS="$FE/src/index.css"
TS="$FE/src/components/tone-system"
PG="$FE/src/pages"

# (1) ghost is outlined — border-color references the link token, not transparent
GHOST="$(awk '/^\.kk-tc-btn--ghost \{/{f=1} f{print} f&&/^\}/{exit}' "$CSS")"
if printf '%s\n' "$GHOST" | grep -q 'border-color: *var(--kk-tc-btn-ghost-border' \
   && ! printf '%s\n' "$GHOST" | grep -q 'border-color: *transparent'; then
  echo "PASS: .kk-tc-btn--ghost is outlined (visible border, not transparent)"
else
  echo "FAIL: .kk-tc-btn--ghost border not restored (want --kk-tc-btn-ghost-border, not transparent)"; exit 1
fi

# (2) EntityFormActions exposes secondaryVariant
if grep -q 'secondaryVariant' "$TS/EntityFormActions.tsx"; then
  echo "PASS: EntityFormActions accepts secondaryVariant"
else
  echo "FAIL: EntityFormActions has no secondaryVariant prop"; exit 1
fi

# (3) form pages render the tertiary as a ghost secondary inside EntityFormActions
for P in Welcome HouseholdNew; do
  if grep -q 'secondaryVariant="ghost"' "$PG/$P.tsx"; then
    echo "PASS: $P passes secondaryVariant=\"ghost\" to EntityFormActions"
  else
    echo "FAIL: $P does not group its tertiary into EntityFormActions as ghost"; exit 1
  fi
done

# ripple: the two touched form-page suites stay green
if ( cd "$FE" && npx vitest run src/pages/Welcome.test.tsx src/pages/HouseholdNew.test.tsx \
      >/tmp/janus-t17-vitest.out 2>&1 ); then
  echo "PASS: Welcome + HouseholdNew suites green"
else
  echo "FAIL: form-page suites — see /tmp/janus-t17-vitest.out"; tail -30 /tmp/janus-t17-vitest.out; exit 1
fi

echo "PASS: t17 ghost outlined + grouped action row"
