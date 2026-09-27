"""Group PDF text runs into numbered vocabulary entries."""
import re

ENTRY_X = 12.0                     # entry numbers and section letters sit at x = 10
TABLE_HEADER_FIRST = [2855, 1897]  # first cell of the column-title line in the HSK 5 and 6 files
BRACKETS = {835, 836}              # glyphs that wrap headwords in the HSK 1 to 4 files
FULL_STOP = 822                    # 。, sometimes stuck to the end of a headword
FOOTER = re.compile(r"sayninhao|\d{4}/\d{1,2}/\d{1,2}")
HEAD_GAP = re.compile(r"\s*…*\s*")  # a space or "……" drawn between two parts of a headword


def drop_noise(runs):
    """Remove section letters (A, B...), the column-title line and stray footer text."""
    runs = list(runs)
    header_lines = {(r.page, r.y) for r in runs
                    if r.kind == "c" and r.x < ENTRY_X and r.cids == TABLE_HEADER_FIRST}
    for r in runs:
        if (r.page, r.y) in header_lines:
            continue
        if r.kind == "l" and r.x < ENTRY_X and re.fullmatch(r"[A-Z]", r.text.strip()):
            continue
        if r.kind == "l" and FOOTER.search(r.text):
            continue
        yield r


def _entry_number(r, expected):
    """The entry number a left-margin run starts, or None.

    Spaces inside the number are ignored, because some files print 318 as "31 8 ".
    The next expected number or the one after it is accepted, because the HSK 4
    file skips 677.
    """
    if r.kind != "l" or r.x >= ENTRY_X:
        return None
    digits = re.sub(r"\s", "", r.text)
    if not (digits.isascii() and digits.isdigit()):
        return None
    n = int(digits)
    return n if expected <= n <= expected + 1 else None


def group_entries(runs):
    """Split the runs into entries. An entry starts where the next expected number sits at the left margin.

    Neighbouring runs of the same kind are merged, so pinyin split across fonts
    (" b" + "ā" + " num. eight ") becomes one Latin token. A headword drawn in two
    parts with a space or "……" between them becomes one Chinese token. An entry
    that follows a skipped number lists it under "skipped".
    """
    entries, current, expected = [], None, 1
    for r in drop_noise(runs):
        n = _entry_number(r, expected)
        if n is not None:
            current = {"n": n, "page": r.page, "tokens": []}
            if n > expected:
                current["skipped"] = list(range(expected, n))
            entries.append(current)
            expected = n + 1
            continue
        if current is None:
            continue  # page title before entry 1
        tokens = current["tokens"]
        if (r.kind == "c" and len(tokens) == 2 and tokens[0][0] == "c"
                and HEAD_GAP.fullmatch(tokens[1][1])):
            tokens.pop()  # the gap inside a split headword, not the pinyin
        if tokens and tokens[-1][0] == r.kind:
            if r.kind == "c":
                tokens[-1][1].extend(r.cids)
            else:
                tokens[-1][1] += r.text
        else:
            tokens.append(["c", list(r.cids)] if r.kind == "c" else ["l", r.text])
    return entries


def head_of(entry):
    """The headword's glyph codes, without wrapping brackets or a trailing full stop."""
    tokens = entry["tokens"]
    if not tokens or tokens[0][0] != "c":
        return []
    cids = [c for c in tokens[0][1] if c not in BRACKETS]
    while cids and cids[-1] == FULL_STOP:
        cids.pop()
    return cids


def latin_of(entry):
    """The Latin text right after the headword: pinyin, then part of speech and English."""
    tokens = entry["tokens"]
    return tokens[1][1] if len(tokens) > 1 and tokens[1][0] == "l" else ""
