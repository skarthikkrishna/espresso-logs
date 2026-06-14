---
node_id: handoff-043-summary
node_type: implementation_handoff
spec_id: spec-043
title: "Handoff Summary — Kaapi Kadai Design Coherence"
status: active
owned_by: tariq
created_at: 2026-06-13T20:49:25-07:00
implementation_branch: feat/043-design-coherence
---

# Handoff Summary — spec-043 Kaapi Kadai Design Coherence

## Routing status

SpecKit is complete for spec-043 and both required gates are green: Aria Stage-1 is `APPROVED`; Quinn pre-implementation is `APPROVED_WITH_NOTES` and GO. This handoff resolves the Ralph blocker by giving espresso-logs implementation agents a self-contained execution brief. Agents must execute from this in-repo handoff plus the in-repo governance pointers below; they must not read upstream spec files during implementation.

## Design thesis — Warm Editorial Instrument Calm

Kaapi Kadai becomes one calm, premium espresso instrument. The identity remains a hybrid base: espresso-dark frame, shell chrome, scrims, and background atmosphere around solid, light, elevated warm operational content surfaces. Operational cards, rows, forms, modal bodies, badges, pagination, dense lists, and hero frames must be readable without photography, ambient darkness, translucency, or blur.

The surface contract is binding: content is solid and light-warm; glass/real blur belongs only to chrome, overlays, modal/sheet shells, and allowed progressive-blur selectors. Photography is density-keyed, not blanket removed: sparse standalone flows may keep visible warmth; dense app/admin/list pages keep photos receded behind stronger scrims and disciplined solid content surfaces. Amber remains the brand and primary CTA anchor; cool accents are restrained semantic/depth tools, never a method-color rainbow.

Motion is the craft bar. The named fluidity grammar reaches the Fable reference through route/layer choreography, scroll-linked section motion, text/clip reveal micro-interactions, primitive-wide hover/focus/press/loading/disabled states, pointer/scroll-reactive depth within caps, and reduced-motion parity. The WebGL cap is exactly two foreground three.js/WebGL surfaces — dashboard hero accent and extraction/brew visualization — plus one shared app-shell `KaapiAmbientLayer`. Reduced-motion/no-WebGL/error/context-loss users receive non-empty static fallback states with the same hierarchy and dignity.

## Scope

In scope: all 18 product routes plus the NotFound recovery surface, all four modals, shell/context surfaces, legacy `Chip` retirement, two operator bugs, hardware image upload alignment, delete-shot UI, and workflow completeness.

Page families:
1. Dashboard/Home
2. BrewLogList
3. BrewLogAdd / Log shot
4. BrewLogDetail
5. CatalogList
6. CatalogDetail
7. Hardware
8. ImportWizard
9. Profile
10. HouseholdSettings
11. HouseholdNew
12. HouseholdGuestView
13. Login
14. Register
15. Welcome
16. InviteAccept
17. InviteInvalid
18. InviteExpired
19. NotFound

The task matrix samples the 18 shipped product routes plus NotFound as a recovery surface, and all four modal flows: `AddBeanModal`, `AddHardwareModal`, `EditHardwareModal`, and `LogMaintenanceModal`. Shell scope includes Sidebar, BottomNav, HouseholdSwitcher, AppShell, StandaloneHouseholdShell, page headers, breadcrumbs/eyebrows, mobile shell context, and modal/sheet chrome. The two operator bugs are: remove unauthorized dashboard copy/final CTA narration and replace hardcoded dashboard household count with data-derived display.

## In-repo governance pointers

Agents must use these in-repo sources during implementation:

- `docs/requirements/design-language.md` — build-time design-language copy and primary UI contract.
- `.claude/skills/frontend-design/SKILL.md` — required for every Finn UI task, including Coffee Tracker Override and Mobile-First proof.
- `.claude/skills/design-review/SKILL.md` — required for Aria Stage-2 post-build review.
- `.claude/skills/brief-to-tasks/SKILL.md`, `.claude/skills/design-brief/SKILL.md`, `.claude/skills/design-flow/SKILL.md`, `.claude/skills/design-tokens/SKILL.md`, `.claude/skills/grill-me/SKILL.md`, `.claude/skills/information-architecture/SKILL.md` — supporting design and task methods where explicitly relevant.
- `.squad/skills/ui-design-contract/SKILL.md` — operational checklist; if it conflicts with `docs/requirements/design-language.md`, follow design-language and surface the drift.

## Global non-negotiables

- Quinn pre-implementation gate is already satisfied: `APPROVED_WITH_NOTES` and GO.
- Every Finn UI task requires R2 frontend-design evidence: Coffee Tracker Override, Mobile-First proof at 360/375, min-width media queries, 44×44 targets, functional mobile text at least 16px, no desktop-first overflow, reuse/modify/create mapping, and citations to this handoff plus in-repo governance pointers.
- Aria Stage-2 design-review gate T032 is mandatory after implementation and before Quinn final quality: screenshots and short recordings at 360/390/414/768/1024/1440 against the Fable fluidity reference; every dimension must score at least 8/10; zero unresolved Must findings.
- User-facing copy is operator-owned. Use approved registry copy or locked labels only. Locked labels include `Home`, `Log a shot`, and `Delete`. Dashboard subtitle Option D is none.
- Public-artifact privacy applies to screenshots, recordings, traces, logs, fixtures, and evidence: no secrets, tokens, invite links, emails, production URLs, environment identifiers, local absolute paths, or household/user identifiers.
- Do not push, open PRs, deploy, or publish external artifacts from any implementation wave.

## Numeric tolerance summary

- Page overflow: `scrollWidth <= viewportWidth + 1px` at 360/390/414/768/1024/1440.
- Extraction desktop centering: `|center_viz - center_panel| <= 8px` at 1024 and 1440.
- Child containment: child bounding box inside parent bounding box with ≤1px tolerance.
- Modal clearance: modal remains inside viewport with at least 8px side clearance at 360.
- Pagination placement: normal flow below list; top at least final visible card bottom + 12px; bbox within list container ±1px.
- Touch targets: mobile interactive controls at least 44×44 unless Aria explicitly exempts a semantic text link.
- Mobile text: functional body/form text at least 16px at 360/390/414.
- Context counts: desktop authenticated views visible brand = 1, active household = 1, page h1 = 1; public/mobile/guest counts documented per shell.
- Contrast: WCAG AA on both light warm content surfaces and espresso-dark frame/chrome; normal text ≥4.5:1; large text/icons ≥3:1.
- Translucency: ≤1 translucent layer per visual stack; photo + glass + translucent content card + translucent badge fails.
- WebGL/ambient: exactly two foreground three.js/WebGL surfaces plus one shared ambient context; ambient DPR ≤1.5; active cadence ≤30fps; idle cadence ≤8fps or pause after 4500ms; hidden tab pauses.
- Stage-2 design review: each dimension ≥8/10 and zero unresolved Must findings.

## Quinn APPROVED_WITH_NOTES carry-forward

1. `ambient-layer-design.md` is the source of truth for the lowered `--kaapi-ambient-*` token names and values when the durable design-language table still has older fog/glint names or stronger values.
2. The copy allowlist AST/lint rule must target render sinks and accessibility props only. It must not false-positive on class names, routes, query keys, enum values, test IDs, or data values. Seed true-positive fixtures and false-positive exemption fixtures before T024/T031 can be accepted.
3. The six-width Playwright matrix is CI-realistic only if runtime and WebKit availability are handled deliberately: shard by family where possible, cache/install browsers, separate fast computed-style/static audits from slower recordings, and retain only sanitized artifacts. Tariq owns this ongoing infrastructure tracking item.
4. The build-time copy of `docs/requirements/design-language.md` needs a durable sync/check mechanism after this feature. Manual sync is not the long-term process.

## Dependency-ordered fan-out plan

- Wave 1, parallel: Alex T008 hardware image endpoint/client alignment in backend/API lane || Finn T002–T007 foundations in frontend lane.
- Wave 2: Finn T009–T020 page-family migrations. Finn's stream is sequential because shared frontend files overlap. T014 depends on T008; T018 depends on T014/T016/T017; T019 depends on T009–T018; T020 depends on T009–T019.
- Wave 3: Quinn T021–T031 verification net after page-family implementation.
- Wave 4: Aria T032 Stage-2 design-review gate; halt-and-fix on any Must or score below 8/10.
- Wave 5: Quinn T033 final quality gate.

Backend and frontend touch mostly disjoint files and may run in parallel where dependencies permit. No wave pushes, opens PRs, deploys, or publishes artifacts. After all waves, the coordinator runs the four local CI-equivalent checks and asks the operator before any push.

## Full task table T001–T033

| ID | Marker | Owner | Depends-on | Acceptance-criteria summary |
|---|---|---|---|---|
| T001 | [US1][US2][US3][US4][US5][US6][US7][US8][US9][US10][US11][US12][US13][US14][US15] | Quinn | None | Pre-implementation gate exists with status `APPROVED` or `APPROVED_WITH_NOTES`; confirms no fan-out starts before gate. Gate covers comprehensive scope, copy ownership, hybrid surface contract, chrome-only blur, ambient/WebGL cap, Stage-2 requirement, and numeric tolerances. |
| T002 | [US1][US3][US13] | Finn | T001 | Implement operator-approved copy registry and AST/lint enforcement. User-facing copy sinks use registry/locked labels; enforcement covers visible JSX text and a11y/render copy; dashboard subtitle is none; forbidden narration strings are absent except negative fixtures; locked labels include `Home`, `Log a shot`, `Delete`; R2 evidence required. |
| T003 | [US3][US13][US15] | Finn | T001 | Implement hybrid-base palette, content-surface tokens, chrome-only blur contract, density-keyed `.app-bg`, and design-language sync into frontend CSS. Content surfaces are solid warm/light and AA-safe; amber is CTA/brand; photography remains density-keyed; blur only uses approved chrome/overlay/sheet gate; R2 evidence required. |
| T004 | [US5][US13] | Finn | T002,T003 | Retune Smooth Bevel and form primitives across Button, inputs, GlassCard content variant, Badge, and states. Same variants share exact computed shadow/radius, disabled controls are flat, forms sit on light surfaces, semantic colors remain sparse, and no page-local raw shadows/radii/colors are needed; R2 evidence required. |
| T005 | [US5][US7][US13] | Finn | T003,T004 | Create/update only `Pagination`, `ActionExpander`, `HeroVisualFrame`, and `LayerTransition`. Pagination uses Button in normal flow; ActionExpander has `aria-expanded`/`aria-controls` and 44×44 targets; HeroVisualFrame owns five states without blur; LayerTransition centralizes GSAP cleanup/focus/reduced-motion; R2 evidence required. |
| T006 | [US13][US15] | Finn | T003,T005 | Implement named motion/fluidity grammar and shared `KaapiAmbientLayer`. Tokens include instant/micro/enter/route/ambient durations, eases, staggers, clip distance, hover/scroll caps; primitives use scroll/text/depth/state motion; ambient mounts once, is non-interactive, DPR-capped, throttled/paused, fallback-safe, and disposed; R2 evidence required. |
| T007 | [US4][US5][US13] | Finn | T002,T003,T004,T005 | Normalize shell, navigation, context labels, and shared modal footer pattern. Brand appears once on desktop, household once per hierarchy, h1 names task once, long household names truncate accessibly, shell components share context source, modal footers use light content and Button variants; R2 evidence required. |
| T008 | [US9] | Alex | T001 | Align hardware image upload so visible UI has no dead endpoint call. Preferred: implement `POST /api/hardware/{id}/image` with existing auth/household patterns, typed response, validation/errors, tests, and no external storage dependency in tests; alternative: remove/change affordance only with explicit product approval; no broad backend redesign. |
| T009 | [US1][US2][US3][US4][US13][US15] | Finn | T002,T003,T004,T005,T006,T007 | Migrate Dashboard/Home including operator bugs, hero, metrics, cards, background, and ambient relation. Dashboard h1 is `Home`, subtitle absent, household count data-derived, no final CTA narration, `Log a shot` canonical, solid light surfaces, `bg-dashboard` kept as earned atmosphere, hero remains one foreground WebGL with fallback, ambient recedes; R2 evidence required. |
| T010 | [US3][US5][US6][US13] | Finn | T002,T003,T004,T005,T006,T007 | Migrate BrewLogList dense-list contract, badges/chips, pagination, and list choreography. `bg-brew-log` recedes, rows/cards are solid light surfaces, no legacy Chip/backdrop blur, badges remain contained/semantic, Pagination is normal-flow below content, long strings contain; R2 evidence required. |
| T011 | [US6][US13] | Finn | T002,T003,T004,T005,T006,T007,T010 | Migrate BrewLogDetail and add delete-shot UI using existing DELETE API. Detail uses shared primitives and no legacy Chip; delete has confirmation, success/error/loading, Escape/Enter, focus restoration, query invalidation/navigation, and operator-owned copy except locked `Delete`; R2 evidence required. |
| T012 | [US7][US13] | Finn | T002,T003,T004,T005,T006,T007 | Rebuild BrewLogAdd/log-shot form and Extraction Compass mobile-first. 360/390/414 are single-column, touch-friendly, ≥16px text, ≥44×44 controls; wider layouts use available width; form uses solid warm canvas; label remains `Extraction compass`; visualization contained/centered; ActionExpander handles More/Fewer; R2 evidence required. |
| T013 | [US3][US8][US13] | Finn | T002,T003,T004,T005,T006,T007 | Migrate CatalogList and CatalogDetail. `bg-catalog` stays atmosphere; list/detail/form surfaces use shared primitives; actions use Button variants; long labels contain; brand/household not repeated; cool tokens semantic only and method distinction relies on content/structure first; R2 evidence required. |
| T014 | [US5][US9][US13] | Finn | T002,T003,T004,T005,T006,T007,T008 | Migrate Hardware page, distinct browse/detail layer, modal integration, maintenance actions, and image workflow UI. Hardware uses deeper scrim/solid surfaces, back/browser history avoids traps, focus/scroll restore, categories preserved, actions use Button/modal footer, upload UI matches T008 with loading/success/error; R2 evidence required. |
| T015 | [US10][US13] | Finn | T002,T003,T004,T005,T006,T007 | Rebuild ImportWizard mobile-first. Remove desktop-first max-width/fixed grid as primary constraints; upload/preview/done use solid warm canvas; no overflow at six widths; stepper wraps/stacks/segments accessibly; preview table/card pattern contains; behavior from prior specs preserved; R2 evidence required. |
| T016 | [US11][US13] | Finn | T002,T003,T004,T005,T006,T007 | Migrate Profile, HouseholdSettings, HouseholdNew, and HouseholdGuestView. Profile and admin surfaces use shared primitives, deduped labels, solid grouped panels, restrained accents, destructive actions; guest/new flows keep density-keyed photography, remove raw glass/Chip, and use one context label; R2 evidence required. |
| T017 | [US12][US13] | Finn | T002,T003,T004,T005,T006,T007 | Migrate Login, Register, Welcome, InviteAccept, InviteInvalid, InviteExpired, and NotFound. Sparse/standalone photography stays tuned by density; cards/forms/actions use shared primitives or approved wrappers; auth/invite semantics and tokens unchanged; info surfaces pass contrast; copy registry and sanitized traces required; R2 evidence required. |
| T018 | [US5][US13] | Finn | T004,T005,T007,T014,T016,T017 | Migrate all four modals and retire/rewrite legacy Chip app-wide. Modal body/form/footer content is solid light warm; shell/backdrop may use allowed overlay glass; submit/cancel/destructive actions use Button variants; legacy Chip deleted or becomes thin Badge wrapper without blur; prohibited imports gone; R2 evidence required. |
| T019 | [US3][US4][US13] | Finn | T009,T010,T011,T012,T013,T014,T015,T016,T017,T018 | Complete app-wide primitive penetration and raw utility cleanup. Every route/page family, shell surface, and modal flow imports shared primitives or documented wrappers; raw amber/cool utilities, dark translucent panels, raw glass-card content, page-local controls/badges, method rainbows, and arbitrary blur are absent outside approved zones; R2 evidence required. |
| T020 | [US13][US15] | Finn | T009,T010,T011,T012,T013,T014,T015,T016,T017,T018,T019 | Complete motion-led tactility and reduced-motion parity across routes, shell, modals, pagination, expanders, cards, buttons, badges, text/clip reveals, scroll sections, pointer/scroll depth, and ambient. Reduced motion removes parallax/masks/scroll-linked movement while preserving final hierarchy/focus/read order; R2 evidence required. |
| T021 | [US14][P] | Quinn | T009,T010,T011,T012,T013,T014,T015,T016,T017,T018,T019 | Add responsive and containment matrix for all page families and four modals at 360/390/414/768/1024/1440. Enforce no page overflow, mobile touch/text minimums, long-string child containment, and modal side clearance. |
| T022 | [US2][US3][US13][US14][P] | Quinn | T003,T009,T010,T011,T012,T013,T014,T015,T016,T017,T018,T019 | Add hybrid surface-contract and contrast checks for both tiers. WCAG AA covers light content surfaces and espresso-dark frame/chrome across representative states and pages; tests fail if operational content depends on photo, blur, ambient darkness, or translucent fills for contrast. |
| T023 | [US5][US13][US14][P] | Quinn | T003,T004,T005,T018,T019 | Add blur-scope, translucency, layer-count, and raw token audits. Fail prohibited `backdrop-filter` on content/cards/controls/lists/badges/pagination/expanders, enforce exact progressive blur allowlist, enforce ≤1 translucent layer, and reject raw hex/RGBA/shadow/radius utilities outside approved zones. |
| T024 | [US1][US4][US14][P] | Quinn | T002,T007,T009,T016,T017,T019 | Add allowlist copy audit and one-context-label count matrix. AST/lint fails unapproved user-facing literals in production JSX/TSX and a11y props; forbidden dashboard copy/final CTA absent; `Log a shot` canonical; desktop auth brand/household/h1 counts = 1; mobile/public/guest counts documented; long household text contained. |
| T025 | [US5][US13][US14][P] | Quinn | T004,T005,T009,T010,T011,T012,T013,T014,T015,T016,T017,T018,T020 | Add Smooth Bevel and primitive computed-style equality checks. Same-variant buttons across dashboard, brew-log, catalog, hardware, import, modals, pagination, and auth match computed shadow/radius; disabled shadow is none/empty; focus-visible is keyboard-only; form/card/modal style tokens match. |
| T026 | [US7][US10][US14][P] | Quinn | T012,T015 | Add numeric layout checks for Extraction Compass and ImportWizard. Extraction centering ≤8px at desktop and contained at smaller widths; ImportWizard upload/preview/done no-overflow; stepper/control targets ≥44×44; preview table/card container remains contained. |
| T027 | [US13][US15][US14][P] | Quinn | T006,T009,T012,T020 | Add WebGL, ambient, performance, and reduced-motion audits. Exactly two foreground three.js/WebGL surfaces plus one shared `KaapiAmbientLayer`; no extra contexts; ambient persists without remount multiplication, DPR/cadence/idle/hidden caps enforced, static fallbacks non-empty, resources disposed, bundle budget counted. |
| T028 | [US13][US14][US15][P] | Quinn | T006,T020 | Add motion/fluidity and reduced-motion parity tests. Cover dashboard load, route transitions, scroll choreography, list/card enter, modals, action feedback, hardware side-fade, text/clip reveals, pagination/expander states, pointer/scroll depth, ambient response, no scroll-jacking/stale flashes/double-enters, stable focus, and instant reduced-motion final states. |
| T029 | [US6][US9][US14][P] | Quinn | T008,T011,T014 | Add workflow-completeness tests for delete-shot and hardware image alignment. Delete covers confirmation/cancel/Escape/keyboard confirm/loading/success/error/query invalidation/navigation/focus/copy boundaries; hardware image covers endpoint/client or approved removal, auth/household authorization, validation, success/error/loading UI, and sanitized fixtures/artifacts. |
| T030 | [US11][US12][US14][P] | Quinn | T016,T017 | Add public/auth/invite/guest privacy and semantic regression checks. Preserve auth/invite/guest behavior; sanitized fixture tokens/URLs/emails are not rendered or captured; info surfaces meet AA after retint; public pages pass layer, contrast, containment, copy registry, and responsive checks. |
| T031 | [US14][P] | Quinn | T021,T022,T023,T024,T025,T026,T027,T028,T029,T030 | Preserve spec-039/spec-042 must-not-regress coverage and assemble traceability. Existing coverage is additive, not weakened; every US1–US15 AC maps to checks/evidence; R2 evidence exists for every Finn UI task; artifacts contain no local paths, sensitive values, or PII. |
| T032 | [US13][US14][US15] | Aria | T009,T010,T011,T012,T013,T014,T015,T016,T017,T018,T019,T020 | Run mandatory post-build Stage-2 design-review gate. Apply design-review skill to running app with screenshots/recordings at six widths for all changed page families and modals; cover key flows, hover/focus/press, text/clip reveals, ambient active/static/fallback, hero/extraction, reduced-motion/no-WebGL; score thesis/Fable dimensions ≥8/10 with zero unresolved Must. |
| T033 | [US1][US2][US3][US4][US5][US6][US7][US8][US9][US10][US11][US12][US13][US14][US15] | Quinn | T021,T022,T023,T024,T025,T026,T027,T028,T029,T030,T031,T032 | Run final quality gate and prepare coordinator handoff. Confirm Stage-2 passed; run backend checks if T008 touched backend plus frontend lint/unit/build/spec-043 Playwright/e2e and existing must-not-regress coverage; confirm sanitized artifacts and branch metadata; no push/PR/deployment. |

## Out of scope

- No broad backend, data-model, auth, or household redesign beyond T008.
- No schema migrations, infrastructure changes, CI platform redesign, or deployment work.
- No duplicate bare defaults endpoint cleanup; that remains a separate backend/test follow-up.
- No agent-finalized user-facing copy.
- No push, PR creation, deployment, or external artifact publication from implementation.
