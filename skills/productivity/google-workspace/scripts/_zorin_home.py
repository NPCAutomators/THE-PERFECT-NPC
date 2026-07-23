"""Resolve ZORIN_HOME for standalone skill scripts.

Skill scripts may run outside the Zorin process (e.g. system Python,
nix env, CI) where ``zorin_constants`` is not importable.  This module
provides the same ``get_zorin_home()`` and ``display_zorin_home()``
contracts as ``zorin_constants`` without requiring it on ``sys.path``.

When ``zorin_constants`` IS available it is used directly so that any
future enhancements (profile resolution, Docker detection, etc.) are
picked up automatically.  The fallback path replicates the core logic
from ``zorin_constants.py`` using only the stdlib.

All scripts under ``google-workspace/scripts/`` should import from here
instead of duplicating the ``ZORIN_HOME = Path(os.getenv(...))`` pattern.
"""

from __future__ import annotations

import os
from pathlib import Path

try:
    from zorin_constants import display_zorin_home as display_zorin_home
    from zorin_constants import get_zorin_home as get_zorin_home
except (ModuleNotFoundError, ImportError):

    def get_zorin_home() -> Path:
        """Return the Zorin home directory (default: ~/.zorin).

        Mirrors ``zorin_constants.get_zorin_home()``."""
        val = os.environ.get("ZORIN_HOME", "").strip()
        return Path(val) if val else Path.home() / ".zorin"

    def display_zorin_home() -> str:
        """Return a user-friendly ``~/``-shortened display string.

        Mirrors ``zorin_constants.display_zorin_home()``."""
        home = get_zorin_home()
        try:
            return "~/" + str(home.relative_to(Path.home()))
        except ValueError:
            return str(home)
