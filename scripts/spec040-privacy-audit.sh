#!/bin/bash
#
# Spec-040 privacy/public-artifact audit.
# Checks committed QA scaffolding and generated Playwright artifacts for bearer
# tokens, cookies, production URLs, private keys, and unsafe token artifacts.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

failures=0

section() {
    echo ""
    echo "$1"
    echo "─────────────────────────────────────────────────────────────"
}

record_failure() {
    echo "❌ $1"
    failures=$((failures + 1))
}

check_no_matches() {
    local label=$1
    local pattern=$2
    shift 2

    local matches
    matches=$(
        (
            grep -RInE --binary-files=without-match \
                --exclude-dir=node_modules \
                --exclude-dir=dist \
                --exclude-dir=build \
                --exclude-dir=coverage \
                --exclude-dir=.vite \
                --exclude-dir=.cache \
                --exclude-dir=test-results \
                --exclude-dir=playwright-report \
                --exclude-dir=playwright \
                "$pattern" "$@" 2>/dev/null || true
        ) | head -80
    )
    if [ -n "$matches" ]; then
        record_failure "$label"
        echo "$matches"
    else
        echo "✅ $label"
    fi
}

section "Spec-040 Playwright artifact policy"
spec_files=(frontend/e2e/spec040-*.spec.ts)
if [ ! -e "${spec_files[0]}" ]; then
    record_failure "No Spec-040 Playwright specs found"
else
    for spec_file in "${spec_files[@]}"; do
        if ! grep -q "screenshot: 'off'" "$spec_file"; then
            record_failure "$spec_file does not disable screenshots"
        fi
        if ! grep -q "trace: 'off'" "$spec_file"; then
            record_failure "$spec_file does not disable traces"
        fi
        if ! grep -q "video: 'off'" "$spec_file"; then
            record_failure "$spec_file does not disable videos"
        fi
        if ! grep -q "SPEC040_VIEWPORTS" "$spec_file"; then
            record_failure "$spec_file does not explicitly cover Spec-040 viewports"
        fi
    done
    if [ "$failures" -eq 0 ]; then
        echo "✅ Spec-040 Playwright specs disable screenshot/trace/video artifacts"
    fi
fi

section "Committed source high-risk token audit"
check_no_matches \
    "No committed JWT-like literals" \
    "eyJ[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}\\.[A-Za-z0-9_-]{8,}" \
    app frontend tests alembic scripts
check_no_matches \
    "No committed private keys" \
    "BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY" \
    app frontend tests alembic scripts
check_no_matches \
    "No committed Cloud Run production URLs" \
    "https://[^[:space:]'\"<>]+\\.run\\.app" \
    app frontend tests alembic scripts
check_no_matches \
    "No committed high-entropy token query strings" \
    "(invite[_-]?token|guest[_-]?token|refresh_token|access_token|key)=[A-Za-z0-9_-]{24,}" \
    app frontend tests alembic scripts

section "Frontend page-local image URL audit"
page_local_urls=$(grep -RInE --include='*.ts' --include='*.tsx' "url\\('/static/img/" frontend/src 2>/dev/null || true)
if [ -n "$page_local_urls" ]; then
    record_failure "Page-local static image URLs found outside central CSS/manifest"
    echo "$page_local_urls"
else
    echo "✅ No page-local static image URLs in frontend TS/TSX"
fi

section "Generated Spec-040 Playwright artifact audit"
artifact_files=()
for artifact_path in frontend/test-results frontend/playwright-report test-results playwright-report; do
    if [ -e "$artifact_path" ]; then
        while IFS= read -r artifact_file; do
            artifact_files+=("$artifact_file")
        done < <(find "$artifact_path" -type f -iname '*spec040*' -print)
    fi
done

if [ "${#artifact_files[@]}" -eq 0 ]; then
    echo "✅ No generated Spec-040 Playwright artifacts present"
else
    check_no_matches \
        "Generated Spec-040 artifacts contain no token/cookie/private-key/production URL patterns" \
        "eyJ[A-Za-z0-9_-]{8,}\\.|(rt|refresh_token|access_token|cookie)=|key=[A-Za-z0-9_-]{16,}|https://[^[:space:]'\"<>]+\\.run\\.app|BEGIN .*PRIVATE KEY" \
        "${artifact_files[@]}"
fi

section "Spec repository binary artifact audit"
spec040_dir="${SPEC040_DIR:?set SPEC040_DIR to the spec-040 directory}"
if [ -d "$spec040_dir" ]; then
    binary_assets=$(find "$spec040_dir" -type f ! -name '*.md' ! -name '*.json' ! -name '*.yml' ! -name '*.yaml' ! -name '*.txt' -print)
    if [ -n "$binary_assets" ]; then
        record_failure "Spec-040 contains non-text artifacts that need explicit review"
        echo "$binary_assets"
    else
        echo "✅ Spec-040 spec path contains no copied binary assets"
    fi
else
    echo "⚠️  Spec-040 directory not found at $spec040_dir; skipped sibling spec audit"
fi

echo ""
if [ "$failures" -ne 0 ]; then
    echo "❌ Spec-040 privacy audit failed with $failures finding(s)."
    exit 1
fi

echo "✅ Spec-040 privacy audit passed."
