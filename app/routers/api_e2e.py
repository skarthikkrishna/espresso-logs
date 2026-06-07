"""Test-only endpoints for E2E teardown and seeding.

This router is only registered when ``E2E_AUTH_BYPASS=1`` is set.  It must
never be mounted in production.
"""

from __future__ import annotations

import datetime
import os
import uuid
from typing import Any, Protocol

from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel
import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession

from app.deps import (
    _E2E_AUTH_BYPASS,
    _E2E_HOUSEHOLD_ID,
    _E2E_USER_ID,
    get_catalog_repo,
    get_inventory_repo,
)
from app.models.base import get_db
from app.rate_limit import limiter
from app.repos.sql.refresh_tokens import RefreshTokenRepo
from app.services.auth import (
    create_access_token,
    generate_refresh_token,
    hash_password,
    set_refresh_cookie,
)

router = APIRouter(prefix="/api/e2e", tags=["e2e"])
_PERMITTED_E2E_CLEANUP_ENVS = frozenset({"local", "test"})


class _RepoPkDelete(Protocol):
    """Structural protocol for repos that support deletion by primary-key value."""

    def delete_by_pk(self, pk_col: str, pk_val: str) -> None: ...


class _CleanupBody(BaseModel):
    catalog_id: str | None = None
    bag_id: str | None = None
    reset_household: bool = False


class _SeedUserOut(BaseModel):
    user_id: uuid.UUID
    household_id: uuid.UUID


class _Spec039SeedOut(BaseModel):
    household_id: uuid.UUID
    catalog_ids: dict[str, str]
    bag_ids: dict[str, str]
    shot_ids: dict[str, str]
    hardware_ids: dict[str, str]
    has_ai_feedback: dict[str, bool]


class _SessionOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


def _e2e_household_cleanup_enabled() -> bool:
    return _E2E_AUTH_BYPASS and os.environ.get("APP_ENV") in _PERMITTED_E2E_CLEANUP_ENVS


def _require_e2e_local_or_test() -> None:
    if not _e2e_household_cleanup_enabled():
        raise HTTPException(status_code=404, detail="Not found")


async def _reset_e2e_household_state(db: AsyncSession | None) -> None:
    if db is None or not _e2e_household_cleanup_enabled():
        return

    params = {"uid": _E2E_USER_ID, "hid": _E2E_HOUSEHOLD_ID}
    await db.execute(
        sa.text("UPDATE users SET active_household_id = NULL WHERE id = :uid"),
        params,
    )
    await db.execute(
        sa.text(
            """
            DELETE FROM household_members
            WHERE user_id = :uid
               OR household_id = :hid
            """
        ),
        params,
    )
    await db.execute(
        sa.text(
            """
            DELETE FROM households
            WHERE id = :hid
               OR created_by = :uid
            """
        ),
        params,
    )
    await db.commit()


@router.delete("/cleanup", status_code=204)
async def api_e2e_cleanup(
    body: _CleanupBody,
    catalog_repo: Any = Depends(get_catalog_repo),
    inventory_repo: Any = Depends(get_inventory_repo),
    db: AsyncSession | None = Depends(get_db),
) -> None:
    """Delete E2E seed records by ID.

    Deletes the inventory bag (if *bag_id* provided), then the catalog item
    (if *catalog_id* provided).  When *reset_household* is true, the synthetic
    household membership is cleared so onboarding tests can start from a
    zero-membership baseline.  Unknown IDs are silently ignored — the endpoint
    is idempotent so re-running a failed teardown never errors.

    Only reachable when the server is started with ``E2E_AUTH_BYPASS=1``.
    """
    if body.bag_id:
        inventory_repo.delete_by_pk("Bag_ID", body.bag_id)

    if body.catalog_id:
        catalog_repo.delete_by_pk("Catalog_ID", body.catalog_id)

    if body.reset_household:
        await _reset_e2e_household_state(db)


@router.post("/seed-user", response_model=_SeedUserOut, status_code=200)
async def api_e2e_seed_user(
    db: AsyncSession | None = Depends(get_db),
) -> _SeedUserOut:
    """Idempotently seed the real E2E test user (username=user, password=password),
    household, membership, and active_household_id.

    Returns ``{ user_id, household_id }`` for use in E2E test setup.

    Only reachable when ``E2E_AUTH_BYPASS=1`` and ``APP_ENV`` is ``local`` or
    ``test``.  No auth dependency — called before any login session exists.
    """
    if not (_E2E_AUTH_BYPASS and os.environ.get("APP_ENV") in _PERMITTED_E2E_CLEANUP_ENVS):
        raise HTTPException(status_code=404, detail="Not found")
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    pwd_hash = hash_password("password")
    # Remove any pre-existing row that owns the target username but carries a
    # different UUID.  Without this, the INSERT below raises a unique-constraint
    # violation on users_username_key before the ON CONFLICT (id) clause can
    # fire — exactly the shape seen when a developer manually created username
    # 'user' before seed-user existed.
    await db.execute(
        sa.text("DELETE FROM users WHERE username = :username AND id != :uid"),
        {"username": "user", "uid": _E2E_USER_ID},
    )
    await db.execute(
        sa.text(
            """
            INSERT INTO users (id, username, email, display_name, password_hash)
            VALUES (:uid, :username, :email, :display_name, :password_hash)
            ON CONFLICT (id) DO UPDATE
            SET username = EXCLUDED.username,
                email = EXCLUDED.email,
                display_name = EXCLUDED.display_name,
                password_hash = EXCLUDED.password_hash
            """
        ),
        {
            "uid": _E2E_USER_ID,
            "username": "user",
            "email": "user@localhost",
            "display_name": "E2E User",
            "password_hash": pwd_hash,
        },
    )
    await db.execute(
        sa.text(
            """
            INSERT INTO households (id, name, created_by)
            VALUES (:hid, :name, :uid)
            ON CONFLICT (id) DO UPDATE
            SET name = EXCLUDED.name,
                created_by = EXCLUDED.created_by,
                deleted_at = NULL
            """
        ),
        {
            "hid": _E2E_HOUSEHOLD_ID,
            "name": "E2E Household",
            "uid": _E2E_USER_ID,
        },
    )
    await db.execute(
        sa.text(
            """
            INSERT INTO household_members (household_id, user_id, role)
            VALUES (:hid, :uid, 'admin')
            ON CONFLICT (household_id, user_id) DO UPDATE
            SET role = EXCLUDED.role
            """
        ),
        {"hid": _E2E_HOUSEHOLD_ID, "uid": _E2E_USER_ID},
    )
    await db.execute(
        sa.text("UPDATE users SET active_household_id = :hid WHERE id = :uid"),
        {"hid": _E2E_HOUSEHOLD_ID, "uid": _E2E_USER_ID},
    )
    await db.commit()
    return _SeedUserOut(user_id=_E2E_USER_ID, household_id=_E2E_HOUSEHOLD_ID)


async def _cleanup_spec039_rows(db: AsyncSession) -> None:
    await db.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(_E2E_HOUSEHOLD_ID)},
    )
    params = {
        "hid": _E2E_HOUSEHOLD_ID,
        "seed_prefix": "SPEC039_%",
        "pw_prefix": "PW_TEST_SPEC039_%",
        "cat_prefix": "CAT039_%",
        "bag_prefix": "BAG039_%",
        "shot_prefix": "SHOT039_%",
        "hw_prefix": "HW039_%",
    }
    await db.execute(
        sa.text(
            """
            DELETE FROM brew_log
            WHERE household_id = :hid
              AND (
                sheets_id LIKE :shot_prefix
                OR idempotency_key LIKE :seed_prefix
                OR idempotency_key LIKE :pw_prefix
                OR notes LIKE :seed_prefix
                OR notes LIKE :pw_prefix
                OR taste_summary LIKE :seed_prefix
                OR taste_summary LIKE :pw_prefix
                OR bag_id IN (
                  SELECT sheets_id
                  FROM inventory_bags
                  WHERE household_id = :hid
                    AND (
                      sheets_id LIKE :bag_prefix
                      OR sheets_catalog_id LIKE :cat_prefix
                      OR beans LIKE :seed_prefix
                      OR beans LIKE :pw_prefix
                      OR display_name LIKE :seed_prefix
                      OR display_name LIKE :pw_prefix
                      OR sheets_catalog_id IN (
                        SELECT sheets_id
                        FROM catalog
                        WHERE household_id = :hid
                          AND (
                            sheets_id LIKE :cat_prefix
                            OR roaster LIKE :seed_prefix
                            OR roaster LIKE :pw_prefix
                            OR bean_name LIKE :seed_prefix
                            OR bean_name LIKE :pw_prefix
                          )
                      )
                    )
                )
                OR catalog_id IN (
                  SELECT id
                  FROM catalog
                  WHERE household_id = :hid
                    AND (
                      sheets_id LIKE :cat_prefix
                      OR roaster LIKE :seed_prefix
                      OR roaster LIKE :pw_prefix
                      OR bean_name LIKE :seed_prefix
                      OR bean_name LIKE :pw_prefix
                    )
                )
              )
            """
        ),
        params,
    )
    await db.execute(
        sa.text(
            """
            DELETE FROM inventory_bags
            WHERE household_id = :hid
              AND (
                sheets_id LIKE :bag_prefix
                OR sheets_catalog_id LIKE :cat_prefix
                OR beans LIKE :seed_prefix
                OR beans LIKE :pw_prefix
                OR display_name LIKE :seed_prefix
                OR display_name LIKE :pw_prefix
                OR sheets_catalog_id IN (
                  SELECT sheets_id
                  FROM catalog
                  WHERE household_id = :hid
                    AND (
                      sheets_id LIKE :cat_prefix
                      OR roaster LIKE :seed_prefix
                      OR roaster LIKE :pw_prefix
                      OR bean_name LIKE :seed_prefix
                      OR bean_name LIKE :pw_prefix
                    )
                )
              )
            """
        ),
        params,
    )
    await db.execute(
        sa.text(
            """
            DELETE FROM catalog
            WHERE household_id = :hid
              AND (
                sheets_id LIKE :cat_prefix
                OR roaster LIKE :seed_prefix
                OR roaster LIKE :pw_prefix
                OR bean_name LIKE :seed_prefix
                OR bean_name LIKE :pw_prefix
              )
            """
        ),
        params,
    )
    await db.execute(
        sa.text(
            """
            DELETE FROM hardware
            WHERE household_id = :hid
              AND (sheets_id LIKE :hw_prefix OR name LIKE :seed_prefix)
            """
        ),
        params,
    )


@router.delete("/spec039/cleanup", status_code=204)
async def api_e2e_spec039_cleanup(
    db: AsyncSession | None = Depends(get_db),
) -> None:
    """Delete only spec-039 synthetic rows from the local E2E household."""
    _require_e2e_local_or_test()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")
    await _cleanup_spec039_rows(db)
    await db.commit()


@router.post("/spec039/seed", response_model=_Spec039SeedOut, status_code=200)
async def api_e2e_spec039_seed(
    db: AsyncSession | None = Depends(get_db),
) -> _Spec039SeedOut:
    """Seed local Postgres with spec-039 synthetic evidence rows.

    The response intentionally returns IDs and boolean field-presence metadata
    only. It never returns stored AI feedback text or other user-content values.
    The latest BAG039_ACTIVE history row pins 18g as the B07 default dose.
    """
    _require_e2e_local_or_test()
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    await api_e2e_seed_user(db=db)
    await _cleanup_spec039_rows(db)

    hid = _E2E_HOUSEHOLD_ID
    await db.execute(
        sa.text("SELECT set_config('app.current_household_id', :hid, true)"),
        {"hid": str(hid)},
    )
    await db.execute(
        sa.text(
            """
            INSERT INTO hardware (household_id, sheets_id, name, category)
            VALUES
              (:hid, 'HW039_MACHINE', 'SPEC039_Machine', 'Machine'),
              (:hid, 'HW039_GRINDER', 'SPEC039_Grinder', 'Grinder'),
              (:hid, 'HW039_BASKET', 'SPEC039_Basket', 'Basket'),
              (:hid, 'HW039_STORAGE', 'SPEC039_Storage', 'Storage')
            """
        ),
        {"hid": hid},
    )
    await db.execute(
        sa.text(
            """
            INSERT INTO catalog (
              household_id, sheets_id, roaster, bean_name, roast_level, product_url, local_image_path
            )
            VALUES
              (
                :hid,
                'CAT039_LOCKED',
                'SPEC039_Roaster_Locked',
                'SPEC039_Locked_Bean',
                'Medium',
                '',
                ''
              ),
              (
                :hid,
                'CAT039_EMPTY_ROAST',
                'SPEC039_Roaster_Open',
                'SPEC039_Open_Bean',
                '',
                '',
                ''
              )
            """
        ),
        {"hid": hid},
    )
    locked_catalog_id = (
        await db.execute(
            sa.text(
                """
                SELECT id
                FROM catalog
                WHERE household_id = :hid AND sheets_id = 'CAT039_LOCKED'
                """
            ),
            {"hid": hid},
        )
    ).scalar_one()
    await db.execute(
        sa.text(
            """
            INSERT INTO inventory_bags (
              household_id,
              catalog_id,
              sheets_id,
              sheets_catalog_id,
              beans,
              display_name,
              roast_date,
              roast_level,
              status,
              storage_method
            )
            VALUES
              (
                :hid,
                :locked_catalog_id,
                'BAG039_ACTIVE',
                'CAT039_LOCKED',
                'SPEC039_Roaster_Locked — SPEC039_Locked_Bean',
                'SPEC039_Roaster_Locked — SPEC039_Locked_Bean',
                DATE '2026-01-02',
                'Medium',
                'Active',
                'Freezer'
              ),
              (
                :hid,
                :locked_catalog_id,
                'BAG039_FINISHED',
                'CAT039_LOCKED',
                'SPEC039_Roaster_Locked — SPEC039_Locked_Bean',
                'SPEC039_Roaster_Locked — SPEC039_Locked_Bean',
                DATE '2025-12-20',
                'Medium',
                'Finished',
                'Freezer'
              )
            """
        ),
        {"hid": hid, "locked_catalog_id": locked_catalog_id},
    )
    await db.execute(
        sa.text(
            """
            INSERT INTO brew_log (
              household_id,
              catalog_id,
              sheets_id,
              bag_id,
              machine_id,
              grinder_id,
              basket_id,
              dose_g,
              yield_g,
              time_sec,
              grind_setting,
              shot_eligibility,
              taste_summary,
              notes,
              ai_feedback,
              storage_method,
              idempotency_key,
              idempotency_request_hash,
              brewed_at
            )
            VALUES
              (
                :hid,
                :locked_catalog_id,
                'SHOT039_TYPO',
                'BAG039_ACTIVE',
                'HW039_MACHINE',
                'HW039_GRINDER',
                'HW039_BASKET',
                18.0,
                36.0,
                27,
                4.0,
                'Good Espresso',
                'SPEC039_typo_baseline',
                'SPEC039_typo_note_needs_correction',
                '',
                'Freezer',
                'SPEC039_TYPO_SEED',
                'SPEC039_HASH_TYPO',
                TIMESTAMPTZ '2026-02-01T12:00:00Z'
              ),
              (
                :hid,
                :locked_catalog_id,
                'SHOT039_AI_PRESENT',
                'BAG039_ACTIVE',
                'HW039_MACHINE',
                'HW039_GRINDER',
                'HW039_BASKET',
                18.5,
                37.0,
                29,
                4.5,
                'Good Espresso',
                'SPEC039_ai_present_summary',
                'SPEC039_ai_present_note',
                concat('SPEC039_AI_PRESENT_', substr(md5('SHOT039_AI_PRESENT'), 1, 8)),
                'Freezer',
                'SPEC039_AI_PRESENT_SEED',
                'SPEC039_HASH_AI_PRESENT',
                TIMESTAMPTZ '2026-02-02T12:00:00Z'
              ),
              (
                :hid,
                :locked_catalog_id,
                'SHOT039_AI_EMPTY',
                'BAG039_ACTIVE',
                'HW039_MACHINE',
                'HW039_GRINDER',
                'HW039_BASKET',
                18.0,
                36.0,
                28,
                4.0,
                'Passable',
                'SPEC039_ai_empty_summary',
                'SPEC039_ai_empty_note',
                '',
                'Freezer',
                'SPEC039_AI_EMPTY_SEED',
                'SPEC039_HASH_AI_EMPTY',
                TIMESTAMPTZ '2026-02-03T12:00:00Z'
              )
            """
        ),
        {"hid": hid, "locked_catalog_id": locked_catalog_id},
    )
    await db.commit()

    return _Spec039SeedOut(
        household_id=hid,
        catalog_ids={
            "locked": "CAT039_LOCKED",
            "empty_roast": "CAT039_EMPTY_ROAST",
        },
        bag_ids={
            "active": "BAG039_ACTIVE",
            "finished": "BAG039_FINISHED",
        },
        shot_ids={
            "typo": "SHOT039_TYPO",
            "ai_present": "SHOT039_AI_PRESENT",
            "ai_empty": "SHOT039_AI_EMPTY",
        },
        hardware_ids={
            "machine": "HW039_MACHINE",
            "grinder": "HW039_GRINDER",
            "basket": "HW039_BASKET",
            "storage": "HW039_STORAGE",
        },
        has_ai_feedback={
            "SHOT039_AI_PRESENT": True,
            "SHOT039_AI_EMPTY": False,
            "SHOT039_TYPO": False,
        },
    )


@router.post("/session", response_model=_SessionOut, status_code=200)
async def api_e2e_session(
    response: Response,
    db: AsyncSession | None = Depends(get_db),
) -> _SessionOut:
    """Create a fresh authenticated session for the seeded E2E user.

    Issues a new refresh token for ``_E2E_USER_ID``, stores the hash, sets the
    ``rt`` HttpOnly cookie on the response, and returns a signed access token
    compatible with frontend expectations (``access_token``, ``token_type``).

    Designed for use in per-test Playwright fixtures as a zero-rate-limit
    alternative to ``POST /auth/login``.  Production rate limiting on
    ``/auth/login`` is not touched by this endpoint.

    Only reachable when ``E2E_AUTH_BYPASS=1`` and ``APP_ENV`` is ``local`` or
    ``test``.
    """
    if not (_E2E_AUTH_BYPASS and os.environ.get("APP_ENV") in _PERMITTED_E2E_CLEANUP_ENVS):
        raise HTTPException(status_code=404, detail="Not found")
    if db is None:
        raise HTTPException(status_code=503, detail="Database unavailable")

    raw_rt, rt_hash = generate_refresh_token()
    expires_at = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=30)
    await RefreshTokenRepo().create(
        db, user_id=_E2E_USER_ID, token_hash=rt_hash, expires_at=expires_at
    )
    await db.commit()

    access_token = create_access_token(_E2E_USER_ID)
    set_refresh_cookie(response, raw_rt)
    return _SessionOut(access_token=access_token)


@router.post("/reset-limiter", status_code=204)
async def api_e2e_reset_limiter() -> None:
    """Clear the in-process SlowAPI rate-limiter storage.

    Resets all per-IP counters so subsequent E2E test requests are not
    rejected with 429 from a previous test's exhausted bucket.

    Only reachable when ``E2E_AUTH_BYPASS=1`` and ``APP_ENV`` is ``local`` or
    ``test``.  Must never be mounted in production.
    """
    if not (_E2E_AUTH_BYPASS and os.environ.get("APP_ENV") in _PERMITTED_E2E_CLEANUP_ENVS):
        raise HTTPException(status_code=404, detail="Not found")
    limiter._storage.reset()
