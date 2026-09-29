#!/bin/sh
# t12.sh — NFR3: ToneStateCard adopts the shared GLASS surface (D10). Strict tier.
# The base `.tone-state-card` rule must use the frosted --kk-card-surface-* token family
# (translucent bg + backdrop-filter + solid fallback) exactly like EntityCard/ShotCard/
# TakeoverCard — NOT the flat opaque --kaapi-content-* family. The per-tone dark override
# becomes redundant (those tokens redefine per :root/[data-tone=dark]/[data-tone=beige]).
# Glass "looks right" is only provable by the running-instance eval; this guards the tokens.
set -eu

FE="$(CDPATH= cd -- "$(dirname -- "$0")/../../frontend" && pwd)"
CSS="$FE/src/index.css"
[ -f "$CSS" ] || { echo "FAIL: $CSS not found"; exit 1; }

# Isolate the base `.tone-state-card { ... }` rule (not the --compact/--error/etc. variants).
BLOCK="$(awk '/^\.tone-state-card \{/{f=1} f{print} f&&/^\}/{exit}' "$CSS")"
[ -n "$BLOCK" ] || { echo "FAIL: could not locate the base .tone-state-card rule"; exit 1; }

printf '%s\n' "$BLOCK" | grep -q -- '--kk-card-surface-bg' \
  && echo "PASS: .tone-state-card uses the glass surface bg (--kk-card-surface-bg)" \
  || { echo "FAIL: .tone-state-card does not use --kk-card-surface-bg"; exit 1; }

printf '%s\n' "$BLOCK" | grep -qE 'backdrop-filter: *var\(--kk-card-surface-filter\)' \
  && echo "PASS: .tone-state-card applies the glass backdrop-filter" \
  || { echo "FAIL: .tone-state-card missing var(--kk-card-surface-filter) backdrop"; exit 1; }

if printf '%s\n' "$BLOCK" | grep -q -- '--kaapi-content-surface'; then
  echo "FAIL: .tone-state-card still references the flat --kaapi-content-surface for its background"; exit 1
fi
echo "PASS: .tone-state-card no longer uses the flat --kaapi-content-surface"

if grep -qE '\[data-tone="dark"\][[:space:]]+\.tone-state-card[[:space:]]*\{' "$CSS"; then
  echo "FAIL: redundant [data-tone=\"dark\"] .tone-state-card override still present (glass tokens vary per tone)"; exit 1
fi
echo "PASS: no redundant [data-tone=\"dark\"] .tone-state-card override"

grep -qE '@supports not \(backdrop-filter[^)]*\).*\.tone-state-card' "$CSS" \
  && echo "PASS: .tone-state-card has a @supports-not solid fallback" \
  || { echo "FAIL: .tone-state-card missing @supports-not backdrop-filter solid fallback"; exit 1; }

if ( cd "$FE" && npm run test:tokens >/tmp/janus-t12-tokens.out 2>&1 ); then
  echo "PASS: test:tokens (token unification + tone guards)"
else
  echo "FAIL: test:tokens — see /tmp/janus-t12-tokens.out"; tail -20 /tmp/janus-t12-tokens.out; exit 1
fi

# Every ToneStateCard consumer suite must stay green (the shared change touches all of them).
if ( cd "$FE" && npx vitest run \
      src/pages/NotFound.test.tsx \
      src/pages/InviteExpired.test.tsx \
      src/pages/InviteInvalid.test.tsx \
      src/pages/BrewLogList.test.tsx >/tmp/janus-t12-vitest.out 2>&1 ); then
  echo "PASS: ToneStateCard consumer suites green (NotFound/InviteExpired/InviteInvalid/BrewLogList)"
else
  echo "FAIL: consumer suites — see /tmp/janus-t12-vitest.out"; tail -30 /tmp/janus-t12-vitest.out; exit 1
fi

echo "PASS: t12 ToneStateCard glass surface unified"
