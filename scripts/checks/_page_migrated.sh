#!/bin/sh
# _page_migrated.sh <PageBasename> — strict-tier page-migration check (shared, guards: —).
# Asserts a page has moved its CONTROLS onto the tone system. Emits PASS:/FAIL: lines;
# final line on success:  PASS: <PageBasename> migrated
#
# Bar (operator decisions 2026-07-06): StandaloneHouseholdShell + LayerTransition MAY remain
# on standalone routes (they supply the auth backgrounds/transition the tone system has no
# replacement for); AccessibleDialog MAY remain (a11y wrapper). What must be GONE:
#   (1) components/ui CONTROL primitives — Button/Input/Select/Textarea/FormField/Badge/GlassCard/PageHeader
#   (2) raw DaisyUI control classes — matched by unambiguous VARIANT tokens only, so tone's
#       kk-tc-*-btn classes and ARIA role="alert" never false-trip.
# Full visual tone-compliance is additionally covered by `npm run test:tokens` (t1) and the
# running-instance visual eval at build — a grep can't prove "looks tone-correct".
set -eu

PAGE=${1:?usage: _page_migrated.sh <PageBasename>}
FE="$(CDPATH= cd -- "$(dirname -- "$0")/../../frontend" && pwd)"
SRC="$FE/src/pages/$PAGE.tsx"
TEST="src/pages/$PAGE.test.tsx"
FORBIDDEN_UI='(Button|FormField|Input|Select|Textarea|Badge|GlassCard|PageHeader)'
DAISY='alert-(error|warning|success|info)|loading-spinner|loading-lg|btn-(outline|error|ghost|sm|bevel|primary)'
EMITTER='(TakeoverCard|TonePageWrapper|ImmersiveListShell|FormPageShell|WizardShell)'

[ -f "$SRC" ] || { echo "FAIL: $SRC not found"; exit 1; }

# D4(c): a bare ToneProvider is inert for light/dark — the page must render a
# component that stamps data-tone. Without one the page renders permanently light.
if ! grep -qE "$EMITTER" "$SRC"; then
  echo "FAIL: $PAGE renders no data-tone emitter ($EMITTER) — a bare ToneProvider is inert; light/dark won't work"; exit 1
fi
echo "PASS: $PAGE renders a data-tone emitter"

if grep -E "from ['\"]\.\./components/ui['\"]" "$SRC" | grep -qE "$FORBIDDEN_UI"; then
  echo "FAIL: $PAGE still imports a components/ui control primitive ($FORBIDDEN_UI)"; exit 1
fi
echo "PASS: $PAGE has no legacy components/ui control-primitive imports"

if grep -qE "$DAISY" "$SRC"; then
  echo "FAIL: $PAGE still uses raw DaisyUI control classes: $(grep -oE "$DAISY" "$SRC" | sort -u | tr '\n' ' ')"; exit 1
fi
echo "PASS: $PAGE has no raw DaisyUI control classes"

if ( cd "$FE" && npx vitest run "$TEST" >/tmp/janus-check-$PAGE.out 2>&1 ); then
  echo "PASS: $PAGE test suite green"
else
  echo "FAIL: $PAGE test suite — see /tmp/janus-check-$PAGE.out"; exit 1
fi

echo "PASS: $PAGE migrated"
