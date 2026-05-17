"""Image storage service — local filesystem fallback + GCS.

Dispatcher logic:
  - If ``bucket`` is falsy OR ``settings.gcp_project_id`` is empty → local storage
  - Otherwise → GCS upload
"""

from __future__ import annotations

import asyncio
import logging
import os
from pathlib import Path

logger = logging.getLogger(__name__)

_MAX_UPLOAD_BYTES = 2_097_152  # 2 MB


async def upload_image_to_gcs(
    image_bytes: bytes,
    content_type: str,
    object_name: str,
    bucket_name: str,
) -> str:
    """Upload image_bytes to GCS bucket; return public URL.

    Uses ADC (Application Default Credentials) — project is resolved automatically
    by the GCS client from the environment. Wraps sync SDK in asyncio.to_thread.
    """

    def _sync_upload() -> str:
        from google.cloud import storage  # type: ignore[attr-defined]

        client = storage.Client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(object_name)
        blob.upload_from_string(image_bytes, content_type=content_type)
        # DO NOT call blob.make_public() — bucket has uniform bucket-level access + public IAM
        return f"https://storage.googleapis.com/{bucket_name}/{object_name}"

    return await asyncio.to_thread(_sync_upload)


async def _local_upload(
    raw_bytes: bytes,
    content_type: str,
    obj_name: str,
) -> str:
    """Save image to app/static/uploads/{obj_name}; return URL path.

    Creates ``app/static/uploads/`` if it does not exist (FR-002).
    Returns a URL of the form ``/static/uploads/{obj_name}`` (FR-003).
    """
    base_dir = Path(__file__).resolve().parent.parent / "static" / "uploads"
    # Create directories on demand — safe under concurrent calls (exist_ok=True)
    base_dir.mkdir(parents=True, exist_ok=True)

    dest = base_dir / os.path.basename(obj_name)
    dest.write_bytes(raw_bytes)
    logger.debug("Local image stored: %s", dest)
    return f"/static/uploads/{os.path.basename(obj_name)}"


async def upload_image(
    raw_bytes: bytes,
    content_type: str,
    obj_name: str,
    bucket: str,
) -> str:
    """Dispatcher: local filesystem when GCS is unconfigured, GCS otherwise.

    Args:
        raw_bytes: Raw image bytes.
        content_type: MIME type (e.g. ``image/jpeg``).
        obj_name: Object key / filename (e.g. ``bean-images/CAT100-abc.jpg``).
        bucket: GCS bucket name. If empty or GCP project unconfigured → local.

    Returns:
        URL string — either ``/static/uploads/…`` or ``https://storage.googleapis.com/…``.
    """
    from app.config import settings

    if not bucket or not settings.gcp_project_id:
        return await _local_upload(raw_bytes, content_type, obj_name)
    return await upload_image_to_gcs(raw_bytes, content_type, obj_name, bucket)
