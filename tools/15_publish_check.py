"""Step 15. Check what a push would publish, before every push to the PUBLIC repository.

Reads the files git tracks and the commit identities, and prints one line per problem:
personal Windows paths or the Windows user name, Google Sheet or web app addresses, e-mail
addresses, a real secret code in Code.gs, files that do not belong in docs/, and files that
are too big. Exits with 1 when there is a problem. It writes nothing.
Run from the project root:  python tools/15_publish_check.py
"""
import os
import subprocess
import sys
from pathlib import Path

import publishcheck as pc


def git(*args):
    return subprocess.run(["git", *args], capture_output=True, text=True, encoding="utf-8", check=True).stdout


def main():
    files = [p for p in git("ls-files", "-z").split("\0") if p]
    username = os.environ.get("USERNAME", "")
    problems = []
    sizes = {}
    for path in files:
        full = Path(path)
        if not full.is_file():
            continue
        sizes[path] = full.stat().st_size
        if not pc.is_binary(path) and path not in pc.SELF_FILES:
            text = full.read_text(encoding="utf-8", errors="replace")
            problems += pc.scan_text(path, text, username)
            if path == "tools/apps_script/Code.gs":
                problems += pc.check_code_gs(text)
    problems += pc.check_docs_names(files)
    problems += pc.check_sizes(sizes)
    problems += pc.check_identities(git("log", "--format=%ae%n%ce").split())
    site = sum(b for p, b in sizes.items() if p.startswith("docs/"))
    print(f"{len(files)} tracked files, docs/ {site / 1e6:.1f} MB")
    for p in problems:
        print(f"PROBLEM {p}")
    print("OK, nothing private or oversized found" if not problems else f"{len(problems)} problems")
    return 1 if problems else 0


if __name__ == "__main__":
    sys.exit(main())
