"""Shared helpers for the build scripts.

Run every script from the project root, for example `python tools/02_extract_pdfs.py`.
Outputs are never overwritten. Each run writes new `_vNNN` files, and writers open
files with mode "x" so an existing file can never be replaced.
"""
import csv
import json
import re
from pathlib import Path

_VERSION = re.compile(r"_v(\d{3})$")


def _existing_versions(stem):
    """Version numbers already used by files or folders named `<stem>_vNNN` plus any suffix."""
    stem = Path(stem)
    if not stem.parent.exists():
        return []
    found = set()
    for p in stem.parent.iterdir():
        base = p.name.split(".", 1)[0]
        m = _VERSION.search(base)
        if m and base[: m.start()] == stem.name:
            found.add(int(m.group(1)))
    return sorted(found)


def next_versions(**specs):
    """Reserve one shared version number for several outputs of the same run.

    Example, when the highest existing version of either stem is 2:
    next_versions(map=("data/decode/cidmap", ".csv"), report=("data/reports/decode", ".txt"))
    returns {"map": Path("data/decode/cidmap_v003.csv"), "report": Path("data/reports/decode_v003.txt")}.
    """
    n = 1 + max([0] + [v for stem, _ in specs.values() for v in _existing_versions(stem)])
    paths = {}
    for key, (stem, suffix) in specs.items():
        stem = Path(stem)
        stem.parent.mkdir(parents=True, exist_ok=True)
        paths[key] = stem.parent / f"{stem.name}_v{n:03d}{suffix}"
    return paths


def next_version_path(stem, suffix):
    return next_versions(only=(stem, suffix))["only"]


def all_version_paths(stem, suffix):
    """[(version, path)] for every existing `<stem>_vNNN<suffix>`, oldest first."""
    stem = Path(stem)
    out = []
    for v in _existing_versions(stem):
        p = stem.parent / f"{stem.name}_v{v:03d}{suffix}"
        if p.exists():
            out.append((v, p))
    return out


def latest_version_path(stem, suffix):
    found = all_version_paths(stem, suffix)
    if not found:
        raise FileNotFoundError(f"No {stem}_vNNN{suffix} yet. Run the earlier step first.")
    return found[-1][1]


def write_new_text(path, text):
    with open(path, "x", encoding="utf-8", newline="\n") as f:
        f.write(text)


def write_new_json(path, obj):
    write_new_text(path, json.dumps(obj, ensure_ascii=False, indent=1) + "\n")


def write_new_jsonl(path, rows):
    write_new_text(path, "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))


def write_new_csv(path, header, rows, excel=False):
    """excel=True adds a byte-order mark so Excel shows Chinese correctly."""
    with open(path, "x", encoding="utf-8-sig" if excel else "utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def read_jsonl(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))
