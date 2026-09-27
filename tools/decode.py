"""Work out which glyph code (CID) stands for which Chinese character.

Each PDF entry gives a headword as glyph codes plus readable pinyin. The public
list gives the same words as real characters. Matching the two on pinyin and
length tells us the characters behind the codes. For example, the entry with
codes [4545, 4545] and pinyin "bàba" can only be 爸爸, so code 4545 is 爸.
"""
import re
import unicodedata
from collections import Counter, defaultdict
from typing import NamedTuple

from pinyin_norm import norm, toneless

MISSING = "□"


class Cand(NamedTuple):
    hz: str
    py: str
    level: int
    py_norm: str
    py_toneless: str


def build_index(public_words):
    """Every reading of every public word, grouped by character count."""
    index = defaultdict(list)
    for w in public_words:
        for form in w["forms"]:
            py = form["transcriptions"]["pinyin"]
            index[len(w["simplified"])].append(Cand(w["simplified"], py, w["hsk"], norm(py), toneless(py)))
    return index


# Parts of speech the PDFs print after the pinyin, sometimes with no space: " àiv. love ",
# " lemp. used at the end ", " desa. of ". Long ones sometimes lose their dot: " pàngadj fat ".
_POS = re.compile(r"(?:num|adj|adv|pron|prep|conj|part|int|aux|mw|nm|mp|vm|sa|v|n|m)\."
                  r"|(?:num|adj|adv|pron|prep|conj|aux)(?![a-z])")
_VOWELS = set("aeiouü")


def _boundary(latin, keep, length):
    """How cleanly the first `length` pinyin letters of `latin` end: "strong", "weak" or None.

    `keep` is norm or toneless. Strong means the next character is a space, the end
    of the text, punctuation other than ".", or a part of speech such as "n.".
    In " bā num. eight " the pinyin bā ends strongly, but bān does not ("um." follows).
    Weak means English follows with no space, as in " dǎ jiāodaohave dealings ".
    That is only allowed when the next letter cannot continue the syllable, so
    ā in " ān adj. safe " gets None, because "n" could make it ān.
    """
    s = unicodedata.normalize("NFC", latin.replace("u:", "ü").replace("U:", "Ü"))
    kept, i = 0, 0
    while i < len(s) and kept < length:
        kept += len(keep(s[i]))
        i += 1
    while i < len(s) and unicodedata.combining(s[i]):
        i += 1  # a tone mark that NFC could not join to its letter
    rest = s[i:]
    if not rest or rest[0].isspace() or _POS.match(rest):
        return "strong"
    if not rest[0].isalpha():
        return None if rest[0] in ".'’‘-·" or rest[0].isdigit() else "strong"
    last, nxt = toneless(s[:i])[-1:], toneless(rest[0])
    if last in ("g", "r"):
        return "weak"
    if last == "n":
        return None if nxt == "g" or nxt in _VOWELS else "weak"
    return None if nxt in _VOWELS or nxt in ("n", "r") else "weak"


def candidates(head_len, latin, file_level, index, use_level=True):
    """Public words that could be this PDF entry, as a sorted list of character strings.

    The entry's Latin text starts with its pinyin, for example " bāng v. help ".
    A word matches when its pinyin is the start of that text and ends at a word
    boundary (see _boundary), so 班 bān does not match " bā num. eight ".
    The search goes in four steps and stops at the first that finds something:
    exact tones with a strong boundary, no tones with a strong boundary, then the
    same two with a weak boundary. Tones are ignored as a fallback because the PDF
    writes tone changes such as bú kèqi. Only the longest matching pinyin is kept,
    so 帮 bāng beats 八 bā in " bāng v. help ".
    The HSK 1 to 4 files repeat lower levels, so words at or below the file's level
    are preferred there. In the HSK 5 and 6 files the level must be equal.
    The public list's levels do not always match the PDFs' levels (号 hào is level 2
    in the list but sits in the HSK 1 PDF, next to 好, which also reads hào), so
    use_level=False returns every equally good match. solve() takes both lists.
    """
    text, text_tl = norm(latin), toneless(latin)
    pool = index.get(head_len, [])
    hits = []
    for strength in ("strong", "weak"):
        for keep, field, whole in ((norm, "py_norm", text), (toneless, "py_toneless", text_tl)):
            hits = [c for c in pool if getattr(c, field) and whole.startswith(getattr(c, field))
                    and _boundary(latin, keep, len(getattr(c, field))) == strength]
            if hits:
                break
        if hits:
            break
    if not hits:
        return []
    longest = max(len(c.py_norm) for c in hits)
    hits = [c for c in hits if len(c.py_norm) == longest]
    in_level = [c for c in hits if use_level
                and (c.level <= file_level if file_level <= 4 else c.level == file_level)]
    return sorted({c.hz for c in (in_level or hits)})


def _consistent(hz, head, fwd, rev):
    for cid, ch in zip(head, hz):
        if fwd.get(cid, ch) != ch or rev.get(ch, cid) != cid:
            return False
    return True


def live_candidates(head, hzs, fwd, rev):
    """Candidates that still agree with everything learned so far."""
    return [hz for hz in hzs if _consistent(hz, head, fwd, rev)]


def solve(items, seed, fallback=None):
    """Fill the code-to-character map.

    items: one (head_cids, candidate_strings) pair per PDF entry.
    seed: codes already known, {cid: char}.
    fallback: optional second list of pairs, used only after items has learned all
    it can. Pass candidates(..., use_level=False) as items and the level-preferred
    candidates as fallback, so the level preference only settles what is still open.
    Each round, every entry votes for the positions where all its remaining
    candidates agree. The best-supported votes are applied, one code to one
    character and one character to one code, and rounds repeat until a round
    learns nothing. Returns (map, conflicts), where conflicts lists codes that
    received votes for more than one character.
    """
    if fallback is not None:
        fwd, conflicts = solve(items, seed)
        fwd, later = solve(fallback, fwd)
        return fwd, {**later, **conflicts}
    fwd = dict(seed)
    rev = {ch: cid for cid, ch in fwd.items()}
    conflicts = {}
    while True:
        votes = defaultdict(Counter)
        for head, hzs in items:
            live = live_candidates(head, hzs, fwd, rev)
            if not live:
                continue
            for i, cid in enumerate(head):
                if cid in fwd:
                    continue
                chars = {hz[i] for hz in live}
                if len(chars) == 1:
                    votes[cid][chars.pop()] += 1
        learned = 0
        for cid, count in sorted(votes.items(), key=lambda kv: (-kv[1].most_common(1)[0][1], kv[0])):
            ch, _ = count.most_common(1)[0]
            if len(count) > 1:
                conflicts[cid] = dict(count)
            if ch in rev:
                conflicts.setdefault(cid, dict(count))
                continue
            fwd[cid], rev[ch] = ch, cid
            learned += 1
        if not learned:
            return fwd, conflicts


def decode_cids(cids, fwd):
    return "".join(fwd.get(c, MISSING) for c in cids)


def body_text(entry, fwd):
    """Everything after the headword and its Latin text, with codes turned into characters."""
    return "".join(decode_cids(v, fwd) if kind == "c" else v for kind, v in entry["tokens"][2:])


def coverage(entries, fwd):
    """Counts for the report.

    Returns (per_file, body_total, body_ok, unresolved, example, all_cids):
    per-file counts of entries, fully decoded headwords and fully decoded bodies;
    body glyph totals; a Counter of unknown codes; one example entry per unknown
    code; and every code seen.
    """
    per_file = defaultdict(lambda: {"entries": 0, "heads_ok": 0, "bodies_ok": 0})
    body_total = body_ok = 0
    unresolved, example, all_cids = Counter(), {}, set()
    for e in entries:
        f = per_file[e["file"]]
        f["entries"] += 1
        f["heads_ok"] += all(c in fwd for c in e["head"])
        body = [c for kind, v in e["tokens"][1:] if kind == "c" for c in v]
        ok = sum(c in fwd for c in body)
        body_total += len(body)
        body_ok += ok
        f["bodies_ok"] += ok == len(body)
        for c in e["head"] + body:
            all_cids.add(c)
            if c not in fwd:
                unresolved[c] += 1
                example.setdefault(c, f'HSK{e["file"]} #{e["n"]}')
    return per_file, body_total, body_ok, unresolved, example, all_cids
