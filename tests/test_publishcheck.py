import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))

import publishcheck as pc  # noqa: E402


def test_personal_paths_user_name_and_google_addresses_are_found():
    lines = [
        'data = "./process data/a.csv"',
        'url = "https://script.google.com/macros/s/AKfycbx1234567890abcdefghij/exec"',
        'open("C:/Users/mexx/b.txt")',
    ]
    text = chr(10).join(lines)
    assert pc.scan_text("tools/x.py", text, "mexx") == [
        "tools/x.py:2: a Google Apps Script web app address",
        "tools/x.py:3: a personal Windows path (C:/Users/)",
        "tools/x.py:3: the Windows user name 'mexx'",
    ]
    assert pc.scan_text("tools/x.py", "me and mexico", "me") == []  # names under 4 letters are not searched


def test_only_noreply_emails_are_allowed():
    assert pc.scan_text("a.md", "Co-Authored-By: Claude <noreply@anthropic.com>", "") == []
    assert pc.scan_text("a.md", "by 143559791+Xiao-Wen-Tan@users.noreply.github.com", "") == []
    assert pc.scan_text("a.md", "write to someone@gmail.com", "") == ["a.md:1: an e-mail address (someone@gmail.com)"]
    assert pc.check_identities(["1+x@users.noreply.github.com", "me@school.edu"]) == ["a commit uses the e-mail address me@school.edu"]


def test_docs_holds_only_web_files():
    paths = ["docs/index.html", "docs/.nojekyll", "docs/audio/w/w0001_ab.mp3", "docs/notes.md", "docs/data/x.csv", "tools/a.py"]
    assert pc.check_docs_names(paths) == [
        "docs/notes.md: this kind of file does not belong in the public web root",
        "docs/data/x.csv: this kind of file does not belong in the public web root",
    ]


def test_sizes():
    assert pc.check_sizes({"docs/a.mp3": 60_000_000, "docs/b.mp3": 1}) == ["docs/a.mp3: 60.0 MB, over 50 MB"]
    assert pc.check_sizes({f"docs/{i}.mp3": 40_000_000 for i in range(23)}) == ["docs/: 920 MB, over 900 MB"]


def test_code_gs_keeps_the_placeholder():
    assert pc.check_code_gs("/** x */\nvar SECRET_CODE = 'PASTE-THE-CODE-FROM-THE-APP';\n") == []
    assert pc.check_code_gs("var SECRET_CODE = 'k7mq-2xrt-9pwd-hc4n-fz6b-y3ja';\n") != []


def test_marked_test_addresses_are_allowed():
    # The app's own tests need addresses of the real shape; they carry TEST-FAKE so the check can tell them apart.
    line = 'const URL_OK = "https://script.google.com/macros/s/AKfycbTEST-FAKE-ID-abcdefghij/exec";'
    assert pc.scan_text("tests/js/x.test.mjs", line, "") == []
    assert pc.scan_text("tests/js/x.test.mjs", line.replace("TEST-FAKE-ID", "AAAABBBBCCCC"), "") == [
        "tests/js/x.test.mjs:1: a Google Apps Script web app address",
    ]


def test_only_the_checker_and_its_tests_are_left_unscanned():
    # They hold made-up examples of every problem, so scanning them would always fail.
    assert pc.SELF_FILES == {"tools/publishcheck.py", "tests/test_publishcheck.py"}
