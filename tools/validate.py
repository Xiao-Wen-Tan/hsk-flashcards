"""Final checks on the app's word data file.

Covers every rule in .claude/plans/words-json-schema.md and the data checks in the spec's
Verification list. Each check returns a list of problems; an empty list means it passed.
"""
import itertools
import re
import unicodedata
from collections import Counter

from distract import usable_choices
from meaning import LEFTOVER_LABEL
from pdfbody import contains_head
from pinyin_norm import toneless
from pinyin_text import card_py, joints_of_py, py_base, py_problems, syllable_count, syllables_of_py
from pinyincheck import names_of

POS_LABELS = {"n.", "v.", "adj.", "adv.", "m.", "pron.", "prep.", "conj.", "part.", "num.", "int."}
_HANZI = re.compile(r"[\u3007\u4e00-\u9fff]")  # Chinese characters, with the 〇 of years (二〇〇八年)
_WORD_ID = re.compile(r"^w\d{4}$")
_PYNUM = re.compile(r"^[a-zü]+[1-5]( [a-zü]+[1-5])*$")
_HZ = re.compile(r"^[\u4e00-\u9fff]+$|^([\u4e00-\u9fff]+…)+$")
_AUDIO = {"w": re.compile(r"^w/w\d{4}_[0-9a-f]{8}\.mp3$"), "s": re.compile(r"^s/w\d{4}_[0-9a-f]{8}\.mp3$")}
_WORD_KEYS = {"id", "hz", "py", "pyNum", "pyBase", "syl", "lv", "pos", "en", "enShort", "theme", "ord", "au",
              "noDistract", "ex"}
_EX_KEYS = {"hz", "py", "en", "au", "src"}


# The tones a 一 or 不 may show in a sentence, where the tone changes follow the next word.
_TONES_OF = {("一", "yi1"): ["yi1", "yi2", "yi4", "yi5"], ("不", "bu4"): ["bu4", "bu2", "bu5"]}
# Where render (Plan 3b sentpinyin) starts a sentence, so a capital may stand there. A quotation
# after a colon also starts one, with or without quotation marks ('shuō: "Nǐ kàn."', "shuō: Nǐ kàn.").
_SENTENCE_START = r'(?:^|[.!?]"?\s+|:\s+)"?\(?'
# The headword's syllables may stand as a word of their own or inside a longer word, as long as
# they start and end at syllable edges there. A longer word holds them in a known word (男人
# "nánrén" for the card 男), with a joined particle, suffix or result ("kànzhe", "jiàshǐyuán",
# "xiěhǎo") and in a number word ("liǎngbǎi" for 百). Inside a word a syllable starts after a
# vowel, n, ng or r, and one that starts with a, o or e starts after an apostrophe ("kě'ài"). It
# ends before a consonant or an apostrophe, and before n, g or r only when a vowel follows them,
# because then they start the next syllable ("nánrén"). So 户 "hù" is not shown by "zhù".
_VOWELS = "aeiouüāáǎàēéěèīíǐìōóǒòūúǔùǖǘǚǜ"
_WORD_START = r"(?<![^\W\d_])(?<!')"
_BEFORE = rf"(?:{_WORD_START}|(?<=[{_VOWELS}nr])|(?<=ng))"
_BEFORE_AOE = rf"(?:{_WORD_START}|(?<='))"
_AFTER = rf"(?:(?![^\W\d_])|(?=[bcdfhjklmpqstwxyz'])|(?=[gnr][{_VOWELS}]))"


def head_forms(hz, py, pynum):
    """Every way the card pinyin of a headword (or of one half of a pattern word) may appear in a sentence.

    The card's own py, and the same with another tone on a 一 or 不 that ends the headword, because
    its tone follows the next word, so the card 不 "bù" appears as "bú" in "Wǒ bú shì xuésheng." and
    the card 一 "yī" as "yí" in "yí gè". A 一 or 不 inside the headword keeps the tone its card
    shows, so the card 受不了 "shòubuliǎo" never appears as "shòubùliǎo".
    """
    nums = pynum.split()
    joints, shown = joints_of_py(py, nums), syllables_of_py(py, nums)
    if joints is None or shown is None or len(nums) != len(hz):
        return {py}
    options = [[s] for s in shown[:-1]] + [_TONES_OF.get((hz[-1], shown[-1]), [shown[-1]])]
    return {py} | {card_py(list(c), joints, py[:1].isupper()) for c in itertools.product(*options)}


def name_starts(sentence, names):
    """Indexes of the sentence characters where a word of a name starts that takes a capital.

    names: {hz: (words, capitals)} as Plan 3b pinyincheck.names_of gives them, which are the names of
    data/manual/capitals (Plan 3a pinyin_text.name_rows) and every card whose py starts with a
    capital. So with the row 山东省 (山东 省, Y), 我来自山东省。 gives {3, 5}, and there the card 省 may
    show "Shěng" ("Wǒ láizì Shāndōng Shěng."), because the style sheet capitalises every word of a
    place name. With the card 长城 "Chángchéng", 我去过长城。 gives {3}, so the card 长 may show "Cháng".
    """
    out = set()
    for hz, (parts, flags) in (names or {}).items():
        at = sentence.find(hz)
        while at >= 0:
            offset = at
            for part, flag in zip(parts, flags):
                if flag:
                    out.add(offset)
                offset += len(part)
            at = sentence.find(hz, at + 1)
    return out


def head_py_problem(w, names=None):
    """Why ex.py does not show the headword as on its card, or None.

    ex.py must hold the card's py exactly, except that the tone of a final 一 or 不 may differ
    (head_forms), a word may take a capital where a sentence starts or where a word of a name of
    a card or data/manual/capitals starts (names, see name_starts), and an 儿 ending that
    follows the headword in ex.hz adds its "r" (这 "zhè" in 这儿 "zhèr"). It may stand as a word
    of its own or inside a longer word at syllable edges (_BEFORE and _AFTER), such as a known
    word ("nánrén" for 男, "Chūntiān" for 春), a joined particle ("kànzhe" for 看 and for 着) or a
    number word ("yìqiān" for 千, "jǐshí" for 几). So for 东西 "dōngxi", "Wǒ mǎile hěn duō
    dōngxi." passes, while "... hěn duō Dōngxi." and "... hěn duō dōngxī." do not, and for 户 "hù"
    "zhù" does not. A pattern word is checked half by half.
    """
    sentence = unicodedata.normalize("NFC", w["ex"]["py"])
    halves = [h for h in w["hz"].split("…") if h]
    pys = [p for p in unicodedata.normalize("NFC", w["py"]).split("…") if p]
    nums, k, found = w["pyNum"].split(), 0, 0
    named = name_starts(w["ex"]["hz"], names)
    if len(halves) != len(pys):
        return f"py {w['py']!r} does not have one part per part of hz"
    for half, half_py in zip(halves, pys):
        forms = head_forms(half, half_py, " ".join(nums[k:k + len(half)]))
        k += len(half)
        found = w["ex"]["hz"].find(half, found)
        if half + "儿" in w["ex"]["hz"] and not half.endswith("儿"):
            forms |= {f + "r" for f in forms}
        before = {f: _BEFORE_AOE if f[:1].lower() in "aāáǎàoōóǒòeēéěè" else _BEFORE for f in forms}
        inside = any(re.search(before[f] + re.escape(f) + _AFTER, sentence) for f in forms)
        first = any(re.search(_SENTENCE_START + re.escape(f[:1].upper() + f[1:]) + _AFTER, sentence) for f in forms)
        name = found in named and any(re.search(before[f] + re.escape(f[:1].upper() + f[1:]) + _AFTER, sentence)
                                      for f in forms)
        found += len(half)
        if not (inside or first or name):
            return f"ex.py {w['ex']['py']!r} does not show {half_py!r} as on the card"
    return None


def check_top(data):
    problems = []
    if not re.fullmatch(r"v\d{3}", str(data.get("version", ""))):
        problems.append(f"version {data.get('version')!r} is not like v001")
    if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", str(data.get("generated", ""))):
        problems.append(f"generated {data.get('generated')!r} is not a date like 2026-10-05")
    if not data.get("license"):
        problems.append("license is empty")
    if not isinstance(data.get("themes"), list) or not isinstance(data.get("words"), list):
        problems.append("themes and words must both be lists")
    return problems


def check_themes(themes, words, min_size, max_size):
    """Theme ids t01, t02... in order, order 1..k, names, counts that match, and sizes in range.

    Every theme counts, the Starter Kit included, whose widened rule gives it 40 words.
    """
    problems = []
    counts = Counter(w["theme"] for w in words)
    for k, t in enumerate(themes, start=1):
        if t.get("id") != f"t{k:02d}" or t.get("order") != k:
            problems.append(f"theme {k}: id {t.get('id')!r} and order {t.get('order')!r} should be t{k:02d} and {k}")
        if not t.get("name"):
            problems.append(f"theme {t.get('id')}: no name")
        if t.get("count") != counts.get(t.get("id"), 0):
            problems.append(f"theme {t.get('id')}: count {t.get('count')} but {counts.get(t.get('id'), 0)} words")
        size = counts.get(t.get("id"), 0)
        if not min_size <= size <= max_size:
            problems.append(f"theme {t.get('id')} {t.get('name')}: {size} words, outside {min_size} to {max_size}")
    return problems


def check_word(w, theme_ids, names=None):
    """Every field of one word, against the schema. names: see head_py_problem."""
    wid = w.get("id")
    if set(w) != _WORD_KEYS:
        return [f"{wid}: fields {sorted(set(w) ^ _WORD_KEYS)} are missing or extra"]
    p = []
    if not _WORD_ID.match(wid):
        p.append("id is not like w0001")
    if not _HZ.match(w["hz"]):
        p.append(f"hz {w['hz']!r} is not Chinese characters")
    nums = w["pyNum"].split()
    if not _PYNUM.match(w["pyNum"]):
        p.append(f"pyNum {w['pyNum']!r} is not numbered pinyin")
    else:
        if w["pyBase"] != py_base(nums) or w["syl"] != syllable_count(nums):
            p.append("pyBase or syl does not match pyNum")
        if len(w["hz"]) > 1 and w["hz"].endswith("儿") and nums[-1] == "er5":
            p.append(f"pyNum {w['pyNum']!r} ends in er5, but a neutral 儿 ending is r5")
        p += py_problems(w["hz"], w["py"], w["pyNum"])
    if not w["py"] or re.search(r"\d", w["py"]) or toneless(w["py"].replace("…", "")) != w["pyBase"]:
        p.append(f"py {w['py']!r} does not match pyBase {w['pyBase']!r}")
    card_pinyin_ok = not p
    if w["lv"] not in range(1, 7):
        p.append(f"lv {w['lv']!r} is not 1 to 6")
    if not isinstance(w["pos"], list) or not set(w["pos"]) <= POS_LABELS:
        p.append(f"pos {w['pos']!r} has an unknown label")
    if not w["en"] or len(w["en"]) > 80 or len(w["en"].split(";")) > 3:
        p.append(f"en {w['en']!r} is empty, over 80 characters or over 3 senses")
    if not w["enShort"] or len(w["enShort"]) > 30:
        p.append(f"enShort {w['enShort']!r} is empty or over 30 characters")
    p += [f"{k} {w[k]!r} contains Chinese characters" for k in ("en", "enShort") if _HANZI.search(w[k])]
    p += [f"{k} {w[k]!r} starts with a part-of-speech label" for k in ("en", "enShort") if LEFTOVER_LABEL.match(w[k])]
    if w["theme"] not in theme_ids:
        p.append(f"theme {w['theme']!r} is not a theme id")
    if not isinstance(w["ord"], int):
        p.append("ord is not a whole number")
    if not _AUDIO["w"].match(w["au"]) or not w["au"].startswith(f"w/{wid}_"):
        p.append(f"au {w['au']!r} is not w/{wid}_<hash>.mp3")
    ex = w["ex"]
    if set(ex) != _EX_KEYS:
        p.append(f"ex fields {sorted(set(ex) ^ _EX_KEYS)} are missing or extra")
    else:
        if not ex["hz"] or "～" in ex["hz"] or "~" in ex["hz"] or not contains_head(ex["hz"], w["hz"]):
            p.append(f"ex.hz {ex['hz']!r} does not contain the headword written out")
        head = head_py_problem(w, names) if ex["py"] and card_pinyin_ok else None
        if not ex["py"] or not ex["en"]:
            p.append("ex.py or ex.en is empty")
        elif _HANZI.search(ex["py"]):
            p.append(f"ex.py {ex['py']!r} contains Chinese characters")
        elif head:
            p.append(head)
        if not _AUDIO["s"].match(ex["au"]) or not ex["au"].startswith(f"s/{wid}_"):
            p.append(f"ex.au {ex['au']!r} is not s/{wid}_<hash>.mp3")
        if ex["src"] not in ("pdf", "claude"):
            p.append(f"ex.src {ex['src']!r} is not pdf or claude")
    return [f"{wid}: {x}" for x in p]


def check_order(words, theme_ids):
    """ord runs 1..N once each; in ord order themes follow theme order, each theme is one block,
    and the HSK level never goes down inside a theme."""
    problems = []
    ords = sorted(w["ord"] for w in words if isinstance(w["ord"], int))
    if ords != list(range(1, len(words) + 1)):
        problems.append("ord is not 1 to N with each number once")
        return problems
    rank = {t: k for k, t in enumerate(theme_ids)}
    seq = sorted(words, key=lambda w: w["ord"])
    for a, b in zip(seq, seq[1:]):
        if rank[b["theme"]] < rank[a["theme"]]:
            problems.append(f"{b['id']}: theme {b['theme']} comes after {a['theme']} in ord order")
        elif a["theme"] == b["theme"] and b["lv"] < a["lv"]:
            problems.append(f"{b['id']}: level goes down from {a['lv']} to {b['lv']} inside {a['theme']}")
    return problems


def check_links(words):
    """Unique ids and headword-reading pairs; noDistract ids exist and never include the word itself."""
    problems = []
    ids = Counter(w["id"] for w in words)
    problems += [f"{i}: id used {n} times" for i, n in ids.items() if n > 1]
    pairs = Counter((w["hz"], w["pyNum"]) for w in words)
    problems += [f"{hz} {py}: two cards" for (hz, py), n in pairs.items() if n > 1]
    for w in words:
        bad = [x for x in w["noDistract"] if x not in ids or x == w["id"]]
        if bad:
            problems.append(f"{w['id']}: noDistract has unknown or own ids {bad}")
    return problems


def check_distractors(words, needed=3):
    """Each word has at least `needed` usable wrong choices from its own theme in both choice quizzes."""
    by_theme = {}
    for w in words:
        by_theme.setdefault(w["theme"], []).append(w)
    problems = []
    for w in words:
        for quiz in ("listen", "pinyin"):
            n = len(usable_choices(w, by_theme[w["theme"]], quiz))
            if n < needed:
                problems.append(f"{w['id']} {w['hz']}: only {n} usable wrong choices for the {quiz} quiz")
    return problems


def check_audio(words, file_problem):
    """file_problem(path, kind) says what is wrong with one audio file, or None."""
    problems = []
    for w in words:
        for path, kind in ((w["au"], "w"), (w["ex"]["au"], "s")):
            found = file_problem(path, kind)
            if found:
                problems.append(f"{w['id']}: {path}: {found}")
    return problems


def validate(data, file_problem, word_range=(4800, 5300), min_theme=40, max_theme=350, names=None):
    """Every check on the whole data file. Returns {check name: problems}.

    names: the names of data/manual/capitals (Plan 3a pinyin_text.name_rows), whose words may give a
    headword a capital in its sentence. The capitalised cards are added to them with pinyincheck.names_of,
    so the validator knows the same names as the strict checker of the sentence pinyin (Task 13).
    """
    top = check_top(data)
    if top:
        return {"top": top}
    words, themes = data["words"], data["themes"]
    names = names_of(names or {}, words)
    theme_ids = [t["id"] for t in themes]
    fields = [p for w in words for p in check_word(w, set(theme_ids), names)]
    results = {"top": [], "word count": [] if word_range[0] <= len(words) <= word_range[1]
               else [f"{len(words)} words, expected {word_range[0]} to {word_range[1]}"],
               "themes": check_themes(themes, words, min_theme, max_theme), "fields": fields}
    if fields:
        return results
    results.update({"order": check_order(words, theme_ids), "links": check_links(words),
                    "distractors": check_distractors(words), "audio": check_audio(words, file_problem)})
    return results
