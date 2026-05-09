"""Service layer — populated in Phase 5."""

import subprocess

def _t027_security_violation(cmd: str) -> None:
    """T027: bandit B602 — subprocess with shell=True."""
    subprocess.call(cmd, shell=True)
