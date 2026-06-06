# JWT_SECRET Rotation Playbook

**Last Updated:** 2026-06-05  
**Status:** Active (spec-036)  
**Audience:** Operations, DevOps engineers, on-call support

---

## Overview

This playbook documents the zero-downtime JWT_SECRET rotation procedure for Espresso Logs. The rotation process uses a dual-key validation strategy with automatic runtime expiry, eliminating the need for manual cleanup or tight operator timing.

**Why zero-downtime?**
- Existing refresh tokens are cryptographically independent (opaque hashes, not JWT-signed); they remain valid across secret rotations.
- Access tokens are short-lived (15 min TTL), so the compatibility window is bounded automatically.
- The application validates tokens against the current key first, then the previous key for a **15-minute runtime window only**, after which the fallback is automatically disabled.

---

## Prerequisites

Before rotating JWT_SECRET, ensure you have:

1. **gcloud CLI** installed and authenticated with appropriate GCP project permissions
2. **Secret Manager Admin** role for the GCP project (or equivalent `secretmanager.secretVersions.add` permission)
3. **Cloud Run Editor** role (or `run.services.get` and `run.revisions.list` permissions)
4. Familiarity with your deployment pipeline (manual `gcloud run deploy` or automated CI trigger)

---

## Rotation Procedure

### Step 1: Generate New JWT_SECRET

Generate a cryptographically secure 256-bit (32-byte) secret as a 64-character hexadecimal string:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

**Example output:**
```
<YOUR_NEW_64_CHAR_HEX_SECRET>
```

**Save this value securely** — it will be inserted into Secret Manager in Step 2.

**Entropy requirement:** The hex string is 64 characters and represents 256 bits of entropy, meeting the minimum security standard. Do not use shorter or manually-crafted secrets.

---

### Step 2: Update APP_SECRETS Blob in Secret Manager

The APP_SECRETS JSON blob in Secret Manager contains the current JWT_SECRET and, during rotation, the previous secret (JWT_SECRET_PREVIOUS).

**Current state (before rotation):**
```json
{
  "JWT_SECRET": "existing_64_char_hex_string",
  "other_key": "other_value"
}
```

**New state (after rotation, during 15-min window):**
```json
{
  "JWT_SECRET": "<YOUR_NEW_64_CHAR_HEX_SECRET>",
  "JWT_SECRET_PREVIOUS": "existing_64_char_hex_string",
  "other_key": "other_value"
}
```

**To add a new secret version via gcloud CLI:**

1. Create a temporary file with the updated JSON blob:
```bash
cat > /tmp/app_secrets.json << 'EOF'
{
  "JWT_SECRET": "<YOUR_NEW_64_CHAR_HEX_SECRET>",
  "JWT_SECRET_PREVIOUS": "existing_64_char_hex_string",
  "other_key": "other_value"
}
EOF
```

2. Add the new secret version:
```bash
gcloud secrets versions add APP_SECRETS --data-file=/tmp/app_secrets.json
```

3. Verify the new version was created:
```bash
gcloud secrets versions list APP_SECRETS --limit=3
```

4. Clean up the temporary file:
```bash
rm /tmp/app_secrets.json
```

**Important security note:**
- Do not pass the secret via the command line directly (shell history exposure risk).
- Always use `--data-file` to read from a file.
- The temporary file is automatically excluded from Git by `.gitignore`.
- Never commit secrets to version control.

---

### Step 3: Deploy New Code

Deploy a new Cloud Run revision of the application. The new revision will:
- Read both `JWT_SECRET` and `JWT_SECRET_PREVIOUS` from the updated APP_SECRETS blob
- Record the startup time (UTC) as the beginning of the 15-minute rotation window
- Validate incoming access tokens against the current key first, then the previous key (within the window only)

**Via gcloud CLI (if using manual deployment):**
```bash
gcloud run deploy espresso-logs --image=gcr.io/PROJECT_ID/espresso-logs:COMMIT_SHA
```

Replace `PROJECT_ID` with your GCP project ID and `COMMIT_SHA` with the desired image tag.

**Via CI/CD (preferred):**
If your deployment is automated (GitHub Actions, Cloud Build, etc.), trigger the normal deployment pipeline. The new code revision will be deployed and will automatically pick up the updated APP_SECRETS blob.

**Deployment output:**
The deployment will show a new service revision URL and revision ID. Note this for verification in Step 4.

---

### Step 4: Verify and Wait for Auto-Expiry

The rotation window is **15 minutes** from the moment the new Cloud Run revision starts. During this time:
- The application accepts access tokens signed with either `JWT_SECRET` (current) or `JWT_SECRET_PREVIOUS` (legacy).
- All access tokens issued before rotation continue to work until they naturally expire (15-min TTL).
- No manual cleanup is required — the previous key is **automatically ignored** after 15 minutes of runtime.

**Verification steps (no secret values revealed):**

1. **Confirm new revision is active:**
```bash
gcloud run revisions list --service=espresso-logs --limit=3
```

Look for the most recent revision with status `ACTIVE` and timestamp matching your deployment time.

2. **Check logs for startup validation (optional):**
```bash
gcloud run revisions describe <REVISION_ID> --service=espresso-logs
```

Or view real-time logs:
```bash
gcloud run logs read --service=espresso-logs --limit=50
```

Expected log entries (length only, never the secret value):
```
JWT_SECRET validated: 64 characters
```

If the APP_SECRETS blob is missing the `JWT_SECRET` key, you will also see a warning:
```
WARNING: APP_SECRETS blob is set but does not contain JWT_SECRET key
```

3. **Wait 15 minutes:**
After the new revision is confirmed active, wait for the access token TTL to elapse (15 minutes). During this window:
   - All tokens signed with the old secret remain valid.
   - The application's runtime timer counts down.
   - Existing user sessions remain uninterrupted.

4. **Automatic expiry (no action needed):**
After 15 minutes, the application **automatically stops accepting** the previous key in token validation. This happens in the running code; no restart or redeployment is required.

---

### Step 5 (Optional): Clean Up Previous Secret Entry

After the 15-minute window has closed, the `JWT_SECRET_PREVIOUS` entry in the APP_SECRETS blob is no longer used by the application. You may optionally remove it for cleanliness (not required for security):

1. Update the APP_SECRETS blob to remove `JWT_SECRET_PREVIOUS`:
```bash
cat > /tmp/app_secrets.json << 'EOF'
{
  "JWT_SECRET": "<YOUR_NEW_64_CHAR_HEX_SECRET>",
  "other_key": "other_value"
}
EOF
```

2. Add the updated secret version:
```bash
gcloud secrets versions add APP_SECRETS --data-file=/tmp/app_secrets.json
```

3. Clean up:
```bash
rm /tmp/app_secrets.json
```

**Note:** This step is housekeeping only. The stale key in Secret Manager is harmless because the running code will not use it after the 15-minute window expires. The cleanup can be deferred until the next Secret Manager maintenance window.

---

## Rollback

If a deployment containing the new secret causes application issues, **revert to the previous Cloud Run revision immediately**:

```bash
gcloud run services update-traffic espresso-logs --to-revisions <PREVIOUS_REVISION_ID>=100
```

Or use the Cloud Run Console to shift 100% traffic back to the previous revision.

**Effect:**
- The previous revision re-reads the old APP_SECRETS version (via Secret Manager versioning).
- If you have already updated Secret Manager to contain both `JWT_SECRET` and `JWT_SECRET_PREVIOUS`, the previous revision will continue to work (it uses only `JWT_SECRET`).
- All in-flight requests continue using the old access tokens, which remain valid.

**Post-rollback:**
After verifying the previous revision is stable, investigate the root cause before attempting another deployment. Optionally, revert the APP_SECRETS blob to the pre-rotation state (removing `JWT_SECRET_PREVIOUS`).

---

## Security Notes

### Why APP_SECRETS Blob (Not Standalone Env Var)

The JWT_SECRET must be sourced from the APP_SECRETS JSON blob in GCP Secret Manager, not as a standalone Cloud Run environment variable. This approach:

- **Centralized secret versioning:** Secret Manager maintains audit logs and version history for all blob changes.
- **Atomic updates:** The entire secrets object is versioned as one unit; no partial/inconsistent state.
- **Supports rotation:** Enables the dual-key strategy (`JWT_SECRET` + `JWT_SECRET_PREVIOUS`) without multi-deployment complexity.
- **Production safety:** Cloud Run does not persist secrets from prior revisions. Each new revision fetches the current APP_SECRETS blob at startup.

The application explicitly validates that JWT_SECRET is sourced from the blob (not an environment variable override) at startup.

### Why 256-Bit (32-byte) Minimum

- **NIST recommendations:** HS256 with a 256-bit key meets NIST SP 800-38D guidance for authenticated encryption with associated data (AEAD).
- **Brute-force resistance:** A 256-bit key provides 2^256 possible values, making exhaustive search computationally infeasible.
- **Prevents weak defaults:** Enforcing a minimum at startup prevents accidental use of short or hardcoded secrets in production.

The application rejects any JWT_SECRET shorter than 32 characters (256 bits when encoded as hex) with a startup error.

### Why 15-Minute Rotation Window

The 15-minute compatibility window aligns with the access token TTL:

- **Token lifetime:** Access tokens expire after 15 minutes (`exp` claim).
- **No indefinite fallback:** The previous key is accepted **only** for the first 15 minutes of the new revision's runtime, not indefinitely.
- **Bounded risk:** If an old secret is compromised, its usefulness is capped by the token expiry; an attacker cannot forge new tokens once the window closes.
- **Refresh tokens unaffected:** Refresh tokens are opaque (not JWT-signed), so key rotation does not require their re-issuance. Users remain logged in across rotations.

The window is enforced by the running code via a startup timestamp; no external timer, cron job, or manual intervention is required.

### Safe Across Scale-to-Zero

If the application scales to zero (no active Cloud Run revisions) and later cold-starts (new revision created):

- **Startup window resets:** The new revision records a new startup time.
- **Previous tokens already expired:** By the time a new revision starts, any tokens signed with a previous key have long expired (at least 5 min of inactivity + 15 min token TTL).
- **Safe re-opening of window:** Even if the window re-opens for a brief period, the `exp` claim validation rejects tokens that were issued before the scale-to-zero event.

This design is safe against cold-start edge cases without additional logic.

### Warning Log Guard

A startup warning log is emitted **only when** the APP_SECRETS blob is present but the `JWT_SECRET` key is missing:

```
WARNING: APP_SECRETS blob is set but does not contain JWT_SECRET key
```

This guards against configuration errors where the blob is populated but incomplete. The warning is **not** emitted in local development (where APP_SECRETS may be absent or minimal) — only in production where the blob is expected to be complete.

---

## Verification Checklist

Use this checklist to verify a successful rotation:

- [ ] New JWT_SECRET generated via `secrets.token_hex(32)` (64 hex characters, 256-bit entropy)
- [ ] APP_SECRETS blob updated with new `JWT_SECRET` and old value moved to `JWT_SECRET_PREVIOUS`
- [ ] New Cloud Run revision deployed and confirmed active (via `gcloud run revisions list`)
- [ ] Logs show startup validation success (info log: `JWT_SECRET validated: 64 characters`)
- [ ] No warning logs about missing `JWT_SECRET` key in blob
- [ ] Waited 15 minutes (or observed 15 minutes passing via deployment time + clock)
- [ ] Application requests continue working normally (access tokens issued, validated, refreshed)
- [ ] No 401 errors or auth failures from in-flight user sessions
- [ ] (Optional) Verified rollback procedure works by testing a manual traffic shift

---

## Troubleshooting

### Issue: "APP_SECRETS blob is set but does not contain JWT_SECRET key" warning

**Cause:** The APP_SECRETS JSON blob was updated but is missing the `JWT_SECRET` key.

**Resolution:**
1. Verify the blob structure in Secret Manager: `gcloud secrets versions get APP_SECRETS --version latest`
2. Ensure the JSON is valid and includes the `JWT_SECRET` key with a 64-character hex value.
3. Re-add the secret version with the corrected JSON.
4. Restart or redeploy the application.

### Issue: "JWT_SECRET must be at least 32 characters" error at startup

**Cause:** The APP_SECRETS blob contains a `JWT_SECRET` value shorter than 32 characters (256 bits).

**Resolution:**
1. Generate a new secret: `python -c "import secrets; print(secrets.token_hex(32))"`
2. Update the APP_SECRETS blob with the new value.
3. Redeploy the application.

### Issue: Access tokens are rejected (401 errors) after rotation

**Cause:** Most likely, tokens from before the rotation are being used after the 15-minute window has closed. This is expected behavior.

**Resolution:**
1. Verify that the 15-minute window has elapsed since the new revision deployed.
2. Instruct users to refresh their sessions (they should automatically get new tokens if the frontend is properly configured).
3. Check logs for any signature validation errors: `gcloud run logs read --service=espresso-logs --limit=100 | grep -i jwt`

### Issue: 15-minute window seems to have expired before 15 minutes passed

**Cause:** The runtime window is measured from when the Cloud Run revision **started**, not when the deployment command was issued. If the revision was already running and you only added `JWT_SECRET_PREVIOUS` to the blob, the window began at the previous startup time.

**Resolution:**
1. Deploy a **new** Cloud Run revision to reset the window: `gcloud run deploy espresso-logs --image=...`
2. Confirm a new revision was created: `gcloud run revisions list --service=espresso-logs --limit=2`
3. The new revision's startup time marks the beginning of the 15-minute window.

---

## Support

For questions or issues with JWT_SECRET rotation, contact:

- **DevOps/SRE team:** For deployment and Secret Manager access issues
- **Backend team:** For application logs and token validation concerns
- **Security team:** For cryptographic questions or key compromise procedures

---

## References

- **Spec-036:** JWT Security Remediation — [specs/036-jwt-security-remediation/spec.md](../specs/036-jwt-security-remediation/spec.md)
- **Plan v1.1:** ADR-036-03 (Runtime TTL) and ADR-036-04 (Startup Integrity Check)
- **GCP Secret Manager:** https://cloud.google.com/secret-manager/docs
- **Cloud Run Deployments:** https://cloud.google.com/run/docs/deploying
- **Python Secrets Module:** https://docs.python.org/3/library/secrets.html
- **JWT (RFC 7519):** https://tools.ietf.org/html/rfc7519
- **HS256 (HMAC SHA-256):** https://tools.ietf.org/html/rfc7518#section-3.2
