"""Choosing, checking and scoring example sentences.

A card's sentence is taken from its PDF entry when one is usable, else Claude writes one.
"Easy" is measured per character. A character's level is the lowest HSK level of any card
that contains it, so 我 is level 1 and 餐 (in 餐厅, HSK 4) is level 4.
"""
import re
from collections import Counter

from pdfbody import PLACEHOLDER, contains_head, fill_placeholder

_HANZI = re.compile(r"[\u3007\u4e00-\u9fff]")  # Chinese characters, with the 〇 of years (二〇〇八年)
_DIALOGUE = re.compile(r"甲：|乙：|[AB]：")
PDF_MIN_HANZI, PDF_MAX_CHARS = 3, 40
WRITTEN_MIN, WRITTEN_MAX = 6, 15
UNKNOWN_LEVEL = 7


def char_levels(words):
    """{character: lowest HSK level of any card containing it}. 〇, the zero of years, has the level of 零."""
    out = {}
    for w in words:
        for ch in _HANZI.findall(w["hz"]):
            out[ch] = min(out.get(ch, UNKNOWN_LEVEL), w["lv"])
    if "零" in out:
        out.setdefault("〇", out["零"])
    return out


def hanzi_count(sentence):
    return len(_HANZI.findall(sentence))


def _outside_head(sentence, hz):
    """The sentence with every part of the headword removed, so only the other characters are scored."""
    for part in (p for p in hz.split("…") if p):
        sentence = sentence.replace(part, "")
    return sentence


def hard_chars(sentence, hz, limit, levels):
    """Characters outside the headword whose level is above `limit` (unknown characters count as hard)."""
    return [ch for ch in _HANZI.findall(_outside_head(sentence, hz)) if levels.get(ch, UNKNOWN_LEVEL) > limit]


def pdf_problem(sentence, hz):
    """Why a filled-in PDF sentence cannot be used, or None when it can."""
    if sentence is None:
        return "the ～ marks do not match the headword"
    if PLACEHOLDER in sentence or "□" in sentence:
        return "undecoded or unfilled text"
    if not contains_head(sentence, hz):
        return "the headword is missing"
    if re.search(r"[a-z]", sentence):
        return "stray Latin letters"
    if _DIALOGUE.search(sentence):
        return "a two-speaker dialogue"
    if len(sentence) > PDF_MAX_CHARS:
        return f"longer than {PDF_MAX_CHARS} characters"
    if hanzi_count(sentence) < PDF_MIN_HANZI:
        return "too short"
    return None


def choose_pdf_sentence(word, levels):
    """The best usable PDF sentence of a word as (sentence, ref), or None.

    word["sents"] holds [sentence, ref] pairs that may contain ～. The best sentence has the
    fewest characters above the word's level (at least level 2), then the fewest characters.
    """
    limit = max(word["lv"], 2)
    best = None
    for raw, ref in word["sents"]:
        s = fill_placeholder(raw, word["hz"])
        if pdf_problem(s, word["hz"]) is not None:
            continue
        score = (len(hard_chars(s, word["hz"], limit, levels)), len(s))
        if best is None or score < best[0]:
            best = (score, s, ref)
    return (best[1], best[2]) if best else None


def written_limit(lv):
    """The highest character level allowed in a written sentence, which is HSK 2 for levels 1 and 2,
    the word's own level for 3 and 4, and HSK 4 for levels 5 and 6."""
    return min(max(lv, 2), 4)


def written_problems(sentence, word, levels):
    """Every rule a newly written sentence breaks (an empty list means it is accepted).

    The rules: 6 to 15 Chinese characters, ends with 。！ or ？, contains the headword exactly
    (each half of a pattern word, in order), no Latin letters, no ～, and at most one character
    above written_limit(level) outside the headword.
    """
    s, hz = sentence.strip(), word["hz"]
    problems = []
    n = hanzi_count(s)
    if not WRITTEN_MIN <= n <= WRITTEN_MAX:
        problems.append(f"{n} Chinese characters, not {WRITTEN_MIN} to {WRITTEN_MAX}")
    if not s or s[-1] not in "。！？":
        problems.append("does not end with 。！ or ？")
    if not contains_head(s, hz):
        problems.append("does not contain the headword exactly")
    if re.search(r"[A-Za-z~～]", s):
        problems.append("contains Latin letters or ～")
    hard = hard_chars(s, hz, written_limit(word["lv"]), levels)
    if len(hard) > 1:
        problems.append(f"too many hard characters: {''.join(hard)}")
    return problems


def english_problems(en):
    """Rules for an English translation: not empty, no Chinese characters, at most 200 characters,
    and it ends like a sentence (. ! ? or a closing quote or bracket)."""
    en = (en or "").strip()
    if not en:
        return ["empty translation"]
    problems = []
    if _HANZI.search(en):
        problems.append("Chinese characters in the translation")
    if len(en) > 200:
        problems.append("translation longer than 200 characters")
    if en[-1] not in ".!?\"')”’":
        problems.append("translation does not end with . ! or ?")
    return problems


def check_answers(inputs, outputs, key_field, check_row):
    """Match one batch agent's rows to its input rows by id and collect every problem.

    key_field: the input column the answer must copy exactly ("hz" for written sentences,
    "sentence" for translations and checks). check_row(input_row, answer_row) gives the content
    problems. Returns (problems, {id: answer_row}).
    """
    want = {r["id"]: r for r in inputs}
    problems, got, counts = [], {}, {}
    for r in outputs:
        rid = (r.get("id") or "").strip()
        counts[rid] = counts.get(rid, 0) + 1
        if rid not in want:
            problems.append(f"{rid}: not in the input")
            continue
        if (r.get(key_field) or "").strip() != want[rid][key_field]:
            problems.append(f"{rid}: {key_field} {r.get(key_field)!r} differs from the input")
        problems += [f"{rid}: {p}" for p in check_row(want[rid], r)]
        got[rid] = r
    problems += [f"{rid}: answered {n} times" for rid, n in counts.items() if n > 1 and rid in want]
    problems += [f"{rid}: missing" for rid in want if rid not in counts]
    return problems, got


def verdict_problems(row, answer, word, levels):
    """Problems in the checker's answer for one sampled row.

    The verdict must be OK or FIX. A FIX needs fixed_en, a corrected translation. It may also
    give fixed_sentence, which must then follow the rules for written sentences.
    """
    verdict = (answer.get("verdict") or "").strip()
    if verdict not in ("OK", "FIX"):
        return [f"verdict {verdict!r} is not OK or FIX"]
    if verdict == "OK":
        return []
    problems = [f"fixed_en: {p}" for p in english_problems(answer.get("fixed_en"))]
    fixed = (answer.get("fixed_sentence") or "").strip()
    if fixed:
        problems += [f"fixed_sentence: {p}" for p in written_problems(fixed, word, levels)]
    return problems


def redo_batches(sample, fixed_ids):
    """Batches whose sampled rows needed two or more fixes, as sorted batch names."""
    counts = Counter(r["batch"] for r in sample if r["id"] in fixed_ids)
    return sorted(b for b, n in counts.items() if n >= 2)


def fix_share(sample, fixed_ids, src):
    """The share of sampled rows from one source ("claude" or "pdf") that needed a fix."""
    rows = [r for r in sample if r["src"] == src]
    return sum(1 for r in rows if r["id"] in fixed_ids) / len(rows) if rows else 0.0


def spotcheck_problems(generated, reviewed):
    """Check the user's spot-check sheet against the one step 7c wrote.

    generated and reviewed are lists of CSV rows. Every generated id must appear exactly once,
    with ok Y or N (either case), and every N row needs a usable better_en.
    Returns (problems, [(id, better_en)] for the N rows).
    """
    want = {r["id"] for r in generated}
    problems, wrong, counts = [], [], Counter()
    for r in reviewed:
        rid, ok = (r.get("id") or "").strip(), (r.get("ok") or "").strip().upper()
        counts[rid] += 1
        if rid not in want:
            problems.append(f"{rid!r}: not in the spot-check sheet")
        elif ok not in ("Y", "N"):
            problems.append(f"{rid}: ok is {r.get('ok')!r}, write Y or N")
        elif ok == "N":
            better = (r.get("better_en") or "").strip()
            problems += [f"{rid}: better_en: {p}" for p in english_problems(better)]
            wrong.append((rid, better))
    problems += [f"{rid}: appears {n} times" for rid, n in counts.items() if n > 1 and rid in want]
    problems += [f"{rid}: missing from the reviewed sheet" for rid in sorted(want) if rid not in counts]
    return problems, wrong
