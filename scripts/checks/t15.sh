#!/bin/sh
# t15.sh — NFR3 / D12: tone form-atom remediation (strict tier).
# (a) .kk-tc-btn--ghost conforms to its documented text-only/no-fill contract (was a
#     filled amber block with muted text — illegible). (b) ToneInput/Select/Textarea drop
#     the DaisyUI -sm scale so fields match the 1rem/2.75rem EntityFormActions button.
# Grep gates the mechanics; the running-instance eval is the visual proof. Consumers
# (the two built form pages) must stay green. Emits PASS:/FAIL: lines.
set -eu

DIR="$(dirname -- "$0")"
FE="$(CDPATH= cd -- "$DIR/../../frontend" && pwd)"
CSS="$FE/src/index.css"
TS="$FE/src/components/tone-system"

# (a) ghost button: transparent fill, no edit background (D12)
GHOST="$(awk '/^\.kk-tc-btn--ghost \{/{f=1} f{print} f&&/^\}/{exit}' "$CSS")"
if printf '%s\n' "$GHOST" | grep -q 'background: *transparent' \
   && ! printf '%s\n' "$GHOST" | grep -q 'kk-tc-btn-edit-bg'; then
  echo "PASS: .kk-tc-btn--ghost is text-only (transparent bg, no edit fill)"
else
  echo "FAIL: .kk-tc-btn--ghost still fills (want transparent bg, no --kk-tc-btn-edit-bg)"; exit 1
fi

# (b) tone form inputs drop the -sm scale (D12)
for pair in "ToneInput.tsx:input-sm" "ToneSelect.tsx:select-sm" "ToneTextarea.tsx:textarea-sm"; do
  FILE="${pair%%:*}"; TOKEN="${pair##*:}"
  if grep -q "$TOKEN" "$TS/$FILE"; then
    echo "FAIL: $FILE still uses $TOKEN"; exit 1
  fi
  echo "PASS: $FILE dropped $TOKEN"
done

# ripple: the two already-built form-page suites stay green after the shared-atom change
if ( cd "$FE" && npx vitest run src/pages/Welcome.test.tsx src/pages/HouseholdNew.test.tsx \
      >/tmp/janus-t15-vitest.out 2>&1 ); then
  echo "PASS: Welcome + HouseholdNew suites green after atom change"
else
  echo "FAIL: form-page suites — see /tmp/janus-t15-vitest.out"; tail -30 /tmp/janus-t15-vitest.out; exit 1
fi

echo "PASS: t15 tone form-atom remediation"
