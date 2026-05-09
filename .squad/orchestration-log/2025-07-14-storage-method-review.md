# Orchestration Log — 2025-07-14

**Review**: Storage Method Dropdown Empty Bug Review  
**Branch**: `bugfix/brew-log-ux-gaps`  
**Participants**: Priya (PM) · Maya (BE Architect) · Finn (FE) · Quinn (QA) · Aria (UX)  
**Session Date**: 2025-07-14  

---

## Timeline

### 1. **Priya (PM)** — Scope & Product Review

**Focus**: User value, scope clarity, out-of-scope risks  
**Inputs**:
- Spec: `specs/015-brew-log-ux-gaps/spec.md` (user story: "As a user, I want the Storage Method dropdown to auto-populate so I don't see a blank list")
- Current behaviour: BrewLogAdd shows empty dropdown on page load, user must wait for API
- Two options presented: Option 1 (fetch on mount) vs Option 2 (static constant)

**Decision**: 
- **APPROVE WITH NOTES** — Option 2 preferred for user onboarding experience
- User should never see a loading spinner for basic metadata
- Risk: If storage methods change later → flag for future versioning discussion
- Recommendation: Add analytics to track which storage methods get created (may inform future pruning)

---

### 2. **Maya (BE Architect)** — Architecture & Backend Review

**Focus**: System-level correctness, no regressions, seed script rationale  
**Inputs**:
- Option 1: Fetch `/api/storage-methods` on component mount, cache in React state
- Option 2: Hardcode 6 storage methods in `STORAGE_METHODS` constant, seed DB at app init

**Analysis**:
- **Blocker (Option 1)**: API call on every page load defeats caching; forces UI wait on server
- **Viable (Option 2)**: Seed script at app startup (`scripts/seed_storage_methods.py`) ensures DB is populated; constant is the single source of truth

**Decision**:
- **APPROVE WITH NOTES** — Confirm Option 2
- Backend seed script must be idempotent (upsert, not insert)
- Location: `app/routers/storage_methods.py` (or `app/repos/storage_repo.py`)
- Pre-hook: Seed runs before server listens (in `main.py` startup)
- Rationale: Eliminates sync risk between frontend constant and DB

---

### 3. **Finn (FE Engineer)** — Frontend Code Viability

**Focus**: Component contract, TypeScript safety, rendering correctness  
**Inputs**:
- Current BrewLogAdd: `<select name="storage_method">` (empty or fetching)
- Proposed: Import `STORAGE_METHODS` constant, render via `.map()`
- No prop interface change needed

**Code Sketch**:
```typescript
import { STORAGE_METHODS } from '../constants';

export function BrewLogAdd() {
  return (
    <select name="storage_method">
      {STORAGE_METHODS.map(m => (
        <option key={m.id} value={m.id}>{m.label}</option>
      ))}
    </select>
  );
}
```

**Decision**:
- **APPROVE** — No blockers
- Suggest: Add `role="combobox"` or `aria-label="Storage method"` for a11y
- Optional: Consider `<optgroup>` if storage methods grow beyond 10 (not needed now)

---

### 4. **Quinn (QA Engineer)** — Test Coverage & Success Criteria

**Focus**: Acceptance scenarios testable, success criteria measurable, test coverage  
**Inputs**:
- SC-1: All 6 storage methods render in dropdown (no loading state)
- SC-2: No spinner/empty state on page load
- SC-3: Form submission with each storage method succeeds
- SC-4: Invalid/out-of-range storage_method rejected by backend

**Coverage Gap**: No explicit test for all 6 values; old tests may only check 2–3 methods.

**Decision**:
- **APPROVE WITH NOTES** — Test coverage gap exists
- New test file: `frontend/src/components/BrewLogAdd.test.tsx`
- Checklist:
  - ✓ Render test: all 6 methods present in DOM
  - ✓ Submission test: select each method, submit, verify backend receives correct value
  - ✓ Accessibility test: `<select>` has `aria-label`
  - ✓ Edge case: missing STORAGE_METHODS export → build should fail (TS)
- Backend test: seed script ran → DB contains all 6 methods

---

### 5. **Aria (UX/Design)** — Empty State & Visual Feedback

**Focus**: Visual hierarchy, colour, responsiveness, accessibility  
**Inputs**:
- Current UX: Blank dropdown during load (confuses users: "Is it broken?")
- New UX: Static dropdown always populated; empty-state messaging on main page if zero brews exist

**Design Notes**:
- **"No brews yet"** empty state should include hint: "Select a storage method and create your first brew"
- Accessibility: All 6 options must be keyboard-selectable (native `<select>` handles this)
- Responsiveness: Dropdown width should adapt to longest label ("French Press", "AeroPress")

**Decision**:
- **APPROVE WITH NOTES** — UX clarity improved
- Design task: Create Figma mockup for empty-state "No brews yet" card (out of scope for this PR, backlog)
- Recommend: Add hover tooltip to storage method labels explaining each (future enhancement)

---

## Consensus Decision

| Component | Status |
|-----------|--------|
| **Architecture** | Option 2 (static constant + DB seed) ✅ |
| **Frontend code** | Ready ✅ |
| **Backend seed script** | Ready ✅ |
| **Test coverage** | Gap identified, plan added ✅ |
| **UX/empty-state** | Notes documented, future design task created ✅ |

**UNANIMOUS VERDICT**: **PROCEED TO IMPLEMENTATION**

---

## Action Items

| Owner | Item | Priority |
|-------|------|----------|
| Maya | Finalize backend seed script location + idempotency check | P0 |
| Finn | Implement BrewLogAdd with STORAGE_METHODS | P0 |
| Quinn | Write component test file with 6-method checklist | P0 |
| Aria | (Future) Design "No brews yet" empty state | P2 |
| Priya | (Future) Discuss storage method versioning strategy | P2 |

---

## Artifacts

- **Session Log**: `.squad/log/2025-07-14-storage-method-review.md`
- **Decision**: `.squad/decisions.md` (active)
- **Spec**: `specs/015-brew-log-ux-gaps/spec.md`
- **Plan**: `specs/015-brew-log-ux-gaps/plan.md`
