<!-- Synced from coffee_tracker/.squad/skills — canonical source; do not edit here. Synced 2026-06-13 (spec-043). -->
---
name: "UI Design Contract"
description: "Operational checklist for applying Coffee Tracker's canonical UI design language, token contract, browser coverage, and visual artifact privacy rules."
domain: "ui-design, frontend, design-review, quality-gates"
confidence: "high"
source: "spec-039 design review centralization; docs/requirements/design-language.md remains the source of truth"
tools: []
---

## Source of Truth

`docs/requirements/design-language.md` is canonical. This skill is an operational checklist for agents
and skills; it does not replace or duplicate the design language. When this checklist and
`design-language.md` appear to conflict, stop and follow `design-language.md`, then surface the drift.

## When This Skill Applies

- Before Aria writes or reviews UI design gates.
- Before Finn implements new or changed UI surfaces.
- Before Quinn reviews UI work, writes Playwright checks, or approves a UI quality gate.
- Before generic design skills apply aesthetic guidance to Coffee Tracker UI.

## Operational Checklist

1. **Read the contract first**
   - Read `docs/requirements/design-language.md`.
   - Confirm the work uses spec-030 token and class vocabulary unless Aria has reopened the design gate.
   - Treat spec folders as historical evidence, not the reusable source of truth.

2. **Reuse before creating**
   - Reuse existing DaisyUI v5, Tailwind v4, `espresso-dark`, and documented spec-030/current
     contract classes such as `.btn-bevel`, `.input-styled`, `.glass-card`, `.card-bevel`, and
     `.modal-glass` before adding any new visual pattern.
   - If a new token, class, or pattern seems necessary, route back to Aria before implementation.

3. **Check blur and surface scope**
   - Permit blur only on `#main-content` and modal backdrops.
   - Modal backdrops must use `var(--glass-blur)` with both standard and WebKit backdrop-filter support.
   - Reject blur on buttons, cards, rows, lists, and arbitrary containers.

4. **Check button and focus states**
   - Verify rest, hover, active/pressed, disabled, and focus-visible states.
   - Use `:focus-visible` for keyboard focus rings on buttons.
   - Do not use broad `.btn-bevel:focus` rules that change mouse/click rest shadows.
   - Tests that assert focus rings must establish keyboard modality.

5. **Use computed-style enforcement**
   - Prefer Playwright computed-style assertions for shadows, blur, radius, focus rings, and token
     equality.
   - Screenshot captures are supporting evidence; screenshot diffing is not the default enforcement
     mechanism.
   - Cover Chromium and WebKit at 375px, 768px, and 1280px for new or changed UI surfaces.
   - Preserve relevant spec-029 regression coverage.

6. **Run a token audit**
   - Flag raw RGBA/hex values outside approved token definitions.
   - Flag hardcoded shadows, hardcoded radii, unapproved blur, and spec-030 token/class drift.
   - Confirm disabled states do not retain bevel shadows.

7. **Protect visual artifacts**
   - Do not capture or commit invite tokens, cookies, access tokens, refresh tokens, production URLs, or
     PII in screenshots, traces, videos, logs, or review notes.
   - Redact or use safe local/demo data before producing review artifacts.

## Required Output Evidence

For UI work, the responsible agent should report:

- Which `design-language.md` sections were applied.
- Which token/class vocabulary was reused.
- Which Playwright computed-style checks or audits enforce the contract.
- Which browser widths and engines were covered.
- Whether any visual artifacts were produced and how sensitive data was excluded.
