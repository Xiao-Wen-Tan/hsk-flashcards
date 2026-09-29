"""Step 11. Final checks on the latest docs/data/words_vNNN.json and every audio file it names.

All pinyin is in lower case since the user's decision of 2026-09-29, so no names are read.
Output: data/reports/validate_vNNN.txt. The script ends with an error when any check fails.
"""
import sys
from pathlib import Path

from common import latest_version_path, next_version_path, read_json, write_new_text
from ttsaudio import mp3_problem
from validate import validate

MAX_BYTES = 4 * 1024 * 1024


def file_problem(path, kind):
    p = Path("docs/audio") / path
    if not p.exists():
        return "missing"
    return mp3_problem(p.read_bytes(), kind)


def main():
    path = latest_version_path("docs/data/words", ".json")
    data = read_json(path)
    results = validate(data, file_problem)
    size = path.stat().st_size
    results["file size"] = [] if size < MAX_BYTES else [f"{path} is {size} bytes, not under 4 MB"]
    results["scrambled codes"] = ["the file contains □, an undecoded glyph"] if "□" in path.read_text(
        encoding="utf-8") else []
    results["version"] = [] if data.get("version") == path.stem.rsplit("_", 1)[1] else [
        f"version {data.get('version')!r} does not match the file name {path.name}"]
    failed = {name: found for name, found in results.items() if found}
    lines = [f"Validation of {path}", "", f"Words: {len(data.get('words', []))}. Themes: {len(data.get('themes', []))}. "
             f"Size: {size / 1e6:.2f} MB.", ""]
    for name, found in results.items():
        lines.append(f"{name}: {'passed' if not found else f'{len(found)} problems'}")
        lines += [f"  {x}" for x in found[:30]]
    report = next_version_path("data/reports/validate", ".txt")
    write_new_text(report, "\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"Report: {report}")
    if failed:
        sys.exit(f"Validation failed: {', '.join(failed)}")


if __name__ == "__main__":
    main()
