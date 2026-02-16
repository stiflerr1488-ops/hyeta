#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile
from datetime import datetime

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"

EXCLUDE_DIRS = {".git", "node_modules", "dist", "__pycache__"}
EXCLUDE_FILES = {".DS_Store"}


def should_skip(path: Path) -> bool:
    rel = path.relative_to(ROOT)
    parts = set(rel.parts)
    if parts & EXCLUDE_DIRS:
        return True
    if path.name in EXCLUDE_FILES:
        return True
    return False


def collect_files() -> list[Path]:
    files: list[Path] = []
    for p in ROOT.rglob("*"):
        if p.is_file() and not should_skip(p):
            files.append(p)
    return sorted(files)


def main() -> None:
    DIST.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d-%H%M%S")
    archive_name = f"hyeta-visual-editor-release-{ts}.zip"
    archive_path = DIST / archive_name

    files = collect_files()

    with ZipFile(archive_path, "w", compression=ZIP_DEFLATED) as zf:
        for f in files:
            rel = f.relative_to(ROOT)
            zf.write(f, rel.as_posix())

    print(str(archive_path))
    print(f"files={len(files)}")


if __name__ == "__main__":
    main()
