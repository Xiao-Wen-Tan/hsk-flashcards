"""Checks that make a push to the PUBLIC GitHub repository safe (used by 15_publish_check.py).

Each check takes plain values and returns a list of problems (empty when all is well), so
pytest can test it without git. For example, scan_text('tools/x.py', 'open("C:/Users/me/a")', 'me')
returns ['tools/x.py:1: a personal Windows path (C:/Users/)', "tools/x.py:1: the Windows user name 'me'"].
"""
import re

# Commit identities that may appear in public history: GitHub's private noreply address of
# the user and Claude's co-author line.
ALLOWED_EMAIL_ENDINGS = ("@users.noreply.github.com", "noreply@anthropic.com")

# File types that may be published in docs/ (the web root). Anything else, such as a .md note,
# a .csv or a .py file, must stay out of it.
DOCS_TYPES = {".html", ".css", ".js", ".json", ".webmanifest", ".png", ".mp3", ".txt"}
DOCS_NAMES = {".nojekyll"}

BINARY_TYPES = {".mp3", ".png", ".pdf", ".jpg", ".jpeg", ".gif", ".ico", ".woff", ".woff2", ".zip"}

MAX_FILE_MB = 50  # GitHub warns above 50 MB and refuses files above 100 MB
MAX_SITE_MB = 900  # GitHub Pages sites may be at most 1 GB

# The checker, its tests and the plan that built them hold made-up examples of every problem,
# so they are not scanned.
SELF_FILES = {"tools/publishcheck.py", "tests/test_publishcheck.py", ".claude/plans/2026-09-28-plan5-sync-publish.md"}

PLACEHOLDER_LINE = "var SECRET_CODE = 'PASTE-THE-CODE-FROM-THE-APP';"

_PATTERNS = [
    (re.compile(r"[A-Za-z]:[\\/]+Users[\\/]", re.I), "a personal Windows path (C:/Users/)"),
    # An address whose ID holds TEST-FAKE is a made-up one from the app's own tests, so it is allowed.
    (re.compile(r"script\.google\.com/(?:a/macros/[^/\s]+|macros)/s/(?![A-Za-z0-9_-]*TEST-FAKE)[A-Za-z0-9_-]{20,}"), "a Google Apps Script web app address"),
    (re.compile(r"docs\.google\.com/spreadsheets/d/[A-Za-z0-9_-]{20,}"), "a Google Sheet address"),
]
_EMAIL = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}")


def is_binary(path):
    return any(path.lower().endswith(ext) for ext in BINARY_TYPES)


def scan_text(path, text, username=""):
    """Personal paths, the Windows user name, Google addresses and e-mail addresses in one file."""
    problems = []
    for n, line in enumerate(text.splitlines(), 1):
        for pattern, what in _PATTERNS:
            if pattern.search(line):
                problems.append(f"{path}:{n}: {what}")
        if len(username) >= 4 and username.lower() in line.lower():
            problems.append(f"{path}:{n}: the Windows user name '{username}'")
        for email in _EMAIL.findall(line):
            if not email.lower().endswith(ALLOWED_EMAIL_ENDINGS):
                problems.append(f"{path}:{n}: an e-mail address ({email})")
    return problems


def check_docs_names(paths):
    """Only web files in docs/, the public web root."""
    problems = []
    for p in paths:
        if not p.startswith("docs/"):
            continue
        name = p.rsplit("/", 1)[-1]
        ext = "." + name.rsplit(".", 1)[-1].lower() if "." in name[1:] else ""
        if name not in DOCS_NAMES and ext not in DOCS_TYPES:
            problems.append(f"{p}: this kind of file does not belong in the public web root")
    return problems


def check_sizes(sizes):
    """sizes is {path: bytes}. No file over 50 MB, and docs/ under 900 MB."""
    problems = [f"{p}: {b / 1e6:.1f} MB, over {MAX_FILE_MB} MB" for p, b in sorted(sizes.items()) if b > MAX_FILE_MB * 1e6]
    site = sum(b for p, b in sizes.items() if p.startswith("docs/"))
    if site > MAX_SITE_MB * 1e6:
        problems.append(f"docs/: {site / 1e6:.0f} MB, over {MAX_SITE_MB} MB")
    return problems


def check_identities(emails):
    """Author and committer e-mail addresses of every commit that would be pushed."""
    return [f"a commit uses the e-mail address {e}" for e in sorted(set(emails)) if not e.lower().endswith(ALLOWED_EMAIL_ENDINGS)]


def check_code_gs(text):
    """The published script must hold the placeholder, never a real secret code."""
    lines = [line.strip() for line in text.splitlines() if line.strip().startswith("var SECRET_CODE")]
    if lines != [PLACEHOLDER_LINE]:
        return ["tools/apps_script/Code.gs: SECRET_CODE must be the placeholder PASTE-THE-CODE-FROM-THE-APP"]
    return []
