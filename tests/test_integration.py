"""Integration tests — Wave 5 US-5.2.

Tests run against a real Postgres database via ``TEST_DATABASE_URL`` env var.
All tests are skipped when ``TEST_DATABASE_URL`` is not set.

RLS note (AC-097):
  The ``espresso`` user is the table owner and bypasses RLS by default
  because ``FORCE ROW LEVEL SECURITY`` is not enabled at the table level.
  ``test_brew_log_scoped_to_household`` temporarily enables
  ``FORCE ROW LEVEL SECURITY`` on ``brew_log`` for the duration of that test
  and disables it in a ``finally`` block, so isolation is proven end-to-end.

Run command::

    TEST_DATABASE_URL=postgresql+asyncpg://espresso:espresso@localhost:5432/espresso_logs \\
      USE_POSTGRES=true SPREADSHEET_ID=dummy \\
      JWT_SECRET=abcdefghijklmnopqrstuvwxyz123456 \\
      uv run pytest tests/test_integration.py -v
"""

from __future__ import annotations

import os
import uuid
from collections.abc import AsyncGenerator

import pytest
import sqlalchemy as sa
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.main import app
from app.services.auth import create_access_token

pytestmark = pytest.mark.skipif(
    not os.getenv("TEST_DATABASE_URL"),
    reason="Integration tests require TEST_DATABASE_URL",
)

_TEST_DB_URL: str = os.getenv("TEST_DATABASE_URL", "")


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture
async def pg_engine() -> AsyncGenerator[AsyncEngine, None]:
    """Direct Postgres engine for test data setup/teardown (bypasses app layer)."""
    engine = create_async_engine(_TEST_DB_URL, echo=False)
    yield engine
    await engine.dispose()


@pytest.fixture
async def integration_client(pg_engine: AsyncEngine) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client with real Postgres and real JWT auth (no mock overrides).

    Removes autouse auth dep mocks so the full JWT → DB auth chain runs.
    Overrides get_db to use the test Postgres engine.
    Stubs get_sheets_client so no GCP Sheets API calls are made
    (SQL path handles all data access when USE_POSTGRES=True).
    """
    from app.config import settings
    from app.deps import (
        current_household_membership,
        current_user,
        get_db,
        get_sheets_client,
        require_admin,
        resolve_guest_or_member,
    )
    from app.testing.fake_sheets import FakeSheetsClient

    factory = async_sessionmaker(pg_engine, expire_on_commit=False)

    async def _real_get_db() -> AsyncGenerator[AsyncSession, None]:
        async with factory() as session:
            yield session

    # Remove autouse mock overrides so real JWT validation runs.
    # FastAPI will call the real dep functions, which will use the real_get_db override.
    _auth_deps = [
        current_user,
        current_household_membership,
        require_admin,
        resolve_guest_or_member,
    ]
    _saved = {dep: app.dependency_overrides.pop(dep, None) for dep in _auth_deps}

    app.dependency_overrides[get_db] = _real_get_db
    app.dependency_overrides[get_sheets_client] = lambda: FakeSheetsClient(
        {"Hardware": [], "Inventory": [], "Brew_Log": [], "Catalog": [], "Maintenance": []}
    )

    _orig_use_postgres = settings.use_postgres
    settings.use_postgres = True

    # Reset rate limiter so register/login calls don't hit per-minute limits
    from app.rate_limit import limiter

    limiter._storage.reset()

    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        yield client

    settings.use_postgres = _orig_use_postgres
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_sheets_client, None)
    for dep, saved in _saved.items():
        if saved is not None:
            app.dependency_overrides[dep] = saved


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _uname() -> str:
    """Short unique username within the 3–32 char constraint."""
    return f"u{uuid.uuid4().hex[:14]}"


def _extract_rt(response: AsyncClient) -> str:  # type: ignore[override]
    """Not used — kept for documentation only; callers use response.cookies directly."""
    return ""


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_register_login_refresh_logout_full_cycle(
    integration_client: AsyncClient,
) -> None:
    """Full auth lifecycle: register → me → refresh → logout → revoked replay → 401."""
    from app.rate_limit import limiter

    limiter._storage.reset()

    client = integration_client
    uname = _uname()
    password = "Integration1234!"

    # 1. Register → 201 + access token + rt cookie
    r = await client.post(
        "/auth/register",
        json={"username": uname, "password": password},
    )
    assert r.status_code == 201, r.text
    data = r.json()
    assert "access_token" in data
    access_token: str = data["access_token"]
    rt_val: str = r.cookies.get("rt", "")
    assert rt_val, "rt cookie missing after register"

    # 2. GET /auth/me with JWT → 200 + user data
    r = await client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert r.status_code == 200, r.text
    me = r.json()
    assert me["username"] == uname
    assert me["household_id"] is not None  # auto-seeded on register

    # 3. POST /auth/refresh → 200 + access token + rotated rt cookie
    r = await client.post("/auth/refresh", cookies={"rt": rt_val})
    assert r.status_code == 200, r.text
    assert "access_token" in r.json(), "refresh must return an access_token"
    new_rt: str = r.cookies.get("rt", "")
    assert new_rt, "rt cookie missing after refresh"
    assert new_rt != rt_val, "rt cookie should be rotated on refresh"

    # 4. POST /auth/logout → 200 + rt cookie cleared (Max-Age=0)
    r = await client.post("/auth/logout", cookies={"rt": new_rt})
    assert r.status_code == 200, r.text

    # 5. POST /auth/refresh with revoked rt → 401 (token was revoked on logout)
    r = await client.post("/auth/refresh", cookies={"rt": new_rt})
    assert r.status_code == 401, r.text


async def test_brew_log_scoped_to_household(
    integration_client: AsyncClient,
    pg_engine: AsyncEngine,
) -> None:
    """AC-097: brew log reads must never return data from another household (RLS).

    FORCE ROW LEVEL SECURITY is enabled on brew_log for this test so that
    the household_isolation RLS policy applies to the espresso table owner too.
    The policy is always active for non-owner roles in production (Cloud SQL).
    """
    from app.rate_limit import limiter

    limiter._storage.reset()

    client = integration_client

    # Register user A → auto-creates household A
    ua = _uname()
    r = await client.post("/auth/register", json={"username": ua, "password": "HhouseA12345!"})
    assert r.status_code == 201, r.text
    token_a: str = r.json()["access_token"]

    limiter._storage.reset()

    # Register user B → auto-creates household B
    ub = _uname()
    r = await client.post("/auth/register", json={"username": ub, "password": "HhouseB12345!"})
    assert r.status_code == 201, r.text
    token_b: str = r.json()["access_token"]

    # Resolve household A's UUID
    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 200
    household_a_id: str = r.json()["household_id"]
    assert household_a_id is not None

    shot_a_id = f"RLS-A-{uuid.uuid4().hex[:8]}"

    # Enable FORCE ROW LEVEL SECURITY so RLS applies to the espresso table owner
    async with pg_engine.connect() as conn:
        await conn.execute(sa.text("ALTER TABLE brew_log FORCE ROW LEVEL SECURITY"))
        await conn.commit()

    try:
        # Insert user A's brew log entry with explicit household_id.
        # SET LOCAL + INSERT must share a transaction so the USING check passes.
        async with pg_engine.begin() as conn:
            await conn.execute(
                sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
                {"hid": household_a_id},
            )
            await conn.execute(
                sa.text("INSERT INTO brew_log (sheets_id, household_id) VALUES (:sid, :hid)"),
                {"sid": shot_a_id, "hid": household_a_id},
            )

        # User B fetches brew log — must NOT see user A's entry (RLS filters by household_B)
        r = await client.get(
            "/api/brew-log",
            headers={"Authorization": f"Bearer {token_b}"},
        )
        assert r.status_code == 200, r.text
        shot_ids_b = [item["shot_id"] for item in r.json()["items"]]
        assert shot_a_id not in shot_ids_b, (
            f"AC-097 violated: user B's brew log contains user A's entry {shot_a_id!r}"
        )

        # User A can still see their own entry (SET LOCAL in request sets household_A)
        r = await client.get(
            "/api/brew-log",
            headers={"Authorization": f"Bearer {token_a}"},
        )
        assert r.status_code == 200, r.text
        shot_ids_a = [item["shot_id"] for item in r.json()["items"]]
        assert shot_a_id in shot_ids_a, f"User A should see their own entry {shot_a_id!r}"

    finally:
        async with pg_engine.connect() as conn:
            await conn.execute(sa.text("ALTER TABLE brew_log NO FORCE ROW LEVEL SECURITY"))
            await conn.commit()


async def test_delete_brew_log_requires_admin(
    integration_client: AsyncClient,
    pg_engine: AsyncEngine,
) -> None:
    """DELETE /api/brew-log/{shot_id} returns 403 for members and 204 for admins."""
    from app.rate_limit import limiter

    limiter._storage.reset()

    client = integration_client

    # Register user A → admin of household A (auto-seeded on register)
    ua = _uname()
    r = await client.post("/auth/register", json={"username": ua, "password": "AdminDel12345!"})
    assert r.status_code == 201, r.text
    token_a: str = r.json()["access_token"]

    # Resolve household A's UUID and user A's UUID
    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 200
    household_a_id = uuid.UUID(r.json()["household_id"])
    user_a_id = uuid.UUID(r.json()["id"])

    # Create user C directly via SQL (no auto-household; single membership as member)
    user_c_id = uuid.uuid4()
    uc = _uname()
    shot_id = f"DEL-{uuid.uuid4().hex[:8]}"

    async with pg_engine.begin() as conn:
        # Insert user C (username-only, no password needed — JWT minted directly)
        await conn.execute(
            sa.text("INSERT INTO users (id, username, display_name) VALUES (:id, :uname, :dn)"),
            {"id": str(user_c_id), "uname": uc, "dn": "Member C"},
        )
        # Add user C as a member (not admin) of household A
        await conn.execute(
            sa.text(
                "INSERT INTO household_members (household_id, user_id, role, invited_by) "
                "VALUES (:hid, :uid, 'member', :inv)"
            ),
            {"hid": str(household_a_id), "uid": str(user_c_id), "inv": str(user_a_id)},
        )
        # Insert a brew log entry belonging to household A
        await conn.execute(
            sa.text("INSERT INTO brew_log (sheets_id, household_id) VALUES (:sid, :hid)"),
            {"sid": shot_id, "hid": str(household_a_id)},
        )

    # Mint a JWT for user C (same secret as conftest JWT_SECRET)
    token_c = create_access_token(user_c_id)

    # Member (user C) attempts DELETE → 403 (require_admin rejects before DB access)
    r = await client.delete(
        f"/api/brew-log/{shot_id}",
        headers={"Authorization": f"Bearer {token_c}"},
    )
    assert r.status_code == 403, r.text

    # Admin (user A) attempts DELETE → 204
    r = await client.delete(
        f"/api/brew-log/{shot_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert r.status_code == 204, r.text


async def test_seed_orphan_rows_on_first_login(
    integration_client: AsyncClient,
    pg_engine: AsyncEngine,
) -> None:
    """AC-090–092: first login creates 'Home' household and assigns all orphan rows.

    Also verifies idempotency: a second login does NOT create another household.
    """
    from app.rate_limit import limiter

    limiter._storage.reset()

    client = integration_client

    # Pre-insert orphan rows (household_id = NULL) in all 5 tenant tables
    orphan_brew = f"SEED-BL-{uuid.uuid4().hex[:8]}"
    orphan_catalog = f"SEED-CAT-{uuid.uuid4().hex[:8]}"
    orphan_bag = f"SEED-BAG-{uuid.uuid4().hex[:8]}"
    orphan_hw = f"SEED-HW-{uuid.uuid4().hex[:8]}"
    orphan_maint = f"SEED-ML-{uuid.uuid4().hex[:8]}"

    async with pg_engine.begin() as conn:
        await conn.execute(
            sa.text("INSERT INTO brew_log (sheets_id) VALUES (:sid)"),
            {"sid": orphan_brew},
        )
        await conn.execute(
            sa.text(
                "INSERT INTO catalog (sheets_id, roaster, bean_name) "
                "VALUES (:sid, 'Orphan Roaster', 'Orphan Bean')"
            ),
            {"sid": orphan_catalog},
        )
        await conn.execute(
            sa.text("INSERT INTO inventory_bags (sheets_id) VALUES (:sid)"),
            {"sid": orphan_bag},
        )
        await conn.execute(
            sa.text(
                "INSERT INTO hardware (sheets_id, category, name) "
                "VALUES (:sid, 'Grinder', 'Orphan Grinder')"
            ),
            {"sid": orphan_hw},
        )
        await conn.execute(
            sa.text("INSERT INTO maintenance_log (sheets_id, action) VALUES (:sid, 'Cleaned')"),
            {"sid": orphan_maint},
        )

    # First login: register new user (triggers seed_default_household_if_needed)
    unew = _uname()
    r = await client.post(
        "/auth/register",
        json={"username": unew, "password": "SeedOrphan12345!"},
    )
    assert r.status_code == 201, r.text
    token_new: str = r.json()["access_token"]

    # Resolve the new "Home" household ID
    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token_new}"})
    assert r.status_code == 200
    new_household_id: str = r.json()["household_id"]
    assert new_household_id is not None, "Expected a household_id after first login"

    # Assert all 5 pre-inserted orphan rows now carry the new household_id
    async with pg_engine.begin() as conn:
        for table, col, val in [
            ("brew_log", "sheets_id", orphan_brew),
            ("catalog", "sheets_id", orphan_catalog),
            ("inventory_bags", "sheets_id", orphan_bag),
            ("hardware", "sheets_id", orphan_hw),
            ("maintenance_log", "sheets_id", orphan_maint),
        ]:
            result = await conn.execute(
                sa.text(
                    f"SELECT household_id FROM {table} WHERE {col} = :v"  # noqa: S608
                ),
                {"v": val},
            )
            row = result.fetchone()
            assert row is not None, f"Row missing: {table}.{col}={val!r}"
            assert str(row[0]) == new_household_id, (
                f"{table} orphan row not updated: expected {new_household_id!r}, got {row[0]!r}"
            )

    # Idempotency: second login must NOT create another household
    limiter._storage.reset()
    r = await client.post(
        "/auth/login",
        json={"username": unew, "password": "SeedOrphan12345!"},
    )
    assert r.status_code == 200, r.text

    async with pg_engine.begin() as conn:
        result = await conn.execute(
            sa.text(
                "SELECT COUNT(*) FROM household_members hm "
                "JOIN users u ON hm.user_id = u.id "
                "WHERE u.username = :uname"
            ),
            {"uname": unew},
        )
        count: int = result.scalar_one()
    assert count == 1, f"Expected 1 household membership after second login, got {count}"


# ---------------------------------------------------------------------------
# AC-097 extension: scoped to active household
# ---------------------------------------------------------------------------


async def test_brew_logs_scoped_to_active_household_not_all(
    integration_client: AsyncClient,
    pg_engine: AsyncEngine,
) -> None:
    """Brew log reads honor the persisted active household, not all memberships."""
    from app.rate_limit import limiter as _limiter

    _limiter._storage.reset()

    client = integration_client

    username = _uname()
    r = await client.post(
        "/auth/register", json={"username": username, "password": "ActiveA12345!"}
    )
    assert r.status_code == 201, r.text
    token: str = r.json()["access_token"]

    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    primary_household_id: str = r.json()["household_id"]
    assert primary_household_id is not None

    r = await client.post(
        "/households",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Lab"},
    )
    assert r.status_code == 201, r.text
    secondary_household_id: str = r.json()["id"]
    primary_shot_id = f"ACTIVE-A-{uuid.uuid4().hex[:8]}"
    secondary_shot_id = f"ACTIVE-B-{uuid.uuid4().hex[:8]}"

    async with pg_engine.connect() as conn:
        await conn.execute(sa.text("ALTER TABLE brew_log FORCE ROW LEVEL SECURITY"))
        await conn.commit()

    try:
        async with pg_engine.begin() as conn:
            await conn.execute(
                sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
                {"hid": primary_household_id},
            )
            await conn.execute(
                sa.text("INSERT INTO brew_log (sheets_id, household_id) VALUES (:sid, :hid)"),
                {"sid": primary_shot_id, "hid": primary_household_id},
            )
            await conn.execute(
                sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
                {"hid": secondary_household_id},
            )
            await conn.execute(
                sa.text("INSERT INTO brew_log (sheets_id, household_id) VALUES (:sid, :hid)"),
                {"sid": secondary_shot_id, "hid": secondary_household_id},
            )

        r = await client.get("/api/brew-log", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200, r.text
        shot_ids = [item["shot_id"] for item in r.json()["items"]]
        assert secondary_shot_id in shot_ids
        assert primary_shot_id not in shot_ids

    finally:
        async with pg_engine.connect() as conn:
            await conn.execute(sa.text("ALTER TABLE brew_log NO FORCE ROW LEVEL SECURITY"))
            await conn.commit()


async def test_active_household_survives_server_restart(
    integration_client: AsyncClient,
) -> None:
    """A fresh client reads the persisted active household from the database."""
    from app.rate_limit import limiter as _limiter

    _limiter._storage.reset()

    client = integration_client

    username = _uname()
    r = await client.post(
        "/auth/register", json={"username": username, "password": "Restart12345!"}
    )
    assert r.status_code == 201, r.text
    token: str = r.json()["access_token"]

    r = await client.post(
        "/households",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Travel"},
    )
    assert r.status_code == 201, r.text
    travel_household_id: str = r.json()["id"]

    r = await client.post(
        "/auth/switch-household",
        headers={"Authorization": f"Bearer {token}"},
        json={"household_id": travel_household_id},
    )
    assert r.status_code == 200, r.text
    assert r.json()["household_name"] == "Travel"

    async with AsyncClient(
        transport=ASGITransport(app=app), base_url="http://test"
    ) as fresh_client:
        r = await fresh_client.get(
            "/auth/me",
            headers={"Authorization": f"Bearer {token}"},
        )

    assert r.status_code == 200, r.text
    assert r.json()["active_household_id"] == travel_household_id
    assert r.json()["household_id"] == travel_household_id


async def test_admin_actions_scoped_to_active_household(
    integration_client: AsyncClient,
    pg_engine: AsyncEngine,
) -> None:
    """Admin-only household actions use the caller's active household membership."""
    from app.rate_limit import limiter as _limiter

    _limiter._storage.reset()

    client = integration_client

    username = _uname()
    r = await client.post("/auth/register", json={"username": username, "password": "Invite12345!"})
    assert r.status_code == 201, r.text
    token: str = r.json()["access_token"]

    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    primary_household_id: str = r.json()["household_id"]
    assert primary_household_id is not None

    r = await client.post(
        "/households",
        headers={"Authorization": f"Bearer {token}"},
        json={"name": "Office"},
    )
    assert r.status_code == 201, r.text
    active_household_id: str = r.json()["id"]

    r = await client.post(
        "/households/invitations",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "invited_email": f"invite-{uuid.uuid4().hex[:8]}@example.com",
            "invited_role": "member",
        },
    )
    assert r.status_code == 201, r.text
    invitation_id: str = r.json()["invitation_id"]

    async with pg_engine.begin() as conn:
        result = await conn.execute(
            sa.text("SELECT household_id FROM pending_invitations WHERE id = :invitation_id"),
            {"invitation_id": invitation_id},
        )
        row = result.fetchone()

    assert row is not None
    assert str(row[0]) == active_household_id
    assert str(row[0]) != primary_household_id


async def test_active_household_set_to_null_when_last_household_deleted(
    integration_client: AsyncClient,
    pg_engine: AsyncEngine,
) -> None:
    """Soft-deleting the last household clears the persisted active household immediately."""
    from app.rate_limit import limiter as _limiter

    _limiter._storage.reset()

    client = integration_client

    username = _uname()
    r = await client.post("/auth/register", json={"username": username, "password": "Delete12345!"})
    assert r.status_code == 201, r.text
    token: str = r.json()["access_token"]

    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    household_id: str = r.json()["household_id"]
    user_id: str = r.json()["id"]
    assert household_id is not None

    r = await client.delete(
        f"/households/{household_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert r.status_code == 204, r.text

    async with pg_engine.begin() as conn:
        result = await conn.execute(
            sa.text("SELECT active_household_id FROM users WHERE id = :user_id"),
            {"user_id": user_id},
        )
        row = result.fetchone()

    assert row is not None
    assert row[0] is None


# ---------------------------------------------------------------------------
# RLS cross-household isolation: catalog, inventory, hardware, maintenance
# ---------------------------------------------------------------------------


async def test_rls_catalog_cross_household_blocked(
    integration_client: AsyncClient,
    pg_engine: AsyncEngine,
) -> None:
    """RLS on catalog: user B must not see user A's catalog entries (AC-097 pattern)."""
    from app.rate_limit import limiter as _limiter

    _limiter._storage.reset()

    client = integration_client

    ua = _uname()
    r = await client.post("/auth/register", json={"username": ua, "password": "CatRLS12345!"})
    assert r.status_code == 201, r.text
    token_a = r.json()["access_token"]

    _limiter._storage.reset()

    ub = _uname()
    r = await client.post("/auth/register", json={"username": ub, "password": "CatRLS_B1234!"})
    assert r.status_code == 201, r.text
    token_b = r.json()["access_token"]

    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 200
    hh_a_id: str = r.json()["household_id"]

    cat_sid = f"RLS-CAT-{uuid.uuid4().hex[:8]}"

    async with pg_engine.connect() as conn:
        await conn.execute(sa.text("ALTER TABLE catalog FORCE ROW LEVEL SECURITY"))
        await conn.commit()

    try:
        async with pg_engine.begin() as conn:
            await conn.execute(
                sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
                {"hid": hh_a_id},
            )
            await conn.execute(
                sa.text(
                    "INSERT INTO catalog (sheets_id, roaster, bean_name, household_id) "
                    "VALUES (:sid, 'RLS Roaster', 'RLS Bean', :hid)"
                ),
                {"sid": cat_sid, "hid": hh_a_id},
            )

        r = await client.get("/api/catalog", headers={"Authorization": f"Bearer {token_b}"})
        assert r.status_code == 200, r.text
        ids_b = [item["catalog_id"] for item in r.json()]
        assert cat_sid not in ids_b, (
            f"RLS violation: user B's catalog contains user A's entry {cat_sid!r}"
        )

        r = await client.get("/api/catalog", headers={"Authorization": f"Bearer {token_a}"})
        assert r.status_code == 200, r.text
        ids_a = [item["catalog_id"] for item in r.json()]
        assert cat_sid in ids_a, f"User A should see their own catalog entry {cat_sid!r}"

    finally:
        async with pg_engine.connect() as conn:
            await conn.execute(sa.text("ALTER TABLE catalog NO FORCE ROW LEVEL SECURITY"))
            await conn.commit()


async def test_rls_inventory_cross_household_blocked(
    integration_client: AsyncClient,
    pg_engine: AsyncEngine,
) -> None:
    """RLS on inventory_bags: user B must not see user A's bags (AC-097 pattern)."""
    from app.rate_limit import limiter as _limiter

    _limiter._storage.reset()

    client = integration_client

    ua = _uname()
    r = await client.post("/auth/register", json={"username": ua, "password": "InvRLS12345!"})
    assert r.status_code == 201, r.text
    token_a = r.json()["access_token"]

    _limiter._storage.reset()

    ub = _uname()
    r = await client.post("/auth/register", json={"username": ub, "password": "InvRLS_B1234!"})
    assert r.status_code == 201, r.text
    token_b = r.json()["access_token"]

    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 200
    hh_a_id: str = r.json()["household_id"]

    bag_sid = f"RLS-BAG-{uuid.uuid4().hex[:8]}"

    async with pg_engine.connect() as conn:
        await conn.execute(sa.text("ALTER TABLE inventory_bags FORCE ROW LEVEL SECURITY"))
        await conn.commit()

    try:
        async with pg_engine.begin() as conn:
            await conn.execute(
                sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
                {"hid": hh_a_id},
            )
            await conn.execute(
                sa.text("INSERT INTO inventory_bags (sheets_id, household_id) VALUES (:sid, :hid)"),
                {"sid": bag_sid, "hid": hh_a_id},
            )

        r = await client.get("/api/inventory", headers={"Authorization": f"Bearer {token_b}"})
        assert r.status_code == 200, r.text
        ids_b = [item["bag_id"] for item in r.json()]
        assert bag_sid not in ids_b, (
            f"RLS violation: user B's inventory contains user A's bag {bag_sid!r}"
        )

        r = await client.get("/api/inventory", headers={"Authorization": f"Bearer {token_a}"})
        assert r.status_code == 200, r.text
        ids_a = [item["bag_id"] for item in r.json()]
        assert bag_sid in ids_a, f"User A should see their own bag {bag_sid!r}"

    finally:
        async with pg_engine.connect() as conn:
            await conn.execute(sa.text("ALTER TABLE inventory_bags NO FORCE ROW LEVEL SECURITY"))
            await conn.commit()


async def test_rls_hardware_cross_household_blocked(
    integration_client: AsyncClient,
    pg_engine: AsyncEngine,
) -> None:
    """RLS on hardware: user B must not see user A's hardware (AC-097 pattern)."""
    from app.rate_limit import limiter as _limiter

    _limiter._storage.reset()

    client = integration_client

    ua = _uname()
    r = await client.post("/auth/register", json={"username": ua, "password": "HwRLS123456!"})
    assert r.status_code == 201, r.text
    token_a = r.json()["access_token"]

    _limiter._storage.reset()

    ub = _uname()
    r = await client.post("/auth/register", json={"username": ub, "password": "HwRLS_B12345!"})
    assert r.status_code == 201, r.text
    token_b = r.json()["access_token"]

    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 200
    hh_a_id: str = r.json()["household_id"]

    hw_sid = f"RLS-HW-{uuid.uuid4().hex[:8]}"

    async with pg_engine.connect() as conn:
        await conn.execute(sa.text("ALTER TABLE hardware FORCE ROW LEVEL SECURITY"))
        await conn.commit()

    try:
        async with pg_engine.begin() as conn:
            await conn.execute(
                sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
                {"hid": hh_a_id},
            )
            await conn.execute(
                sa.text(
                    "INSERT INTO hardware (sheets_id, category, name, household_id) "
                    "VALUES (:sid, 'Grinder', 'RLS Grinder', :hid)"
                ),
                {"sid": hw_sid, "hid": hh_a_id},
            )

        r = await client.get("/api/hardware", headers={"Authorization": f"Bearer {token_b}"})
        assert r.status_code == 200, r.text
        ids_b = [item["hardware_id"] for item in r.json()]
        assert hw_sid not in ids_b, (
            f"RLS violation: user B's hardware list contains user A's entry {hw_sid!r}"
        )

        r = await client.get("/api/hardware", headers={"Authorization": f"Bearer {token_a}"})
        assert r.status_code == 200, r.text
        ids_a = [item["hardware_id"] for item in r.json()]
        assert hw_sid in ids_a, f"User A should see their own hardware {hw_sid!r}"

    finally:
        async with pg_engine.connect() as conn:
            await conn.execute(sa.text("ALTER TABLE hardware NO FORCE ROW LEVEL SECURITY"))
            await conn.commit()


async def test_rls_maintenance_cross_household_blocked(
    integration_client: AsyncClient,
    pg_engine: AsyncEngine,
) -> None:
    """RLS on maintenance_log: user B must not see user A's events (AC-097 pattern)."""
    from app.rate_limit import limiter as _limiter

    _limiter._storage.reset()

    client = integration_client

    ua = _uname()
    r = await client.post("/auth/register", json={"username": ua, "password": "MaintRLS1234!"})
    assert r.status_code == 201, r.text
    token_a = r.json()["access_token"]

    _limiter._storage.reset()

    ub = _uname()
    r = await client.post("/auth/register", json={"username": ub, "password": "MaintRLS_B12!"})
    assert r.status_code == 201, r.text
    token_b = r.json()["access_token"]

    r = await client.get("/auth/me", headers={"Authorization": f"Bearer {token_a}"})
    assert r.status_code == 200
    hh_a_id: str = r.json()["household_id"]

    maint_sid = f"RLS-ML-{uuid.uuid4().hex[:8]}"

    async with pg_engine.connect() as conn:
        await conn.execute(sa.text("ALTER TABLE maintenance_log FORCE ROW LEVEL SECURITY"))
        await conn.commit()

    try:
        async with pg_engine.begin() as conn:
            await conn.execute(
                sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
                {"hid": hh_a_id},
            )
            await conn.execute(
                sa.text(
                    "INSERT INTO maintenance_log (sheets_id, action, household_id) "
                    "VALUES (:sid, 'Cleaned', :hid)"
                ),
                {"sid": maint_sid, "hid": hh_a_id},
            )

        r = await client.get("/api/maintenance", headers={"Authorization": f"Bearer {token_b}"})
        assert r.status_code == 200, r.text
        ids_b = [item["maintenance_id"] for item in r.json()]
        assert maint_sid not in ids_b, (
            f"RLS violation: user B's maintenance log contains user A's entry {maint_sid!r}"
        )

        r = await client.get("/api/maintenance", headers={"Authorization": f"Bearer {token_a}"})
        assert r.status_code == 200, r.text
        ids_a = [item["maintenance_id"] for item in r.json()]
        assert maint_sid in ids_a, f"User A should see their own maintenance event {maint_sid!r}"

    finally:
        async with pg_engine.connect() as conn:
            await conn.execute(sa.text("ALTER TABLE maintenance_log NO FORCE ROW LEVEL SECURITY"))
            await conn.commit()
