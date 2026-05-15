---
name: "Reuse Before Create"
description: "Agents check for existing patterns, configs, utilities, and components before creating new ones. Prevents duplication and keeps the codebase cohesive."
domain: "architecture, code-quality, duplication-prevention"
confidence: "high"
source: "operator-mandate: repeated pattern of unnecessary duplication across configs, backend services, and frontend components"
tools: []
---

## Context

This project has repeatedly hit duplication failures:

1. **Config/Secrets**: Adding standalone env vars (e.g., `USE_POSTGRES`) instead of reusing existing `APP_SECRETS` JSON blob.
2. **Backend Code**: Writing new utility functions or service methods instead of checking existing repos, services, or utilities.
3. **Frontend Components**: Creating new UI templates instead of reusing existing components and hooks.
4. **General Pattern**: Agents build something new when an existing entity already covers the need, leading to scattered maintenance burden and inconsistent interfaces.

This skill enforces a single principle: **Always ask if the thing you're about to create already exists in a better form.**

## Patterns

### Config & Secrets

- **Before adding a new environment variable**: Check if it belongs in an existing config blob (e.g., `APP_SECRETS`, `FEATURE_FLAGS`).
- **Before creating a new secrets pattern**: Review `app/config.py` (`Settings._load_app_secrets`) for the canonical injection pattern — add a field to `Settings` and let `_load_app_secrets` map the blob key automatically. Do not reach into `app/deps.py` or `app/main.py` to add raw `os.getenv` calls.
- **Reuse existing precedent**: If `APP_SECRETS` is a JSON blob in Cloud Run, new secrets should go there, not as standalone vars.
- **Single source of truth**: Configuration centralization beats ad-hoc env vars every time.

### Backend Code

- **Before writing a new utility function**: Search `app/services/`, `app/repos/`, and `app/utils/` for existing patterns.
- **Before creating a new service class**: Check if the pattern already exists in an existing service or repository.
- **Repository pattern**: All data access must go through a repo (`SheetsClientProtocol`-implementing class). Never add a new data-fetch method that doesn't reuse the repo layer.
- **Reuse dependency injection**: If a service is injected via `app/deps.py`, add new features to the existing service instead of creating a sibling.
- **Check existing routers**: New route handlers should extend existing routers in `app/routers/` before creating a new router file.

### Frontend Components

- **Before creating a new component**: Check `frontend/src/components/` for existing patterns that cover the UI need.
- **Before creating a new hook**: Search `frontend/src/hooks/` for existing hooks that do the job.
- **Template reuse**: DaisyUI + TailwindCSS provide a design language; use existing card, button, modal, and form patterns before inventing custom markup.
- **API client pattern**: New data fetches should use the typed API client in `frontend/src/api/` instead of inline fetch calls.
- **Routing consistency**: New pages should follow the pattern established in `frontend/src/pages/` — reuse layout, navbar, and sidebar components.

### General Gate: Before You Create

When you are about to write a new "thing" (function, class, component, env var, config field, etc.), run this mental checklist:

1. **Does it already exist?**
   - Search the codebase (grep, IDE symbol lookup) for the exact pattern or name.
   - Check similar utilities, services, or components that cover the same domain.
   - Ask: "If I wanted to do this without writing new code, what existing code would I call?"

2. **Is there an existing injection point or pattern?**
   - Backend: Is there an existing repo, service, or utility that should be extended instead?
   - Frontend: Is there a component, hook, or API client that should be used or extended?
   - Config: Is there an existing config blob or injection mechanism that should be reused?

3. **What's the precedent in this codebase?**
   - How did the last person solve a similar problem?
   - Can you follow the exact same pattern?

4. **Does the existing entity need refactoring instead?**
   - Sometimes reusing means "the existing utility needs a parameter" — that's a refactor, not duplication.
   - Refactoring is cheaper than maintaining two versions.

5. **If you create a new thing, can you remove an old one?**
   - If you've written a better version of an existing pattern, delete the old one.
   - Don't let the old one sit as technical debt.

## Examples

### Config: Reuse APP_SECRETS

**❌ Anti-pattern:**
```python
# app/main.py — adding new env var for new feature
USE_POSTGRES = os.getenv("USE_POSTGRES", "false").lower() == "true"
USE_NEW_AI_MODEL = os.getenv("USE_NEW_AI_MODEL", "false").lower() == "true"
```

**✅ Pattern:**
```python
# app/config.py — add fields to Settings; _load_app_secrets maps blob keys automatically
class Settings(BaseSettings):
    use_postgres: bool = False       # set via USE_POSTGRES env var or APP_SECRETS blob key
    use_new_ai_model: bool = False   # set via USE_NEW_AI_MODEL env var or APP_SECRETS blob key

# In your code — access via the singleton; never parse APP_SECRETS JSON directly
from app.config import settings
if settings.use_postgres: ...
if settings.use_new_ai_model: ...
```

### Backend Service: Extend, Don't Duplicate

**❌ Anti-pattern:**
```python
# services/new_inference_engine.py — created because agent didn't check existing service
def generate_description_for_brew(brew_data):
    # reimplements what InferenceService.infer() already does
```

**✅ Pattern:**
```python
# services/inference.py — already exists, extend it
class InferenceService:
    def infer(self, prompt, model_override=None):
        # One method, reused by all callers
        
# In your code:
description = inference_service.infer(f"describe: {brew_data}")
```

### Frontend Component: Reuse DaisyUI & Existing Patterns

**❌ Anti-pattern:**
```typescript
// components/CustomCard.tsx — invented new card when DaisyUI card exists
export const CustomCard = ({ title, children }) => (
  <div className="p-4 border rounded shadow">
    <h2>{title}</h2>
    {children}
  </div>
);
```

**✅ Pattern:**
```typescript
// Use existing DaisyUI pattern (imported or composed)
export const BrewCard = ({ brew }) => (
  <div className="card bg-base-100 shadow-xl">
    <div className="card-body">
      <h2 className="card-title">{brew.name}</h2>
      <p>{brew.description}</p>
    </div>
  </div>
);
```

## Anti-Patterns

1. **"It's simpler to write my own utility than find the existing one"** — False economy. Finding and refactoring saves time and reduces debt.
2. **"The existing service is close, but I'll create a new one rather than refactor"** — Duplicated logic leads to bugs when one is updated and the other isn't.
3. **"I'll create a config flag for this feature"** — Check if the pattern exists in `APP_SECRETS` or existing middleware first.
4. **"This UI is unique, so I need a custom component"** — 90% of the time, DaisyUI + TailwindCSS + existing patterns cover the need.
5. **"I don't know if it exists, so I'll just write it"** — Take 5 minutes to search. Reuse saves hours of maintenance.

## When This Skill Applies

- **Always**: Before any code generation, file creation, or config addition.
- **During planning**: When designing a new feature, ask what existing patterns can be reused.
- **During review**: If code review flags duplication, apply this skill to merge the patterns.
- **During refactoring**: Use this skill to identify and consolidate duplicated logic.

## Responsibility

Every agent is responsible for self-checking this skill **before** creating a new file, function, component, or config field. This is not a luxury — it's a team standard.
