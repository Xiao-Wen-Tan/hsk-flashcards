"""Step 14 (for checking only). Build a local copy of the site that runs on the test words.

Output: .claude/scratch/smoke_vNNN/ (git-ignored), holding
  - a copy of docs/,
  - the 61-word test fixture (tests/js/fixtures/words_fixture.json) under the name that
    docs/js/release.js gives WORDS_FILE, unless docs/ already has that file,
  - a short silent MP3 for every word and sentence audio path of the fixture,
  - the stroke data of the fixture's characters (fetched as in step 12).
Serve it with:  cd .claude/scratch/smoke_vNNN && python -m http.server 8123
then open http://localhost:8123/ in Chrome. Nothing in docs/ is changed.
"""
import json
import re
import shutil
import sys
from pathlib import Path

from common import next_version_path, read_json
from strokedata import HANZI_WRITER, HANZI_WRITER_DATA, download, vendor

# One MPEG-1 Layer III frame (128 kbit/s, 44.1 kHz) whose audio data is all zeros, which
# players decode as silence. 38 frames last about one second.
_FRAME = bytes([0xFF, 0xFB, 0x90, 0x00]) + bytes(413)


def silent_mp3(frames=38):
    return _FRAME * frames


def words_file_name():
    text = Path("docs/js/release.js").read_text(encoding="utf-8")
    return re.search(r"WORDS_FILE = '([^']+)'", text).group(1)


def main():
    out = next_version_path(".claude/scratch/smoke", "")
    shutil.copytree("docs", out)
    fixture = read_json("tests/js/fixtures/words_fixture.json")
    words_path = out / words_file_name()
    if not words_path.exists():
        words_path.parent.mkdir(parents=True, exist_ok=True)
        with open(words_path, "x", encoding="utf-8") as f:
            json.dump(fixture, f, ensure_ascii=False)
    for w in fixture["words"]:
        for rel in (w["au"], w["ex"]["au"]):
            path = out / "audio" / rel
            path.parent.mkdir(parents=True, exist_ok=True)
            if not path.exists():
                with open(path, "xb") as f:
                    f.write(silent_mp3())
    tally = vendor(out, fixture["words"], download(HANZI_WRITER), download(HANZI_WRITER_DATA))
    print(f"Smoke site: {out}")
    print(f"Stroke files new {tally['new']}, already there {tally['same']}, missing {''.join(tally['missing']) or 'none'}")
    print(f"Serve it with:  cd {out.as_posix()} && python -m http.server 8123")
    return 0


if __name__ == "__main__":
    sys.exit(main())
