# Coffee Tracker — Engineering Architecture (v2.0)

> **Document status:** DRAFT — supersedes `engineering_architecture.md` (v0.1)
>
> **What changed from v1:** Multi-tenant household model; Google Sheets replaced by Cloud SQL for PostgreSQL; household roles and permissions model added; phased Sheets → Postgres migration plan; updated cost model for up to 10 households / 30 users; IAP decision revisited; Cloud Run vs GKE verdict for mobile-app path; **dual-path auth (username+argon2id primary + Google OAuth optional) fully in scope for v2.0 — designed for long-term scale including future iOS/Android clients; `ALLOWLIST_EMAILS` deprecated**. All decisions are explicit verdicts, not open questions.

**TL;DR** — The core Python/FastAPI/React/Cloud Run stack is unchanged. Google Sheets is retired as the system of record in favour of **Cloud SQL for PostgreSQL** (`db-f1-micro`), which costs ~$8/month always-on and scales gracefully to the $50/month peak ceiling. A **household model** with row-level data isolation and two roles (`admin`, `member`) enables the multi-user sharing scenario. Auth is **dual-path: username+argon2id (primary) + Google OAuth (optional convenience)**; `ALLOWLIST_EMAILS` is deprecated and replaced by the household invitation system — IAP is re-evaluated and rejected on cost grounds (an HTTPS Load Balancer adds ~$18/month of floor cost without meaningful benefit at this scale). Cloud Run stays; GKE is explicitly deferred. One engineer can operate the full system.

---

## 1. Architecture at a Glance

| Layer | v1 | v2 | Rationale for change |
|---|---|---|---|
| App framework | FastAPI (JSON API) | FastAPI (JSON API) | No change |
| Frontend SPA | React 18 + Vite + TypeScript | React 18 + Vite + TypeScript | No change |
| Styling / UI kit | Tailwind CSS + DaisyUI | Tailwind CSS + DaisyUI | No change |
| Backend lang | Python 3.12 | Python 3.12 | No change |
| Hosting | Cloud Run (scale-to-zero) | Cloud Run (scale-to-zero) | No change — GKE deferred |
| Infra as Code | Terraform (GCS-backed state) | Terraform (GCS-backed state) | +Cloud SQL resources |
| Build / Deploy | Cloud Build trigger on push-to-main | Cloud Build trigger on push-to-main | No change |
| **Data store** | **Google Sheets via gspread** | **Cloud SQL for PostgreSQL (db-f1-micro)** | Multi-tenancy, concurrency, relational queries |
| **Auth** | **Google OAuth + email allowlist** | **Username+argon2id (primary) + Google OAuth (optional) + household roles** | Username+password primary; Google OAuth retained as optional convenience; `ALLOWLIST_EMAILS` deprecated |
| **Tenancy** | **Single shared workbook** | **Row-level isolation with `household_id`** | Multiple independent households |
| Secrets | GCP Secret Manager | GCP Secret Manager | +DATABASE_URL |
| LLM | Gemini Flash (default) / Anthropic Haiku | Gemini Flash (default) / Anthropic Haiku | No change |
| PWA | Web manifest + service worker | Web manifest + service worker | No change |
| Observability | Cloud Run built-in logs | Cloud Run built-in logs + structured query logs | No change (minor enhancement) |

---

## 2. Database Decision

### 2.1 Options Considered

| Option | Monthly floor | Concurrency | SQL | Multi-tenant | Hand-edit | Migration complexity | Verdict |
|---|---|---|---|---|---|---|---|
| Google Sheets (status quo) | $0 | ~60 writes/min (single user) | ❌ | ❌ (one sheet = one tenant) | ✅ | N/A | **Rejected — can't scale to multiple households** |
| SQLite on Cloud Run | $0 | ❌ (multi-instance unsafe) | ✅ | ⚠️ | ❌ | Low | **Rejected — unsafe with Cloud Run horizontal scaling** |
| SQLite on GCS (swap-back dance) | $0 | ❌ (single writer only) | ✅ | ⚠️ | ❌ | Medium | **Rejected — same concurrency problem, extra complexity** |
| **Cloud SQL Postgres (db-f1-micro)** | **~$8/month** | ✅ | ✅ | ✅ (row-level + RLS) | ✅ (Cloud SQL Studio) | Medium | **✅ CHOSEN** |
| Firestore | $0 | ✅ | ❌ (NoSQL) | ✅ (subcollections) | ❌ | High | **Rejected — document model doesn't fit relational data; no SQL** |
| BigQuery | $0 (storage) | ✅ (analytics) | ✅ | ✅ | ❌ | High | **Rejected — optimised for analytics, not transactional OLTP** |
| Cloud Spanner | ~$500+/month | ✅ | ✅ | ✅ | ❌ | High | **Rejected — wildly over budget** |

### 2.2 Verdict: Cloud SQL for PostgreSQL (db-f1-micro)

**Chosen.** Rationale:

1. **Real SQL with row-level security.** `household_id` column on every tenant-scoped table, enforced at the Postgres RLS layer. No application-level bypass possible for correctly-written queries.
2. **Repository pattern maps 1:1.** The existing `CatalogRepo`, `BrewLogRepo`, etc. already define clean protocol interfaces (`list`, `get`, `upsert`). The migration is a swap of the implementation — `SheetsCatalogRepo` → `SqlCatalogRepo` — with no change to routers or services.
3. **Cost is bounded and predictable.** `db-f1-micro` shared-core Postgres: ~$7.67/month. At peak (10 households, 30 users), the DB cost is still ~$10/month with a slightly larger instance if needed. The $50 ceiling is never threatened by the database alone.
4. **One-engineer operability.** Cloud SQL Studio (browser UI) provides a query editor, row browser, and import/export. `gcloud sql connect` provides a `psql` shell. Alembic handles schema migrations. No DBA required.
5. **Connection from Cloud Run.** Cloud Run connects to Cloud SQL via the Cloud SQL Auth Proxy (Unix socket, no IP whitelisting). The `DATABASE_URL` secret is mounted as an env var. Local dev uses Cloud SQL Auth Proxy or direct socket via `gcloud sql connect`.

**Why not Firestore?** The data model is inherently relational: a `BrewLogEntry` has FK relationships to `InventoryBag`, `CatalogBean`, and `Hardware`. Firestore's subcollection model forces denormalisation and makes cross-entity queries expensive or impossible without fetching entire collections. SQL is the right tool here.

**Why not SQLite?** Cloud Run can spin up multiple container instances under load. SQLite is a file, not a server — concurrent writes from multiple instances corrupt the database. GCS-backed SQLite (download → write → upload) serialises every write through a distributed lock; the failure modes are complex and the operational story is weak.

### 2.3 Cost Model for Database Alone

| Tier | Instance | Storage | Monthly |
|---|---|---|---|
| Baseline (25 req/day, 1 household) | db-f1-micro | 10 GB SSD (~$1.70) | ~$9.40 |
| Mid (150 req/day, 3 households, 10 users) | db-f1-micro | 10 GB SSD | ~$9.40 |
| Peak ($50 ceiling, 1000 req/day, 10 households, 30 users) | db-g1-small (~$25/month) | 20 GB SSD (~$3.40) | ~$28.40 |

At no tier does the database alone breach the $50 ceiling. See §11 for the full three-tier cost model.

---

## 3. Auth Architecture

### 3.1 IAP Decision

| Option | Monthly floor | Auth location | Household roles | Verdict |
|---|---|---|---|---|
| **Username+argon2id + Google OAuth (dual-path)** | **~$0** | App code (python-jose, passlib) | Added in app layer | **✅ CHOSEN** |
| IAP (Identity-Aware Proxy) | ~$18 (HTTPS LB) + $0.01/10k reqs | Google-managed | Not supported — IAP is user-level only | **Rejected** |

**IAP is rejected.** The reasons from v1 remain valid and the household-level roles requirement makes it *less* attractive:

1. **HTTPS Load Balancer is ~$18/month minimum** — more than the entire rest of the system at baseline. With Cloud SQL at ~$8/month, IAP would push the baseline bill to ~$26/month before a single request is served.
2. **IAP does not support roles.** IAP enforces binary allow/deny per Google identity; app-layer role enforcement is required regardless.
3. **IAP requires Cloud Load Balancing**, which removes Cloud Run's direct URL and adds latency (~30–50ms) per request.

**When to revisit IAP:** Corporate SSO/2FA compliance requirement for a team of >5 engineers. Not anticipated.

### 3.2 Auth Design

> **Decision:** Dual-path auth — username+argon2id (primary) + Google OAuth (optional convenience).
>
> **Rationale:** Google OAuth alone requires a Google account per user, cannot be used without pre-registration on the OAuth consent screen (Testing Mode friction), and creates redirect-flow problems on future iOS/Android clients. Username+password with JWT is universal across all platforms. `ALLOWLIST_EMAILS` is deprecated; the household invitation system is the access gate. This auth system is designed to be final for the v2 product — no rework anticipated.

---

**Design principle:** Auth is designed once, correctly, for the long term. The system serves multiple households, many users, and future iOS/Android clients. Google OAuth alone requires a Google account per user and breaks on mobile (redirect flows require fragile deep-link configuration). Username+password with JWT is universal across web, iOS, and Android and is the permanent foundation for this product.

**Primary auth: username + argon2id**

Users register with a username (no email required) and a password hashed with argon2id via `passlib[argon2]`. No Google account is required. Argon2id is the OWASP-recommended algorithm: memory-hard, resistant to GPU and side-channel attacks.

```python
from passlib.context import CryptContext
pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")
password_hash = pwd_context.hash(plaintext_password)
pwd_context.verify(plaintext_password, stored_hash)  # returns bool
```

**Token model: JWT access + Postgres refresh tokens**

| Token type | Lifetime | Storage | Algorithm |
|---|---|---|---|
| Access token | 15 min | Client only (Authorization header) | HS256 JWT |
| Refresh token | 30 days | Postgres `refresh_tokens` table (hash only) | Opaque random bytes |

`refresh_tokens` table schema:
```sql
CREATE TABLE refresh_tokens (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash  TEXT NOT NULL UNIQUE,   -- SHA-256 of the raw token
    expires_at  TIMESTAMPTZ NOT NULL,
    revoked     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX ON refresh_tokens (user_id);
CREATE INDEX ON refresh_tokens (token_hash);
```

Token lifecycle:
- **Login** (`POST /auth/login`): generate 32 random bytes via `secrets.token_bytes(32)`, store SHA-256 hash in `refresh_tokens`, return raw bytes (base64url) to client alongside a JWT.
- **Refresh** (`POST /auth/refresh`): hash the presented token, look up the row, check `revoked = FALSE AND expires_at > NOW()`, issue new access JWT and rotate the refresh token (mark old row `revoked = TRUE`, insert new row with new token and a fresh 30-day `expires_at`).
- **Logout** (`POST /auth/logout`): set `revoked = TRUE` on the presented token's row.

**No Redis.** `Cloud Memorystore (Redis)` starts at ~$30/month — approximately 60% of the $50/month peak ceiling — for a use case Postgres handles trivially. A boolean `revoked` column on a table with <1000 rows is immediate and consistent.

**Google OAuth: optional parallel path**

`GET /auth/google` and `GET /auth/google/callback` are retained unchanged in external behaviour. On successful Google sign-in, the callback now issues the same JWT + refresh token pair rather than a session cookie. Users who prefer not to use a Google account use username+password. Both paths are first-class citizens.

**Password reset: admin-assisted only (v2.0 known limitation)**

No self-serve password reset. No SMTP dependency. Recovery:
- Admin calls `POST /auth/admin/reset-password` with `{ "username": "<target>", "new_password": "<temp>" }`.
- Server validates that the calling admin shares a household with the target user (prevents cross-household resets).
- Admin communicates the temporary password out-of-band.
- **Known limitation:** if the sole admin of a household forgets their password, they must reset via the database directly (`UPDATE users SET password_hash = ... WHERE username = ...` via Cloud SQL Studio). This is documented as an operator runbook action.
- Self-serve SMTP-based reset can be added in a future iteration if email collection is introduced.

**Session model: stateless JWT via FastAPI Depends**

```python
# app/deps.py — interface unchanged, implementation replaced
async def get_current_user(token: str = Depends(oauth2_scheme)) -> UserPayload:
    try:
        payload = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"])
        return UserPayload(user_id=payload["sub"], role=payload.get("role"))
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
```

All existing route handlers using `Depends(get_current_user)` continue to work without modification. Only the implementation of `get_current_user` changes.

**`ALLOWLIST_EMAILS` — deprecated**

Remove from all deployment configurations. The email allowlist has been replaced by the household invitation system. Any `ALLOWLIST_EMAILS` env var check in the codebase should be deleted.

**Mobile compatibility**

JWT-based auth is the correct foundation for future iOS and Android clients. Native apps store JWTs in Keychain (iOS) / Keystore (Android) and attach them as `Authorization: Bearer` headers — a universal, well-understood pattern with excellent library support. Google OAuth's redirect flow on mobile requires platform-specific deep link configuration (`intent://` on Android, custom URL schemes on iOS) that is notoriously fragile and SDK-version-sensitive. No auth changes are needed when mobile clients are added.

---

## 4. Hosting Decision — Cloud Run vs GKE

### 4.1 Comparison

| Dimension | Cloud Run | GKE Standard | GKE Autopilot |
|---|---|---|---|
| Monthly floor | ~$0 (scale-to-zero) | ~$72+ (1× e2-standard-2 node) | ~$15–25 (cluster management fee) |
| Scale-to-zero | ✅ | ❌ | ⚠️ (node scale-to-zero in theory, slow) |
| One-engineer operations | ✅ (one gcloud command to deploy) | ❌ (cluster upgrades, node pools, ingress controllers) | ⚠️ (better than Standard, still complex) |
| Mobile API support | ✅ (same REST API) | ✅ | ✅ |
| WebSocket / gRPC streaming | ✅ (Cloud Run supports HTTP/2) | ✅ | ✅ |
| Horizontal autoscaling | ✅ (automatic, per-request) | ✅ | ✅ |
| Custom GPU / sidecar containers | ❌ | ✅ | ⚠️ |
| $50/month ceiling | ✅ | ❌ (already over at minimum) | ⚠️ (borderline) |

### 4.2 Verdict: Cloud Run Stays

**Cloud Run is the right choice for current needs AND the mobile-app path.**

- The REST API served by Cloud Run is payload-agnostic. An iOS app, an Android app, and the React SPA all call the same `/api/*` endpoints with the same bearer token / session cookie. There is no hosting architecture change required when mobile apps are added.
- The mobile app transition is a **client decision**, not a server decision. Adding React Native or native Swift/Kotlin clients requires zero server-side hosting changes.
- Cloud Run's concurrency model (up to 1000 concurrent requests per instance, multiple instances in parallel) is sufficient for the foreseeable traffic envelope.

**GKE inflection point:** Migrate to GKE Autopilot if and when:
- The application requires always-on background workers (e.g., a scheduled job runner that must persist between invocations with shared state), AND
- Traffic is consistently high enough that Cloud Run's per-request pricing exceeds GKE Autopilot's flat cluster fee (~$15–25/month), AND
- The team grows to at least 2 engineers who can share the operational burden.

None of these conditions are met today or projected within the $50/month envelope.

---

## 5. Multi-tenancy Architecture

### 5.1 Isolation Strategy Verdict: Row-Level Isolation

Three strategies considered:

| Strategy | Isolation | Cost | Ops complexity | Cross-tenant admin queries | Verdict |
|---|---|---|---|---|---|
| **Row-level isolation** | `household_id` FK on every table, Postgres RLS policy | One DB | Low | ✅ Easy | **✅ CHOSEN** |
| Schema-per-tenant | `household_abc.brew_logs`, `household_abc.inventory` | One DB | Medium (migrations per schema) | ⚠️ Requires `SET search_path` | Deferred — overhead without benefit at this scale |
| Database-per-tenant | Separate Cloud SQL instance per household | $8+/household/month | High | ❌ Impossible without separate connections | **Rejected — $24+/month for 3 households alone** |

**Row-level isolation with Postgres RLS** is chosen because:
- One schema, one migration path (Alembic single head)
- All tenant data queries filter by `household_id` — enforced at the Postgres RLS layer, not just the app layer
- Admin cross-tenant queries (e.g., "show me all households for debugging") are trivial SQL with the admin role bypassing RLS
- Migration is a single database operation per row

### 5.2 Data Model — Household Tables

New tables in v2 (additions to the existing schema):

```sql
-- Users: one row per account; created on registration or first Google sign-in
CREATE TABLE users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username      TEXT UNIQUE,               -- Set for username+password accounts; NULL for Google-only accounts
    password_hash TEXT,                      -- argon2id hash; NULL for Google-only accounts
    google_sub    TEXT UNIQUE,               -- Google OAuth subject claim; NULL for username-only accounts
    email         TEXT,                      -- Optional; populated from Google OAuth if available
    display_name  TEXT NOT NULL,
    picture_url   TEXT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT users_has_identity CHECK (username IS NOT NULL OR google_sub IS NOT NULL)
);

-- Core tenancy
CREATE TABLE households (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        TEXT NOT NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_by  UUID NOT NULL REFERENCES users(id)
);

-- Membership + roles
CREATE TABLE household_members (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id    UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    user_id         UUID NOT NULL REFERENCES users(id),
    role            TEXT NOT NULL CHECK (role IN ('admin', 'member')),
    invited_by      UUID REFERENCES household_members(id),
    joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (household_id, user_id)
);

-- Guest tokens: admin-generated read-only household access links (see functional spec §1.1, §4.11.4)
CREATE TABLE guest_tokens (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    token               UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    created_by_user_id  UUID NOT NULL REFERENCES users(id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    revoked_at          TIMESTAMPTZ                           -- NULL while active; set on revocation
);
CREATE INDEX ON guest_tokens (household_id);
CREATE INDEX ON guest_tokens (token);
-- At most one active token per household: enforced at the application layer (new token revokes old one)

-- Pending invitations (consumed on acceptance)
CREATE TABLE pending_invitations (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    household_id        UUID NOT NULL REFERENCES households(id) ON DELETE CASCADE,
    invited_email       TEXT,                -- NULL for link-only invites (see functional spec §4.12)
    token               UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    invited_by_user_id  UUID NOT NULL REFERENCES users(id),
    invited_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at          TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '72 hours'),
    accepted_at         TIMESTAMPTZ
);
```

Existing tables gain a `household_id` column. **Catalog is household-scoped** per the functional spec — each household maintains its own independent bean library:

```sql
ALTER TABLE catalog          ADD COLUMN household_id UUID NOT NULL REFERENCES households(id);
ALTER TABLE brew_log         ADD COLUMN household_id UUID NOT NULL REFERENCES households(id);
ALTER TABLE inventory_bags   ADD COLUMN household_id UUID NOT NULL REFERENCES households(id);
ALTER TABLE hardware         ADD COLUMN household_id UUID NOT NULL REFERENCES households(id);
ALTER TABLE maintenance_log  ADD COLUMN household_id UUID NOT NULL REFERENCES households(id);
```

> **TPM note (2026-05-06):** Catalog is household-scoped. The functional spec explicitly defines each household's bean library as independent. A global shared catalog was considered but rejected: it couples household data isolation, requires a trust model for catalog writes across households, and adds cross-tenant query complexity for no user-visible benefit at this scale. Two households with the same bean will have two independent catalog rows.

Alembic migrations:
- `0001_initial_schema.py` — creates `users`, `households`, `household_members`, `pending_invitations`, `refresh_tokens`, `guest_tokens`
- `0002_add_household_id_columns.py` — adds `household_id` to all tenant-scoped tables including `catalog`

### 5.3 Postgres RLS Policies

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE brew_log         ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_bags   ENABLE ROW LEVEL SECURITY;
ALTER TABLE hardware         ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_log  ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see rows belonging to their household(s)
CREATE POLICY household_isolation ON brew_log
    USING (household_id = current_setting('app.current_household_id')::uuid);
-- (Repeat for each tenant-scoped table)

-- Admin role bypasses RLS for cross-tenant queries
CREATE ROLE app_user;
CREATE ROLE app_admin BYPASSRLS;
GRANT app_user TO <application_runtime_role>;
```

At the app layer, every request handler sets the `app.current_household_id` session variable after authentication resolves the user's household membership.

### 5.4 Tenant Scoping in Repositories

```python
# app/repos/base.py (protocol)
class TenantScopedRepo(Protocol):
    async def set_household(self, household_id: uuid.UUID) -> None: ...

# app/deps.py
async def current_household(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> Household:
    membership = await db.scalar(
        select(HouseholdMember)
        .where(HouseholdMember.user_google_sub == user.sub)
    )
    if membership is None:
        raise HTTPException(403, "Not a member of any household")
    await db.execute(
        text("SET LOCAL app.current_household_id = :hid"),
        {"hid": str(membership.household_id)},
    )
    return membership.household
```

---

## 6. Roles and Permissions

### 6.1 Role Definitions

| Role | Who holds it | Capabilities |
|---|---|---|
| `admin` | First member of a household (creator); can grant to others | Invite/remove members, view all household logs, edit/delete any log in the household, manage hardware and inventory |
| `member` | Anyone added by an admin | View all household logs, add their own brew logs, add/edit hardware and inventory |
| *(system admin)* | Service account / krishna | Bypasses household isolation for operational tasks; never exposed via API |

### 6.2 Enforcement Pattern: FastAPI Dependency Injection

**Verdict: dependency injection (not middleware, not decorators).**

Rationale:
- Middleware runs before route resolution and lacks knowledge of which household a request targets or which role is required for which operation.
- Decorators are valid but reduce IDE discoverability; FastAPI's `Depends()` pattern is already used for `current_user` and is idiomatic.
- Dependencies chain naturally: `require_admin` depends on `current_household_membership`, which depends on `current_user`.

**Implementation:**

```python
# app/deps.py

async def current_household_membership(
    user: User = Depends(current_user),
    db: AsyncSession = Depends(get_db),
) -> HouseholdMember:
    membership = await db.scalar(
        select(HouseholdMember)
        .where(HouseholdMember.user_google_sub == user.sub)
    )
    if membership is None:
        raise HTTPException(status_code=403, detail="Not a member of any household")
    await db.execute(
        text("SET LOCAL app.current_household_id = :hid"),
        {"hid": str(membership.household_id)},
    )
    return membership

async def require_admin(
    membership: HouseholdMember = Depends(current_household_membership),
) -> HouseholdMember:
    if membership.role != "admin":
        raise HTTPException(status_code=403, detail="Admin role required")
    return membership
```

**Usage in routes:**

```python
# app/routers/api_households.py

@router.post("/households/invite")
async def invite_member(
    body: InviteBody,
    _: HouseholdMember = Depends(require_admin),  # enforces admin role
    db: AsyncSession = Depends(get_db),
) -> InvitationOut:
    ...

@router.get("/api/brew-log")
async def list_brew_log(
    membership: HouseholdMember = Depends(current_household_membership),  # any member
    db: AsyncSession = Depends(get_db),
) -> list[BrewLogEntryOut]:
    ...
```

### 6.3 Permission Matrix

| Endpoint | `member` | `admin` |
|---|---|---|
| `GET /api/brew-log` | ✅ (own household) | ✅ (own household) |
| `POST /api/brew-log` | ✅ | ✅ |
| `DELETE /api/brew-log/{id}` | ❌ | ✅ |
| `GET /api/inventory` | ✅ | ✅ |
| `POST /api/inventory` | ✅ | ✅ |
| `DELETE /api/inventory/{id}` | ❌ | ✅ |
| `GET /api/hardware` | ✅ | ✅ |
| `POST /api/hardware` | ✅ | ✅ |
| `DELETE /api/hardware/{id}` | ❌ | ✅ |
| `GET /api/catalog` | ✅ | ✅ |
| `POST /api/catalog` | ✅ | ✅ |
| `POST /households/invite` | ❌ | ✅ |
| `DELETE /households/members/{id}` | ❌ | ✅ |
| `GET /households/me` | ✅ | ✅ |

---

## 7. Migration Plan — Google Sheets → Cloud SQL

The repository abstraction (`SheetsClientProtocol`, `CatalogRepo`, `BrewLogRepo`, etc.) is the migration boundary. The plan migrates at that layer with no changes to routers, services, or the React frontend.

### 7.1 Phase Overview

| Phase | Name | What happens | Rollback |
|---|---|---|---|
| **M1** | Schema & infra | Provision Cloud SQL, run Alembic migrations, add `DATABASE_URL` secret | Drop Cloud SQL (no data yet) |
| **M2** | Dual-write shadow | App writes to both Sheets and Postgres; reads from Sheets | Remove DB writes from deps.py |
| **M3** | Backfill + validation | Run `scripts/migrate_sheets_to_postgres.py`; compare row counts and checksums | Keep Sheets as authoritative until validated |
| **M4** | Read switchover | App reads from Postgres; writes to both | Set `USE_POSTGRES=false` in the APP_SECRETS blob |
| **M5** | Household, Roles & Sheets write-disable | Disable Sheets write path; implement household/roles; Sheets becomes read-only archive | Re-enable Sheets writes (two-line change in deps.py); remove household/roles behind feature flag |
| **M6** | Sheets decommission | Remove gspread dependency; archive workbook; update Terraform | Workbook preserved in Drive indefinitely |

> **Phase ordering note (TPM):** M5 bundles Sheets write-disable with household/roles in a single phase because both are safe to roll back at the same point (Sheets is still an intact archive). Decoupling them into M5a/M5b would add a deployment cycle with no user-visible value. The M5 rollback window is: set `USE_POSTGRES=false` in the APP_SECRETS blob OR re-enable gspread writes in `deps.py` — one PR, one deploy, no data loss.

### 7.2 Migration Script Approach

```python
# scripts/migrate_sheets_to_postgres.py
# Phase M3: one-time backfill from Sheets → Postgres

async def migrate():
    sheets_client = SheetsClient.from_env()
    db = await create_async_engine(os.environ["DATABASE_URL"])

    # Establish household for the single existing user set
    household_id = await ensure_household(db, name="default")

    for entity, repo_cls, model_cls in MIGRATION_MANIFEST:
        rows = await SheetRepo(sheets_client, entity).list_all()
        pg_rows = [model_cls.from_sheets_dict(row, household_id) for row in rows]
        await bulk_upsert(db, pg_rows)
        print(f"Migrated {len(pg_rows)} {entity} rows")

    await validate_counts(sheets_client, db)
```

`MIGRATION_MANIFEST` maps each entity (`Catalog`, `Inventory`, `Hardware`, `Maintenance`, `Brew_Log`) to its Pydantic model and its `from_sheets_dict` constructor.

### 7.3 Rollback Plan

- **M1–M3:** Sheets is still the source of truth. Rollback is removing the Postgres connection from `deps.py`. Zero data loss.
- **M4:** Set `USE_POSTGRES=false` in the APP_SECRETS blob (30-second deploy, no code change). Postgres data is preserved; Sheets is still current because M4 kept dual-write active.
- **M5:** Re-enable the `gspread` write path in `deps.py` (two-line change, one PR, one deploy). The household/roles routes can be left in place or gated behind a feature flag — they are additive and non-destructive.
- **M6:** No rollback needed — workbook is preserved in Drive; migration is irreversible only in the sense that re-enabling gspread would require re-plumbing the dependency.

---

## 8. API Contract Changes

### 8.1 New Endpoints (v2 additions)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/households/me` | Any member | Returns current user's household and role |
| `POST` | `/households` | Authenticated, no household required | Creates a household; caller becomes `admin` |
| `POST` | `/households/invite` | `admin` | Sends an invitation (creates a `pending_invitations` record) |
| `POST` | `/households/join/{token}` | Any authenticated user | Accepts an invitation token; adds user as `member` |
| `DELETE` | `/households/members/{member_id}` | `admin` | Removes a member from the household |
| `GET` | `/households/members` | `admin` | Lists all members of the household |

### 8.2 Modified Endpoints (v2 changes)

| Endpoint | Change |
|---|---|
| `GET /api/brew-log` | Responses are household-scoped; no API signature change |
| `GET /api/inventory` | Responses are household-scoped; no API signature change |
| `GET /api/hardware` | Responses are household-scoped; no API signature change |
| `DELETE /api/*/{id}` | Now requires `admin` role; previously had no role check |
| `POST /api/catalog` | Open to all members (both `admin` and `member`); catalog management is not admin-restricted |
| `GET /auth/me` | Response gains `household_id`, `role` fields |

### 8.3 Unchanged Endpoints

All `GET /api/brew-log`, `POST /api/brew-log`, `GET /api/catalog`, `GET /api/inventory`, `POST /api/inventory`, `GET /api/hardware`, `POST /api/hardware`, `POST /api/maintenance`, `GET /auth/login`, `GET /auth/callback`, `GET /auth/logout` — request/response shapes unchanged; only the underlying data source changes from Sheets to Postgres.

### 8.4 Auth Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/auth/register` | None | Create username+password account. Body: `{username, password}`. Returns JWT + refresh token. |
| `POST` | `/auth/login` | None | Authenticate. Body: `{username, password}`. Returns JWT + refresh token. |
| `POST` | `/auth/refresh` | None | Exchange refresh token for new access JWT. Body: `{refresh_token}`. |
| `POST` | `/auth/logout` | Bearer JWT | Revoke refresh token. Body: `{refresh_token}`. |
| `GET` | `/auth/google` | None | Initiate Google OAuth (optional path). |
| `GET` | `/auth/google/callback` | None | Google OAuth callback; issues JWT + refresh token pair. |
| `POST` | `/auth/admin/reset-password` | Bearer JWT (admin role) | Admin resets a household member's password. Validates shared household membership. |
| `GET` | `/households/{id}/guest-token` | Bearer JWT (admin role) | Issue or retrieve the household's read-only guest token. |
| `PATCH` | `/households/members/{id}` | Bearer JWT (admin role) | Promote member → admin or demote admin → member. Rejects if target is last admin. |

---

## 9. Repository Structure (updated)

```
app/
  main.py                # FastAPI app, middleware, routers wired (unchanged)
  config.py              # +DATABASE_URL, +USE_POSTGRES flag
  auth.py                # +household resolution on session (unchanged interface)
  deps.py                # +get_db, +current_household_membership, +require_admin
  repos/
    base.py              # Protocol unchanged; +TenantScopedRepo mixin
    sheets_client.py     # Retained through Phase M5; removed at M6
    catalog.py           # SqlCatalogRepo implementing CatalogRepo protocol
    inventory.py         # SqlInventoryRepo
    hardware.py          # SqlHardwareRepo
    maintenance.py       # SqlMaintenanceRepo
    brew_log.py          # SqlBrewLogRepo
    households.py        # NEW: HouseholdRepo, HouseholdMemberRepo
  models/                # NEW: SQLAlchemy ORM models
    base.py              # DeclarativeBase
    user.py              # User (upserted on login)
    household.py         # Household, HouseholdMember, PendingInvitation
    brew_log.py          # BrewLog (maps to existing Pydantic schema)
    inventory.py         # InventoryBag
    catalog.py           # CatalogBean (now household-scoped)
    hardware.py          # Hardware
    maintenance.py       # MaintenanceLog
  services/
    ids.py               # unchanged (Postgres uses UUID PK; ids.py used for brew log display IDs)
    defaults.py          # unchanged
    importer.py          # CSV → Postgres (replaces CSV → Sheets path)
    inference.py         # unchanged
  routers/
    api_brew_log.py      # unchanged (deps handle tenant scoping)
    api_catalog.py       # open to all members (no admin gate on POST)
    api_hardware.py      # +require_admin on DELETE
    api_households.py    # NEW: /households/* routes
    health.py            # unchanged
    defaults.py          # unchanged
  alembic/               # NEW: schema migrations
    env.py
    versions/
      0001_initial_schema.py
      0002_add_household_id_columns.py
scripts/
  migrate_sheets_to_postgres.py    # NEW: Phase M3 backfill script
  validate_migration.py            # NEW: count/checksum comparison
  backup_postgres.py               # NEW: pg_dump → GCS (replaces backup_sheet.py)
infra/
  terraform/
    main.tf              # +Cloud SQL instance
    sql.tf               # NEW: Cloud SQL resource definitions
    secrets.tf           # +DATABASE_URL secret
    iam.tf               # +Cloud SQL Client role for runtime SA
```

---

## 10. Phased Implementation (v2)

The v1 phases (1–17) are complete or in-flight and are not repeated here. The v2 phases pick up from the current state of the app.

### Phase M1 — Cloud SQL Provisioning

1. Add `google_sql_database_instance`, `google_sql_database`, `google_sql_user` to `infra/terraform/sql.tf`.
2. Grant `Cloud SQL Client` role to the runtime SA in `iam.tf`.
3. Add `DATABASE_URL` secret to Secret Manager; populate value out-of-band.
4. Mount `DATABASE_URL` as env var in `run.tf`.
5. Add `asyncpg`, `sqlalchemy[asyncio]`, `alembic` to `pyproject.toml`; run `uv sync`; update `requirements.txt`.
6. Create `app/models/` and `alembic/`; run initial migration to create tables.
7. Acceptance: `gcloud sql connect` returns a healthy psql shell; Alembic migration succeeds with zero errors.

### Phase M2 — Dual-Write Shadow

1. Implement `SqlBrewLogRepo`, `SqlInventoryRepo`, etc. behind the existing repo protocols.
2. In `deps.py`, wrap both repos: write to Postgres *and* Sheets; read from Sheets.
3. Deploy. All existing functionality is unchanged from the user's perspective.
4. Acceptance: Postgres tables gain rows on every write; Sheets rows are created simultaneously; count delta stays at zero over 24 hours.

### Phase M3 — Backfill and Validation

1. Run `scripts/migrate_sheets_to_postgres.py` against the live spreadsheet.
2. Run `scripts/validate_migration.py` to compare row counts and a sample of checksums.
3. Fix any mapping issues. Declare migration complete when counts match and spot-checks pass.
4. Acceptance: `validate_migration.py` reports 100% row count match and zero checksum errors.

### Phase M4 — Read Switchover

1. Update `deps.py` to read from Postgres, write to both.
2. Add `USE_POSTGRES` key (default `true`) to the APP_SECRETS Secret Manager blob; setting it to `false` reverts to Sheets reads within a 30-second redeploy.
3. Deploy; monitor for 48 hours.
4. Acceptance: All API responses served from Postgres; zero 500 errors attributable to the DB.

### Phase M5 — Household, Roles & Sheets Write-Disable

1. **First:** Disable the Sheets write path in `deps.py` (one-line change: remove the Sheets repo from the dual-write wrapper). Sheets becomes a read-only archive. Rollback: re-enable in one PR.
2. Implement `app/repos/households.py`, `app/models/user.py`, and `app/routers/api_households.py`.
3. Implement `current_household_membership` and `require_admin` in `deps.py`.
4. Add `household_id` foreign key to all tenant-scoped tables including `catalog` (Alembic migration `0002_add_household_id_columns.py`).
5. Add `users` table (Alembic migration `0001_initial_schema.py` covers this; upsert on login in `auth.py`).
6. For the existing single-user installation: seed a default household; assign the current user as `admin`.
7. Deploy; smoke-test invite flow.
8. Acceptance: Admin can invite a second user; invited user can log brews; invited user cannot delete hardware; `ruff check app/` passes.

> **Frontend note:** Phase M5 backend APIs (household creation, invitation, roles) are a prerequisite for the React household UX — onboarding wizard, household switcher, member management pages. Frontend household features should be built as part of the M5 deliverable or as a dedicated UI phase that begins only after M5 APIs are deployed.

### Phase M6 — Sheets Decommission

1. Remove gspread dependency and all `SheetsCatalogRepo`, `SheetsBrewLogRepo` etc. classes.
2. Remove `SPREADSHEET_ID` secret reference from `run.tf`.
3. Archive the Google Workbook in Drive (do not delete — longevity guarantee).
4. Update `requirements.txt` via `uv sync`.
5. Acceptance: `ruff check app/` passes; `pytest` passes; no gspread import anywhere in `app/`.

---

## 11. Cost Model

### 11.1 Three-Tier Breakdown

| Resource | Baseline | Mid | Peak |
|---|---|---|---|
| *Traffic* | 1 household, 3 users, 25 req/day | 3 households, 10 users, 150 req/day | 10 households, 30 users, 1,000 req/day |
| **Cloud Run** | $0 (well within 2M req/month free tier) | $0 | ~$1–2 (vCPU + memory + 15M req/month) |
| **Cloud SQL (db-f1-micro)** | ~$7.67/month | ~$7.67/month | ~$7.67/month at db-f1-micro; upgrade to db-g1-small (~$25/month) only if concurrent connection count exceeds 25. Includes `refresh_tokens` table (30-day rolling window, auto-expiry). Storage overhead negligible — <1000 rows at target scale. No additional infrastructure cost. |
| **Cloud SQL storage** | ~$1.70 (10 GB SSD) | ~$1.70 | ~$3.40 (20 GB) |
| **Cloud Build** | $0 (120 free build-min/day) | $0 | $0 |
| **GCS (tfstate, backups)** | ~$0.05 | ~$0.10 | ~$0.30 |
| **Secret Manager** | ~$0.06 (6 active secrets + 300 accesses) | ~$0.08 | ~$0.15 |
| **LLM (Gemini Flash)** | ~$0.05 (25 inference calls) | ~$0.25 | ~$1.50 |
| **Cloud Scheduler** | $0 (free tier) | $0 | $0 |
| **Cloud Build triggers** | $0 | $0 | $0 |
| **Networking (egress)** | ~$0 | ~$0.10 | ~$0.50 |
| **TOTAL** | **~$9.50/month** | **~$10.00/month** | **~$14–35/month** |

### 11.2 Hard Ceiling Check

**At peak (10 households, 30 users, 1,000 req/day), the estimated bill is ~$14–35/month — well under the $50 hard ceiling.**

Two peak scenarios, both safe:

| Scenario | Cloud SQL | Peak Total | Headroom to $50 |
|---|---|---|---|
| db-f1-micro retained | ~$7.67/month | ~$14/month | ~$36/month |
| db-g1-small upgrade | ~$25/month | ~$35/month | ~$15/month |

The db-g1-small upgrade is only needed if more than ~2 Cloud Run instances spin up concurrently (each instance holds a 10-connection pool; db-f1-micro allows ~25 total). At 1,000 req/day (~0.7 req/min average), Cloud Run will rarely exceed 1 instance. The upgrade threshold is practical concurrency, not request volume.

**Safety margin at peak: $15–36/month headroom before hitting $50.**

### 11.3 Scenarios that Would Breach $50

- Upgrading Cloud SQL to `db-n1-standard-1` (~$49/month alone) — unnecessary at this scale.
- Enabling Cloud Load Balancing for IAP (~$18/month floor) — explicitly rejected in §3.
- Running LLM inference on >5,000 shots/day (~$15+/month) — requires ~167 households at this scale.
- Sustained Cloud Run traffic at >50M req/month — requires ~50,000 req/day, not plausible for a personal household app.

---

## 12. One-Engineer Operability

Every operational task must be achievable by one engineer without specialised DevOps knowledge.

| Task | How | Time |
|---|---|---|
| **Deploy** | `git push origin main` → Cloud Build triggers auto-deploy | ~3 min |
| **Rollback** | `gcloud run services update-traffic --to-revisions=PREV=100` | <1 min |
| **DB migration** | `uv run alembic upgrade head` from local (connects via Cloud SQL Auth Proxy). Run manually before deploying schema-changing code. No automated migration-on-deploy; deliberate to keep rollback simple. | ~2 min |
| **DB rollback** | `uv run alembic downgrade -1` | ~2 min |
| **Rotate secrets** | `gcloud secrets versions add SECRET_NAME --data-file=<(echo "new_value")` then `gcloud run services update coffee-tracker --update-secrets=ENV_VAR=SECRET_NAME:latest` to pick up the new version. Cloud Run does NOT auto-reload secrets without a redeploy. | ~2 min |
| **Debug production** | `gcloud run services logs read coffee-tracker --limit=100` or Cloud Logging UI | Immediate |
| **Know if broken at 2am** | Cloud Monitoring: enable Uptime Check on the `/health` endpoint (free tier covers 3 checks/region). Optionally configure an Alerting Policy to notify via email on uptime check failure or on Cloud Run 5xx error rate >5% over 5 min. Setup: Cloud Monitoring → Uptime checks → create HTTP check → alert channel = email. | ~10 min setup |
| **Hand-edit data** | Cloud SQL Studio (browser query editor) or `gcloud sql connect` for psql shell | Immediate |
| **Backup data** | `scripts/backup_postgres.py` runs nightly via Cloud Scheduler; restores via `pg_restore -Fc backup.dump`. To restore: (1) pause Cloud Run traffic, (2) `dropdb; createdb`, (3) `pg_restore -Fc -d DB_URL backup.dump`, (4) resume traffic. Full restore takes ~5 min. | ~5 min |
| **Terraform infra change** | Edit `.tf` files → `terraform plan` → `terraform apply` | ~5 min |
| **Add new household** | POST `/households` from admin UI or curl script | <1 min |
| **Invite a user** | POST `/households/invite` from household admin UI | <1 min |

**Verdict: one-engineer operable.** The most complex operation (DB migration) requires running one Alembic command. Rollback is a Cloud Run traffic split command. Secret rotation requires a two-step gcloud command (add version + trigger redeploy). No DBA, no on-call rotation, no specialised tooling.

> **Monitoring minimum (TPM requirement):** At minimum, configure a Cloud Monitoring Uptime Check on `/health` with email alerting. This is the "2am broken" detector. Cost: $0 on free tier. Without this, the operator only discovers outages when a user reports them.

---

## 13. Decisions Captured

| Decision | Verdict | Rationale | Conditions for revisiting |
|---|---|---|---|
| **Database** | Cloud SQL for PostgreSQL (db-f1-micro) | Real SQL, RLS, $8/month floor, repository pattern maps cleanly | Move to db-g1-small if connection count exceeds db-f1-micro limits at peak |
| **Auth** | Username+argon2id (primary) + Google OAuth (optional) | Google OAuth alone requires a Google account per user, creates redirect-flow problems on future iOS/Android clients, and requires pre-registration in Testing Mode. Username+password with JWT is universal across web, iOS, and Android. `ALLOWLIST_EMAILS` deprecated; household invitation system is the access gate. | No rework anticipated — designed to be final for the v2 product |
| **IAP** | Rejected | HTTPS LB adds $18/month floor; IAP doesn't support household roles; app-layer auth is sufficient | Corporate SSO/2FA compliance requirement for a team of >5 engineers |
| **Cloud Run vs GKE** | Cloud Run stays | Scale-to-zero, $0 at idle, $50 ceiling never threatened; mobile apps call the same API | Migrate to GKE Autopilot if: always-on background workers required + traffic consistently >$20/month on Cloud Run |
| **Multi-tenancy isolation** | Row-level isolation with Postgres RLS | Simplest, single schema, single migration path, cross-tenant admin easy | Schema-per-tenant if household count exceeds 50 and row counts make RLS policy performance measurable |
| **Roles enforcement** | FastAPI dependency injection (`require_admin`) | Idiomatic to existing codebase; chains with `current_user`; not middleware (lacks route context) | No change anticipated |
| **Sheets decommission** | Phased (M1–M6); archive in Drive, never delete | Longevity guarantee; workbook is the historical audit trail | Drive workbook remains readable indefinitely |
| **Migration strategy** | Repository swap at the protocol layer | Existing `CatalogRepo`/`BrewLogRepo` protocols are the seam; routers untouched | No alternative needed |
| **Connection pooling** | SQLAlchemy async connection pool (default size: 5 + 5 overflow) | db-f1-micro has ~25 max connections; pool of 10 per Cloud Run instance stays safe with expected <3 instances | Switch to PgBouncer or Cloud SQL connection pooling if Cloud Run scales to >2 instances concurrently |
| **ORM choice** | SQLAlchemy 2.x async (asyncpg driver) | Async-native, Alembic integration, Python ecosystem standard; repository layer hides ORM from routers | No change anticipated |
| **Invite model** | Token-based invitation; email delivery optional | Admin generates a token via POST `/households/invite`; backend attempts SMTP delivery if `SMTP_HOST` is set; if unset, token is logged server-side and admin can share the `/invite/accept?token={token}` link out-of-band. See NFR-D7 in functional spec. | Add SendGrid/SMTP env vars when email delivery is prioritised |
| **Catalog tenancy** | Household-scoped (each household has its own catalog) | Functional spec §1.2 defines catalog as household-scoped. A shared global catalog would couple household data isolation and require a cross-household trust model for writes — unnecessary complexity at this scale. Two households with the same bean have two independent catalog rows. | No change anticipated |
| **Users table** | Separate `users` table; `household_members.user_id` FKs to it | Functional spec §1.1 defines `User` as a first-class entity with `display_name`, `picture_url`, `last_seen_at`. Storing user info only in `household_members` would require duplicating display data across memberships. Upsert on every login keeps `last_seen_at` and profile data current. | No change anticipated |
| **Always-on instances** | Remain at min-instances=0 | Cost model shows ~$0 at idle; cold start <2s is acceptable; Cloud Scheduler heartbeat mitigates perceived latency | Add min-instances=1 only if cold start complaints emerge from real users |

---

*Authored by Maya (Principal Engineer) — 2026-05-06. Amended by Tariq (TPM) — 2026-05-06: role naming aligned to functional spec (`manager`→`admin`), catalog made household-scoped, `users` table added, Phase M5 phase name and rollback corrected, cost model peak clarity improved, operability table expanded with monitoring/secret-rotation guidance. Amended by Maya (Principal Engineer) — 2026-05-06: auth fully in scope for v2.0 (greenfield, no migration burden); username+argon2id added as primary auth path; Google OAuth retained as optional convenience; JWT access tokens (15 min) + Postgres `refresh_tokens` table (30 days) replacing any session-cookie model; `ALLOWLIST_EMAILS` deprecated; guest-token and co-owner promotion endpoints added; `users` table migrated to UUID PK to support dual-path identities; No Redis. Next review: Phase M5 completion.*
