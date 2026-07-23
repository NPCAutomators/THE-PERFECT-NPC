#!/usr/bin/env python3
"""Fail when retired product identities leak into the ZORIN worktree.

The audit intentionally constructs the retired names from fragments so the
guard does not become the very match it is designed to reject.  Historical
Git objects are outside the worktree and are not scanned.  A tiny allowlist is
reserved for license and contributor identity records that must stay intact.
"""

from __future__ import annotations

import argparse
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
_MAX_TEXT_BYTES = 10 * 1024 * 1024

_RETIRED_AGENT = "her" + "mes"
_RETIRED_ORG = "no" + "us"

_AGENT_PATTERN = re.compile(re.escape(_RETIRED_AGENT), re.IGNORECASE)
_ORG_PATTERN = re.compile(
    rf"(?:{_RETIRED_ORG}[-_ ]?research|(?<![A-Za-z]){_RETIRED_ORG}(?![A-Za-z]))",
    re.IGNORECASE,
)

_TEXT_EXCEPTIONS = {
    Path(".mailmap"),
    Path("LICENSE"),
    Path("apps/ui/THIRD_PARTY_NOTICES.md"),
    Path("plugins/zorin-achievements/LICENSE"),
}
_PATH_EXCEPTION_PREFIX = Path("contributors/emails")
_LOCKFILE = Path("package-lock.json")
_UNRELATED_THIRD_PARTY_PACKAGES = (
    _RETIRED_AGENT + "-parser",
    _RETIRED_AGENT + "-estree",
)


@dataclass(frozen=True)
class Finding:
    path: Path
    location: str
    excerpt: str
    allowed: bool


def _tracked_and_untracked_files() -> list[Path]:
    result = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard", "-z"],
        cwd=ROOT,
        check=True,
        capture_output=True,
    )
    paths: list[Path] = []
    for raw in result.stdout.split(b"\0"):
        if not raw:
            continue
        path = Path(raw.decode("utf-8", errors="surrogateescape"))
        if (ROOT / path).is_file():
            paths.append(path)
    return sorted(set(paths))


def _matches(value: str) -> bool:
    return bool(_AGENT_PATTERN.search(value) or _ORG_PATTERN.search(value))


def _path_is_exception(path: Path) -> bool:
    try:
        path.relative_to(_PATH_EXCEPTION_PREFIX)
    except ValueError:
        return False
    return True


def _text_is_exception(path: Path, line: str) -> bool:
    if path in _TEXT_EXCEPTIONS or _path_is_exception(path):
        return True
    return path == _LOCKFILE and any(
        package in line.lower() for package in _UNRELATED_THIRD_PARTY_PACKAGES
    )


def audit() -> list[Finding]:
    findings: list[Finding] = []
    for path in _tracked_and_untracked_files():
        allowed_path = _path_is_exception(path)
        if _matches(path.as_posix()):
            findings.append(
                Finding(path=path, location="path", excerpt=path.as_posix(), allowed=allowed_path)
            )

        absolute = ROOT / path
        try:
            if absolute.stat().st_size > _MAX_TEXT_BYTES:
                continue
            raw = absolute.read_bytes()
            if b"\0" in raw[:8192]:
                continue
            text = raw.decode("utf-8")
        except (OSError, UnicodeDecodeError):
            continue

        for line_number, line in enumerate(text.splitlines(), start=1):
            if _matches(line):
                findings.append(
                    Finding(
                        path=path,
                        location=str(line_number),
                        excerpt=line.strip()[:240],
                        allowed=_text_is_exception(path, line),
                    )
                )
    return findings


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Audit the worktree for retired pre-ZORIN product identities."
    )
    parser.add_argument(
        "--show-allowed",
        action="store_true",
        help="also print legally required license and contributor matches",
    )
    args = parser.parse_args()

    findings = audit()
    blocked = [finding for finding in findings if not finding.allowed]
    allowed = [finding for finding in findings if finding.allowed]

    for finding in blocked:
        print(f"BLOCKED {finding.path}:{finding.location}: {finding.excerpt}")
    if args.show_allowed:
        for finding in allowed:
            print(f"ALLOWED {finding.path}:{finding.location}: {finding.excerpt}")

    if blocked:
        print(f"Identity audit failed: {len(blocked)} blocked match(es), {len(allowed)} allowed.")
        return 1

    print(f"Identity audit passed: 0 blocked matches, {len(allowed)} legal/contributor match(es).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
