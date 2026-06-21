# 16 — Holistic Design Critique: Home Page + Light Mode (Spec-043)

**Spec:** 043 → Component System Rebuild  
**Prepared by:** Aria (Designer)  
**Date:** 2026-06-19  
**Status:** CRITIQUE + REMEDIATION DIRECTION  
**Purpose:** Consolidated design review synthesizing all operator feedback items (1–18) with prioritized, principled remediation.

---

## Skills Applied + Evidence

| Skill | Application | Evidence |
|-------|-------------|----------|
| **ui-design-contract** | Verified blur scope (chrome/overlay only), surface contract, hybrid base principle against design-language.md | §Liquid Glass (L178–260), §Hybrid Base (L36–48), §Surface Contract (L44–48) |
| **reuse-before-create** | Audited existing tone tokens (`--kk-tc-*`, `--kk-il-*`), ToneButton variants, EntityCard patterns before proposing changes | index.css L1396–1559 (tone tokens), ToneButton.tsx (4 variants exist) |
| **design-tokens** | Full palette audit: amber+teal split-complement values, scrim/frost tokens, card surface eggshell, sidebar teal | Applied palette §1 in doc-15, design-language.md §Palette (L93–169) |
| **design-review** | Structured Must/Should/Could critique for all 18 feedback items with P0/P1/P2 classification | See §Per-Item Assessment below |
| **information-architecture** | Layout balance analysis (desktop void), hierarchy audit (stats, monogram, data priority), density flow | Screenshots show 60%+ dead space, monogram dominance, orphaned Recent Shots |
| **design-brief** | Grounded in Warm Editorial Instrument Calm thesis: coffee ritual soul, restrained cool accent, amber brand anchor | design-language.md L30–34 (guiding statement), §Aesthetic Direction (L21–29) |

---

## PRESERVE LIST — Do Not Regress

These elements received operator "chef's kiss" approval. Any remediation must protect them:

| Element | Operator Sentiment | Design Validation |
|---------|-------------------|-------------------|
| **Contrast card system** | "chef's kiss" — dark frosted card over bright photo (light mode), light frosted card over dark blur (dark mode) | ✅ Dual-tone contrast-card creates visual separation; aligns with Hybrid Base surface contract |
| **Dual-tone system** | "love it" — mode toggle for atmosphere | ✅ `[data-tone]` attribute pattern is clean, token-driven, extensible |
| **Warm coffee soul** | Implicit — amber brand, espresso depth | ✅ Split-complementary palette keeps amber as primary; teal is structural accent, not replacement |

**Implementation guardrail:** Any change to card surface, scrim, or blur values must preserve contrast-card visibility in both tones. Visual diff tests required.

---

## Per-Item Assessment

### LAYOUT / HIERARCHY / STRUCTURE (Items 1–5)

---

#### Item 1: Desktop Home Sparse/Unbalanced Layout

**Evidence (shot2.jpg):** Single EntityCard (RB monogram) floats top-left; approximately 60% of viewport is dead background (café photo) with no content. The card at ~350px on 1200px viewport occupies under 30% horizontal space.

**Skill applied:** information-architecture  
**Principle cited:** design-language.md §Mobile-first (L61) — "Every layout is designed for a phone in one hand" — but desktop is also a product surface.

**Assessment:** The layout is mobile-first grid that doesn't reflow gracefully for desktop. Options:

| Option | Treatment |
|--------|-----------|
| **A. Wider card grid** | `grid-template-columns: repeat(auto-fill, minmax(240px, 320px))` — cards fill more space |
| **B. Secondary panel** | Stats + Recent Shots move to right column on `md:` breakpoint |
| **C. Hero hero** | Large featured bag card (16:9 hero treatment) for primary active bag, grid for others |

**Aria recommendation:** **Option B** — two-column layout on `md:` with stats/recent on right. This is information-architecture driven: stats are summary, bags are primary content, recent shots are supporting context. Grouping stats+recent as a sidebar creates clear hierarchy.

**Priority:** P1 (important UX) | **Tag:** [OPERATOR DECISION] — choose layout approach (A/B/C)

---

#### Item 2: Weak Stats Hierarchy

**Evidence (shot1.jpg, shot2.jpg):** "1 / ACTIVE BAGS" "1 / RECENT" "1 / HOUSEHOLD" rendered as small white text scattered across full width, lost over the busy photo background.

**Skill applied:** information-architecture + design-tokens  
**Principle cited:** design-language.md §Typography-led (L59) — "Strong typographic hierarchy carries the UX. Avoid decorative UI chrome."

**Assessment:** Stats currently render as chrome floating over atmosphere. They lack:
- Visual containment (no surface)
- Typographic weight (small font-size)
- Grouping (scattered horizontal distribution)

Per **Principle 13 (Affordance)** from doc-13, StatTiles are informational, not actionable. They should NOT have card chrome (resolved in doc-13) BUT they still need legibility treatment.

**Spec:**
```
Stats strip should:
- Group into a contained row with semi-transparent warm scrim (rgba(18, 11, 6, 0.38)) 
- Use typography hierarchy: value = 24px semibold, label = 12px caps muted
- Align left with page gutter, not scattered full-width
- OR: move to secondary panel if Option B layout adopted
```

**Priority:** P1 (legibility) | **Tag:** [BUILD NOW]

---

#### Item 3: Orphaned Recent Shots Strip

**Evidence (shot2.jpg):** "RECENT SHOTS" section is a thin horizontal strip pinned to bottom edge, disconnected from the Active Bags card above it. Large vertical gap between card and strip.

**Skill applied:** information-architecture  
**Principle cited:** design-language.md §Craft, not productivity (L58) — layout should communicate ritual/care, not dashboard sprawl.

**Assessment:** Recent Shots is related content to Active Bags (you brew the beans you have). Current layout separates them with dead space. The strip-at-bottom pattern suggests pagination/footer, not content relationship.

**Spec:**
- If **Option B layout:** Recent Shots moves to right panel below stats
- If **Option A/C layout:** Recent Shots renders immediately below Active Bags grid with reduced gap (`gap-4` not `gap-8`)
- Consider: Recent Shots as compact rows in the same card-grid container, differentiated by row (not card) treatment

**Priority:** P1 (IA coherence) | **Tag:** [BUILD NOW] (tied to Item 1 layout decision)

---

#### Item 4: Inverted Card Info Hierarchy (Monogram Dominance)

**Evidence (shot2.jpg, shot4.jpg):** EntityCard renders giant "RB" monogram (~120px) occupying 60%+ of card height; bean name "Roaster — Bean", roast badge "Light", ratio "18g → 35g" are cramped at bottom in 14px text.

**Skill applied:** information-architecture + design-review  
**Principle cited:** design-language.md §Typography-led (L59) — data hierarchy should lead.

**Assessment:** The monogram is decorative (initials placeholder when no photo). Data hierarchy should be:
1. **Bean name** (primary identifier)
2. **Roast/status** (quick scan differentiator)
3. **Last brew / ratio** (supporting context)
4. **Monogram/image** (visual anchor, NOT dominant)

**Spec (from doc-15 §4):**
```css
.entity-card-figure {
  aspect-ratio: 16 / 10;  /* was 4:3 — 17% shorter */
}
.entity-card-monogram {
  font-size: clamp(2rem, 6vw, 3.5rem);  /* was clamp(3rem, 8vw, 5rem) — 30% smaller */
}
```

Additionally, consider moving name/roast ABOVE figure area for text-first hierarchy.

**Priority:** P1 (data legibility) | **Tag:** [BUILD NOW] — figure/monogram sizing implemented; text reorder is [OPERATOR DECISION]

---

#### Item 5: Header/Stats Legibility + Perf-vs-Legibility Tradeoff

**Evidence (shot1.jpg, shot5.jpg):** "Home / SUMMARY" header and stats render over busy café photo. Current light-mode blur cut to 12px (from 24px) for battery; scrim added at rgba(45,22,8,0.22).

**Skill applied:** design-tokens + design-review  
**Principle cited:** design-language.md §Surface Contract (L44–48) — "operational content always sits on a guaranteed-contrast solid light surface."

**Assessment:** The text-shadow removal (doc-15 §2) was correct — it looked artificial. The darker scrim (0.22 opacity) helps but may still be insufficient on high-detail photo areas. The 12px blur softens less than 24px.

**Perf-vs-legibility tradeoff analysis:**
- 24px blur on light mode flagged as battery-heavy (Safari composite layer cost)
- 12px blur + 22% scrim is the compromise
- If still illegible, options are: (a) darker scrim, (b) localized header reading band, (c) calmer background image

**Spec:**
- Current 12px blur + 0.22 scrim is acceptable first pass
- If operator reports continued legibility issues, implement **header reading band**: a horizontal gradient strip (`linear-gradient(rgba(45,22,8,0.35), transparent)`) behind header/stats zone only, not full viewport scrim
- Do NOT increase blur radius — perf constraint is real

**Priority:** P2 (polish) | **Tag:** [BUILD NOW] scrim values; [OPERATOR DECISION] if header band needed

---

### BUGS — P0 (Items 6–8)

---

#### Item 6: Stray "Light" Label Leaking Under Home Nav Item

**Evidence (shot5.jpg):** Mobile bottom nav shows "Home" with a yellow "Light" label visually positioned beneath/overlapping the nav item. This is a rendering bug.

**Skill applied:** design-review (bug identification)

**Assessment:** This appears to be:
- A stray tone-toggle label element not properly positioned
- OR: z-index issue where toggle pill is behind nav but label text bleeds through
- OR: a duplicate element rendered during tone transition

**Root cause hypothesis:** The tone toggle on mobile may be positioned absolute and its label ("Light") is escaping its container boundaries, rendering under the nav.

**Spec:**
- Audit `ToneToggle.tsx` / `.tone-toggle` CSS for position containment
- Ensure toggle and label are within a single containing element with `overflow: hidden` if positioned absolute
- Add `z-index` layering: nav items > toggle label

**Priority:** P0 (visible bug) | **Tag:** [BUILD NOW]

---

#### Item 7: Mobile Bottom Clutter — Household Strip AA Failure + Collision

**Evidence (shot4.jpg, shot5.jpg):** Bottom zone shows:
- Cream strip with "HOUSEHOLD" label + "Testing 123" in faint amber
- "Profile" link
- Bottom nav bar
- All compressed into a cramped 80px vertical seam

**Issues identified:**
1. **AA failure:** Amber text on cream fails WCAG AA. "Testing 123" at ~#fbbf24 on ~#faf5ef = ~2.1:1 contrast (fails 4.5:1 requirement for body text)
2. **Collision:** Three distinct elements (household, profile, nav) without clear visual separation
3. **Height budget:** Safe-area + nav + household strip + profile consumes excessive vertical space on mobile

**Skill applied:** design-tokens + design-review  
**Principle cited:** design-language.md §Surface Contract (L44–48) — WCAG AA is required.

**Spec:**
- **AA fix:** Household name text must use `--kk-tc-text-primary` (espresso brown) on cream, not amber
- **Collision fix:** Household strip should merge INTO bottom nav as a contextual indicator (left-aligned name in nav bar), not a separate strip above it
- **Simplification:** Profile link moves to nav or is accessible via tap on household indicator — not a separate floating element

**Priority:** P0 (AA failure is accessibility bug) | **Tag:** [BUILD NOW] for AA; [OPERATOR DECISION] on household/profile consolidation

---

#### Item 8: Tone System Inverted/Ambiguous + Toggle Label Semantics

**Evidence (shot2.jpg = light mode with dark nav/card contrast, shot3.jpg = dark mode with light card contrast):** The surfaces CONTRAST their tone mode — light mode has dark elements prominent, dark mode has light elements prominent. This is intentional per Hybrid Base but creates user confusion.

**Evidence (shot5.jpg):** Toggle shows "☀️ Light" — does this mean "you ARE in Light mode" or "tap to SWITCH to Light mode"?

**Skill applied:** design-review + ui-design-contract  
**Principle cited:** design-language.md §Hybrid Base (L36–48) — "espresso-dark frame/chrome carries identity; solid light elevated warm surfaces carry operational content."

**Assessment:**

**A. The inversion is intentional and correct:**
- Light mode = bright atmospheric background + dark contrast card = ✅ content pops
- Dark mode = dark atmospheric background + light contrast card = ✅ content pops
- This IS the Hybrid Base system working as designed

**B. Toggle label semantics need audit:**
- Current: icon + mode name label (e.g., "☀️ Light")
- Ambiguity: Does label indicate current state or target state?
- Standard convention: Label indicates CURRENT state ("Light" means you're in light mode)
- iOS convention: Toggle often shows the TARGET state

**Spec:**
- **Confirm label = current state** (standard web pattern). "☀️ Light" visible = you ARE in Light mode
- If operator prefers target-state labeling, use "Switch to Dark" / "Switch to Light" explicitly
- Add `aria-pressed="true/false"` to toggle button for accessibility clarity

**Priority:** P0 (usability ambiguity) | **Tag:** [BUILD NOW] — document the convention; audit `aria-` attributes

---

### COLOR / PALETTE (Items 9–10)

---

#### Item 9: Amber+Teal Split-Complement Coherence + AA Audit

**Applied palette (doc-15, Option A):**
- Sidebar light: `#e6f2f0` bg / `#0a4d48` text
- Sidebar dark: `#0a4d48` bg / `#cffafe` text
- Brand wordmark: forced `#0a4d48` in light (amber failed AA on sage-teal)
- Card surface: eggshell `#faf5ef`

**Skill applied:** design-tokens  
**Principle cited:** design-language.md §Palette Guardrails (L164–169) — "Amber remains primary CTA/brand anchor. Cool accents are sanctioned only for information/status, taste-zone encoding..."

**Assessment:**

**A. Does it read coherent and warm?**
- ✅ Card surface eggshell (#faf5ef) is warmer than stark white
- ⚠️ Teal sidebar introduces a distinct cool temperature
- The split-complement relationship (amber 30° → teal 175°) is color-theory justified BUT visual warmth depends on proportion. If sidebar dominates visually, the app may feel cooler than intended.

**B. AA audit across new combos:**

| Surface | Text | Hex Combo | Contrast | AA Status |
|---------|------|-----------|----------|-----------|
| Light sidebar (#e6f2f0) | Deep teal (#0a4d48) | #0a4d48 on #e6f2f0 | 8.2:1 | ✅ AAA |
| Dark sidebar (#0a4d48) | Glint cyan (#cffafe) | #cffafe on #0a4d48 | 10.3:1 | ✅ AAA |
| Light sidebar (#e6f2f0) | Amber brand (#b45309) | — | 3.8:1 | ❌ Fails AA |
| Light sidebar (#e6f2f0) | Forced teal wordmark (#0a4d48) | — | 8.2:1 | ✅ AA |
| Eggshell card (#faf5ef) | Espresso text (#2d1608) | — | 12.8:1 | ✅ AAA |

**Diagnosis:** The forced teal wordmark on light sidebar is correct (amber failed). All primary text combos pass AA. The amber CTAs on cream card (#92400e on #faf5ef = 6.4:1) also pass.

**C. Warmth concern:**
- The teal sidebar may feel "corporate" if it's too prominent or saturated
- Current `#e6f2f0` (sage-teal) is desaturated and soft — this helps
- Recommendation: Ensure sidebar remains a structural anchor, not the visual focal point. Warm content surfaces should dominate viewport area.

**Spec:**
- Palette passes AA audit
- Warmth is an operator visual judgment call post-implementation
- If teal reads too cold, fallback is **Option B** (bark sidebar) from doc-15

**Priority:** P2 (polish/preference) | **Tag:** [BUILD NOW] — implement; [OPERATOR DECISION] post-visual if teal is too cold

---

#### Item 10: Light-Mode Background Adequacy (Scrim + 12px Blur)

**Current applied values (doc-15 §2):**
- Light scrim: `rgba(45,22,8,0.22)` (warm espresso)
- Light blur: 12px (reduced from 24px for perf)
- Dark scrim: `rgba(18,11,6,0.52)` (raised from 0.45)
- Dark blur: 24px (unchanged)

**Skill applied:** design-tokens + design-review  
**Principle cited:** design-language.md §Liquid Glass Restraint (L62) — blur confined to chrome/overlay.

**Assessment:**
- 12px blur provides soft focus but not full abstraction — photo details still read through
- 22% espresso scrim dims brightness without going grey
- Combined effect: moody but busy. The scrim tames highlights; the blur softens edges.

**Is it enough?** This is subjective and depends on photo content. The current café photo has high detail (people, shelving, signage, "DESSERTS" neon). Even with scrim+blur, it competes with content.

**Options if insufficient:**
1. **Darker scrim** (0.28–0.35) — dims more, may feel muddy
2. **Header reading band** (gradient strip behind header/stats)
3. **Calmer background image** (less detail, more atmospheric)

**Spec:**
- Current values are the starting point
- Operator evaluates live — if still too busy, implement header reading band OR replace image (see Item 11)

**Priority:** P2 (refinement) | **Tag:** [BUILD NOW] current values; [OPERATOR DECISION] on tuning

---

### BRAND / ASSETS (Items 11–12)

---

#### Item 11: Background Image Off-Brand

**Evidence (all shots):** The background is a café photo featuring a pastry display case, "DESSERTS" neon sign, and a barista. This is a dessert café scene, not an espresso/coffee scene.

**Skill applied:** design-brief  
**Principle cited:** design-language.md §Photography-anchored (L60) — "Photographic route backgrounds remain warm atmosphere behind the surface contract."

**Assessment:** The image's subject matter (desserts, pastries) is misaligned with the app's espresso/coffee focus. While the warm tones are appropriate, the content is thematically off.

**Recommended imagery direction:**
- **Subject:** Close-up espresso extraction, latte art, coffee beans, portafilter, grinder
- **Mood:** Warm, moody, shallow depth of field, low-detail atmospheric (supports readability)
- **Color temperature:** Golden/amber lighting, espresso browns, crema tones
- **Avoid:** Busy café interiors, text/signage, people's faces, multiple focal points

**Priority:** P2 (brand alignment) | **Tag:** [SEPARATE] — image sourcing is independent task (use `.github/copilot-prompts/image-sourcing.md`)

---

#### Item 12: Kaapi Kadai Logo/Icon Generic

**Evidence (shot2.jpg sidebar):** The wordmark/icon appears generic and doesn't communicate coffee/espresso identity.

**Skill applied:** design-brief

**Assessment:** Logo/brand identity work is outside UI component scope. This requires a separate brand identity design effort.

**Spec:** File as separate brand identity task. Define brief:
- **Name:** Kaapi Kadai (Tamil for "coffee shop")
- **Direction:** Artisanal, craft espresso, warm, ritual-focused
- **Elements to consider:** Portafilter silhouette, espresso cup, steam wisps, South Indian coffee filter
- **Avoid:** Generic coffee bean icons, corporate sans-serif treatment

**Priority:** P2 (brand) | **Tag:** [SEPARATE] — brand identity task

---

### EARLIER THREADS VERIFICATION (Items 13–18)

---

#### Item 13: Principle 13 — StatTiles Informational

**Status:** ✅ RESOLVED in doc-13

**Verification:** StatTiles are non-interactive (`<div>` elements). Per Principle 13, they should NOT have card chrome that implies tappability. Doc-13 specifies:
```css
.stat-tile { background: transparent; border: none; border-radius: 0; }
```

**Does this hold against EntityCard affordance?**
- EntityCard = `<Link>` with hover/active states → card chrome justified
- StatTile = `<div>` display-only → no card chrome
- ✅ Distinction is correct and holds

**Priority:** N/A (resolved) | **Tag:** [VERIFIED]

---

#### Item 14: CTA System Coherence Across Pages

**Status:** ⚠️ PARTIALLY RESOLVED

**Verification (doc-15 §3 audit):**
- ToneButton adoption within tone-aware pages (Dashboard, CatalogDetail, BrewLogDetail): ✅ Consistent
- Non-tone pages (NotFound, InviteExpired, GuestView): ❌ Still using raw `btn btn-primary btn-bevel`

**Assessment:** The divergence is structural — non-tone pages lack `[data-tone]` ancestor, so ToneButton tokens don't resolve. The visual difference is subtle (both use amber) but token coherence matters.

**Spec:** Wrap non-tone pages in `<div data-tone="dark">` and migrate to ToneButton. This is lower priority than home page work.

**Priority:** P2 (consistency) | **Tag:** [SEPARATE] — post-spec-043 task

---

#### Item 15: Bean Card Size Reduction

**Status:** ✅ IMPLEMENTED in doc-15 §4

**Verification:**
- Grid max-width: `minmax(180px, 220px)` — caps card width on desktop
- Figure aspect: `16/10` (from `4/3`) — 17% shorter
- Monogram: `clamp(2rem, 6vw, 3.5rem)` — 30% smaller

**Does it address the layout void (Item 1)?** Partially — smaller cards don't fill the void, they make it larger. Item 1 layout decision is the real fix.

**Priority:** N/A (implemented) | **Tag:** [VERIFIED] but [DEPENDS ON] Item 1 layout

---

#### Item 16: Mobile Back Link + Tone Toggle Legibility

**Status:** ⚠️ NEEDS VERIFICATION

**From doc-13 / history.md:**
- Back link: tone-aware tokens (`--kk-tc-back-link-color`) — amber for dark, bark brown for light
- Tone toggle: flagged as 11px too small, hardcoded colors

**Spec:**
- Back link: Verify bark brown (#92400e) renders on cream in light mode — should be ~6.2:1 (AA pass)
- Tone toggle: Bump to 14px minimum, use tone-aware text color token

**Priority:** P1 (legibility) | **Tag:** [BUILD NOW] — verify/fix toggle size and colors

---

#### Item 17: Performance — WebGL Ambient Cut, Aesthetic Loss?

**Status:** ✅ ACCEPTABLE

**Changes made:**
- WebGL ambient: cut to static gradient fallback (`--kaapi-ambient-static-gradient`)
- Hero hover-motion: removed
- Light blur: 24px → 12px

**Assessment:** The static ambient gradient is acceptable — it provides depth without GPU cost. The hero motion removal is operator-authorized. No aesthetic loss requiring recovery.

**If operator desires richer ambient:**
- WebGL ambient could be re-enabled on desktop-only with `matchMedia('(min-width: 768px)')`
- This is a [SEPARATE] optimization, not a regression

**Priority:** N/A (resolved) | **Tag:** [VERIFIED]

---

#### Item 18: EntityCard Faintness on Dark Tone

**Status:** ❓ NEEDS VISUAL VERIFICATION

**Original concern:** EntityCard surface too faint/low-contrast on dark mode.

**Current state:** Dark mode card uses `rgba(24, 16, 10, 0.72)` glass surface with blur behind it.

**Assessment:** With the light contrast-card system (light card on dark blur), this should be resolved — the card is now LIGHT (#faf5ef-ish surface) over dark blur, not a dark card trying to separate from dark background.

**Verification needed:** Confirm light contrast-card renders with sufficient brightness on dark mode. If still faint, increase card surface opacity or add border highlight.

**Priority:** P1 (verify) | **Tag:** [BUILD NOW] — visual verification required

---

## Priority Summary

### P0 — Bugs/Blockers (Must Fix)

| Item | Issue | Tag |
|------|-------|-----|
| 6 | Stray "Light" label leaking under Home nav | [BUILD NOW] |
| 7 | Mobile bottom AA failure (amber on cream) + collision | [BUILD NOW] |
| 8 | Tone toggle label semantics + aria attributes | [BUILD NOW] |

### P1 — Important UX/Legibility

| Item | Issue | Tag |
|------|-------|-----|
| 1 | Desktop layout sparse/unbalanced | [OPERATOR DECISION] layout approach |
| 2 | Stats hierarchy weak | [BUILD NOW] |
| 3 | Recent Shots orphaned | [BUILD NOW] (tied to Item 1) |
| 4 | Card info hierarchy inverted (monogram dominance) | [BUILD NOW] sizing; [OPERATOR DECISION] text reorder |
| 16 | Mobile toggle legibility | [BUILD NOW] |
| 18 | EntityCard dark-mode contrast verify | [BUILD NOW] verify |

### P2 — Polish/Preference

| Item | Issue | Tag |
|------|-------|-----|
| 5 | Header legibility over photo | [BUILD NOW] scrim; [OPERATOR DECISION] header band |
| 9 | Teal warmth perception | [OPERATOR DECISION] post-visual |
| 10 | Light scrim adequacy | [OPERATOR DECISION] post-visual |
| 11 | Background image off-brand | [SEPARATE] |
| 12 | Logo/icon generic | [SEPARATE] |
| 14 | Non-tone page CTA migration | [SEPARATE] |

---

## Ordered Remediation Plan — Finn Build List

### Phase 1: P0 Bugs (Immediate)

1. **Item 6 — Tone toggle position containment**
   - Audit `ToneToggle` CSS; add container `overflow: hidden`; fix z-index layering
   - Verify no label element escapes bounds

2. **Item 7a — Household text AA fix**
   - Change household name text to `var(--kk-tc-text-primary)` (espresso brown), not amber
   - Verify 4.5:1 minimum contrast on cream

3. **Item 8 — Toggle aria attributes**
   - Add `aria-pressed="true"` when in corresponding mode
   - Document: label = current state ("Light" means you ARE in light)

### Phase 2: P1 Legibility (Build Now)

4. **Item 2 — Stats strip treatment**
   - Group stats into contained row
   - Apply semi-transparent scrim behind stats (`rgba(18, 11, 6, 0.38)`)
   - Typography: value 24px semibold, label 12px caps muted
   - Align left with page gutter

5. **Item 4 — Card sizing (already spec'd in doc-15)**
   - Confirm figure `16/10`, monogram `clamp(2rem, 6vw, 3.5rem)`, grid `minmax(180px, 220px)`

6. **Item 16 — Toggle size bump**
   - Minimum 14px font-size on toggle
   - Use tone-aware text color token

7. **Item 18 — Dark mode card contrast verify**
   - Visual check: light contrast-card on dark blur
   - If faint, add `border: 1px solid rgba(255,255,255,0.08)` highlight

### Phase 3: Layout (After Operator Decision)

8. **Item 1/3 — Layout approach**
   - Implement operator-chosen layout (Option A/B/C)
   - Move Recent Shots per chosen approach

### Phase 4: Polish (Post-Visual)

9. **Item 5 — Header band** (if needed)
10. **Item 9/10 — Teal warmth / scrim tuning** (if needed)

---

## Consolidated Operator Decision Questions

| # | Question | Options | Aria Rec |
|---|----------|---------|----------|
| 1 | **Desktop layout approach** | A: Wider card grid / B: Two-column with stats-right / C: Hero featured card | **B** — clearest IA |
| 2 | **Card text reorder** (name above figure)? | Yes / No | Yes (data-first) |
| 3 | **Household/Profile consolidation** on mobile | Merge into nav / Keep separate | Merge (simplify) |
| 4 | **Header reading band** needed? | Yes / No / Evaluate post-build | Evaluate post-build |
| 5 | **Teal sidebar warmth** post-implementation | Accept / Revert to Option B bark | Accept (evaluate live) |

---

## Skills Applied + Evidence Summary

| Skill | Key Application | Evidence Location |
|-------|-----------------|-------------------|
| **ui-design-contract** | Verified blur scope, surface contract, hybrid base | design-language.md L36–48, L178–260 |
| **reuse-before-create** | Audited existing tone tokens before proposing changes | index.css L1396–1559 |
| **design-tokens** | Palette AA audit, scrim values, card surface | doc-15 §1, design-language.md §Palette |
| **design-review** | Structured Must/Should/Could with P0/P1/P2 | All 18 items assessed above |
| **information-architecture** | Layout balance, hierarchy, content grouping | Items 1–4 analysis |
| **design-brief** | Warmth, brand alignment, imagery direction | Items 9, 11, 12 |

---

*Prepared by Aria · spec-043 holistic critique · 2026-06-19*
