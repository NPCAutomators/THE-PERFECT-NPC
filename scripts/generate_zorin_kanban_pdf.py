#!/usr/bin/env python3
"""Regenerate the ZORIN Kanban PDF from its rebranded text source."""

from __future__ import annotations

import argparse
import html
import os
import subprocess
import tempfile
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PDF_PATH = ROOT / "docs/zorin-kanban-v1-spec.pdf"
TEXT_PATH = ROOT / "docs/zorin-kanban-v1-spec.txt"


def extract_source() -> None:
    result = subprocess.run(
        ["pdftotext", "-layout", str(PDF_PATH), "-"],
        check=True,
        capture_output=True,
        text=True,
    )
    TEXT_PATH.write_text(result.stdout, encoding="utf-8")


def render_pdf() -> None:
    text = TEXT_PATH.read_text(encoding="utf-8")
    pages = text.split("\f")
    sections = "\n".join(
        f'<section class="page"><pre>{html.escape(page.rstrip())}</pre></section>'
        for page in pages
        if page.strip()
    )
    document = f"""<!doctype html>
<html><head><meta charset="utf-8"><style>
@page {{ size: A4; margin: 14mm; }}
body {{ margin: 0; color: #0f1d2d; background: white; }}
.page {{ page-break-after: always; min-height: 260mm; }}
.page:last-child {{ page-break-after: auto; }}
pre {{ margin: 0; white-space: pre-wrap; font: 8.4pt/1.28 'Liberation Mono', monospace; }}
</style></head><body>{sections}</body></html>"""

    with tempfile.TemporaryDirectory(prefix="zorin-kanban-pdf-") as temp_value:
        temp = Path(temp_value)
        source = temp / "zorin-kanban-v1-spec.html"
        source.write_text(document, encoding="utf-8")
        profile = temp / "lo-profile"
        env = os.environ.copy()
        env["HOME"] = str(temp)
        subprocess.run(
            [
                "soffice",
                "--headless",
                f"-env:UserInstallation=file://{profile}",
                "--convert-to",
                "pdf",
                "--outdir",
                str(temp),
                str(source),
            ],
            check=True,
            env=env,
        )
        generated = temp / "zorin-kanban-v1-spec.pdf"
        PDF_PATH.write_bytes(generated.read_bytes())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--extract-pdf",
        action="store_true",
        help="extract text from the current PDF before rendering",
    )
    args = parser.parse_args()
    if args.extract_pdf:
        extract_source()
    if not TEXT_PATH.exists():
        raise SystemExit(f"Missing source text: {TEXT_PATH}")
    render_pdf()
    print(f"Generated {PDF_PATH.relative_to(ROOT)} from {TEXT_PATH.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
