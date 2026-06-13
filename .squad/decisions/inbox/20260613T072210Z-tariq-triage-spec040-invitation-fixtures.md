---
node_id: 20260613T072210Z-tariq-triage-spec040-invitation-fixtures
node_type: decision_drop
agent: Tariq
role: triage
repo: espresso-logs
branch: household_test_fixtures
date: 2026-06-13
status: DIRECT_PERMITTED
---

# Tariq triage — Spec-040 invitation-contract fixture failures

## Tests triaged

1. `tests/test_spec040_household_contracts.py:181` — `test_spec040_public_invitation_preview_is_get_and_never_consumes_token`
2. `tests/test_spec040_household_contracts.py:222` — `test_spec040_decline_invitation_is_non_consuming_dismissal`

Verification run: `uv run pytest tests/test_spec040_household_contracts.py::test_spec040_public_invitation_preview_is_get_and_never_consumes_token tests/test_spec040_household_contracts.py::test_spec040_decline_invitation_is_non_consuming_dismissal -q` failed both tests with HTTP 410 `Invitation expired`, matching the reported failure mode.

## Root-cause diagnosis

The failure is a time-bomb test fixture, not an application regression. `_fake_invitation` hardcodes `invitation.invited_at = datetime.datetime(2026, 6, 9, tzinfo=UTC)` at `tests/test_spec040_household_contracts.py:99` and derives `invitation.expires_at = invitation.invited_at + datetime.timedelta(hours=72)` at `tests/test_spec040_household_contracts.py:100`. That produces `expires_at = 2026-06-12T00:00:00Z`; on 2026-06-13 the fixture represents an expired invitation.

Both failing endpoints correctly enforce expiry before exercising the contract assertions. `_ensure_invitation_not_expired` raises HTTP 410 when `invitation.expires_at < datetime.datetime.now(datetime.timezone.utc)` at `app/routers/api_households.py:248-250`. Public preview calls that guard at `app/routers/api_households.py:372-381`; decline calls it at `app/routers/api_households.py:449-457`. Therefore both tests receive 410 before the preview non-consumption assertions at `tests/test_spec040_household_contracts.py:209-219` and decline non-consumption assertions at `tests/test_spec040_household_contracts.py:242-246` can run.

These tests are pure unit/ASGI tests with mocks, not database-dependent failures. `db_override` yields an `AsyncMock` and overrides `get_db` at `tests/test_spec040_household_contracts.py:23-38`; preview patches `app.routers.api_households.HouseholdRepo` and `UserRepo` at `tests/test_spec040_household_contracts.py:194-204`; decline patches `HouseholdRepo` at `tests/test_spec040_household_contracts.py:229-235`.

## Spec citations and contract assessment

The endpoint behavior is spec-correct:

- `GET /households/invitations/{token}` is a public preview that does not consume the token and must return 410 for expired invitations (`coffee_tracker/specs/040-household-experience-repair/spec.md:296-299`).
- `AC-040-ACC-05` requires decline to dismiss without consuming or revoking the invitation, with later acceptance allowed until expiry unless revoked (`coffee_tracker/specs/040-household-experience-repair/spec.md:195-200`).
- The detailed decline API contract repeats that decline must not consume, revoke, or make the token unacceptable before expiry (`coffee_tracker/specs/040-household-experience-repair/spec.md:304-305`).

Conclusion: the tests' intended contracts are correct, and the application's 410-on-expired behavior is also correct. The only incorrect artifact is the fixture's absolute date for tests that require a still-valid pending invitation.

## Blast radius

`_fake_invitation` is used in this file at `tests/test_spec040_household_contracts.py:149`, `tests/test_spec040_household_contracts.py:187`, `tests/test_spec040_household_contracts.py:227`, and `tests/test_spec040_household_contracts.py:257`. The create-invitation test at `tests/test_spec040_household_contracts.py:142-178` does not exercise expiry validation. The preview test at `tests/test_spec040_household_contracts.py:181-219` and decline test at `tests/test_spec040_household_contracts.py:222-246` are affected. The resend test at `tests/test_spec040_household_contracts.py:249-280` uses the fixture but targets resend output, not the public expiry guard. The preview expected body reads `invitation.expires_at` dynamically at `tests/test_spec040_household_contracts.py:211-217`, so it should adapt to a relative fixture date.

## Spec-042 postmortem taxonomy classification

Classification verdict: **Inherited pre-existing failure**, with a time/environment-triggered mechanism.

Spec-042 defines `Inherited pre-existing failure` as the category whose correct response is to bisect against baseline and fix forward per spec rules (`coffee_tracker/specs/042-pr116-kaapi-kadai-remediation/spec_042_feedback.md:326-331`). This failure was reported and revalidated as present on baseline `household_fixes`, so it is inherited rather than introduced by `household_test_fixtures`. The trigger is wall-clock time, so it resembles environment nondeterminism, but it is not a poisoned process/port/env issue; after the fixture's 2026-06-12 expiry boundary, the two mocked tests fail deterministically on any database/environment.

## Routing decision

`status: DIRECT_PERMITTED`

Owner: **Quinn** (tests/contracts).

Rationale: the fix is tests-only, bounded to the Spec-040 contract fixture, and requires no application behavior, infrastructure, product contract, or SpecKit artifact change. The expected application behavior is already aligned with the spec's expired-invitation contract.

Bounded scope for fix:

- Update `_fake_invitation` in `tests/test_spec040_household_contracts.py:84-103` so the default fixture represents a valid pending invitation relative to current time, e.g. set `invited_at = datetime.datetime.now(tz=UTC)` and keep `expires_at = invited_at + datetime.timedelta(hours=72)`.
- Optional improvement: allow `_fake_invitation` to accept `invited_at` and/or `expires_at` overrides so future tests can explicitly construct expired, revoked, or edge-window invitations without reintroducing absolute-date time bombs.
- Re-run the two failing tests first, then the relevant household contract test file, then repository-required quality gates before any push decision.

## Follow-up recommendation

Recommend a separate Quinn-owned follow-up sweep for hardcoded absolute-date fixtures in tests that are compared to `now()` or pass through expiry/freshness guards. Do not fold that sweep into this fix unless the coordinator explicitly expands scope; the immediate repair should remain surgical.
