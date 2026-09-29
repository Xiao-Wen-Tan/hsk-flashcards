"""Part-of-speech labels and English meanings for the cards.

The card shows `en` (at most 3 senses and 80 characters) and the quiz choices show
`enShort` (at most 30 characters). A sense is one piece of a meaning list separated
by ";". For example the PDF glosses "love" and "like doing sth." give
en "love; like doing sth." and enShort "love".
"""
import re

# The PDFs print these labels after the pinyin ("àiv. love", "běn nm.copy", "pàngadj fat", "tiàowǔ sv. dance").
# sv. marks a separable verb, a verb-object word such as 跳舞 whose parts can be split (跳一个舞).
_PDF_POS = {"n": "n.", "v": "v.", "adj": "adj.", "adv": "adv.", "pron": "pron.", "num": "num.",
            "prep": "prep.", "conj": "conj.", "int": "int.", "part": "part.", "nm": "m.", "mw": "m.",
            "m": "m.", "vm": "m.", "aux": "v.", "sv": "v.", "sa": "part.", "mp": "part."}
# A label with a full stop counts anywhere. Without one, only labels that are not also English
# words count ("adj theyoungest", "v transfer"), so the gloss "part" of 局部 stays a gloss.
# A stray apostrophe or slash may come first ("'sa. expressing emphasis", "/vm. number of times").
_POS_AT_START = re.compile(r"\s*[/']?\s*(?:(num|adj|adv|pron|prep|conj|part|int|aux|mw|nm|mp|vm|sa|sv|v|n|m)\."
                           r"|(num|adj|adv|pron|prep|conj|aux|v|n)(?=\s))\s*(?:&\s*)?")
# A meaning that still starts with a PDF label and a full stop, such as "sv. dance". Plan 3b's
# validator rejects any en or enShort that matches.
LEFTOVER_LABEL = re.compile(r"^\W*(?:" + "|".join(sorted(_PDF_POS, key=len, reverse=True)) + r")\.")
# A colon in a PDF gloss that is not between two digits separates two senses ("interval:interspace").
_COLON = re.compile(r"(?<!\d):|:(?!\d)")

# The public list's tags (the ICTCLAS tag set used by the jieba segmenter) mapped to card labels.
# Tags not listed here (b, g, i, l, k, x and others) give no label.
_PUBLIC_POS = {"n": "n.", "nr": "n.", "ns": "n.", "nt": "n.", "nz": "n.", "t": "n.", "tg": "n.", "s": "n.",
               "f": "n.", "v": "v.", "vn": "v.", "vd": "v.", "a": "adj.", "an": "adj.", "ad": "adj.",
               "z": "adj.", "d": "adv.", "r": "pron.", "m": "num.", "mq": "num.", "q": "m.", "qv": "m.",
               "qt": "m.", "p": "prep.", "c": "conj.", "cc": "conj.", "u": "part.", "y": "part.",
               "e": "int.", "o": "int."}

# CC-CEDICT notes that are not meanings. At the start of a sense: classifiers, surnames, sounds
# ("(onom.) dong"), cross-references ("see also \u7ea2\u94dc") and abbreviations. Anywhere in a sense: variants
# ("variant of \u8bb0\u5f55") and pronunciation notes ("colloquial pr.", "Taiwan pr.").
_CEDICT_DROP = re.compile(r"^(CL:|surname\b|old variant|see (also\b|[\u4e00-\u9fff])|also written|abbr\. for"
                          r"|used in [\u4e00-\u9fff]|erhua variant|Japanese\b|Kangxi radical|radical in Chinese"
                          r"|\(onom\.\))|variant of\b|\bpr\.")
# CC-CEDICT register labels at the start of a sense. Senses marked with the first set are left out,
# senses marked with the second set go after the other senses, and "(coll.)" (colloquial) is removed.
_REGISTER_DROP = re.compile(r"^\((slang|Internet slang|old|archaic|vulgar)\)")
_REGISTER_LAST = re.compile(r"^\((literary|dialect|classical|Tw)\)")
_COLLOQUIAL = re.compile(r"^\(coll\.\)\s*")
_HANZI = re.compile(r"[\u4e00-\u9fff]")
_WORD = re.compile(r"[A-Za-z]+")
# Word endings removed before looking a word up, and British spellings tried in their American form
# (CC-CEDICT writes "honor" and "center"; the PDFs often write "honour" and "centre").
_ENDINGS = ("s", "es", "ed", "d", "ing", "ly")
_SPELLINGS = (("our", "or"), ("tre", "ter"), ("yse", "yze"), ("ise", "ize"))
EN_MAX, SHORT_MAX, SENSES_MAX = 80, 30, 3


def clean_gloss(text):
    """Tidy one gloss: single spaces, "; " between senses, a space after a comma between two letters,
    no stray quotes or edge punctuation, and no stray "." or "?" at the start.

    " copy; issue (used for counting books 'and other bound items)" gives
    "copy; issue (used for counting books and other bound items)", "restaurant,eatery" gives
    "restaurant, eatery", and "? pause" gives "pause".
    """
    t = text.replace("；", ";").replace("’", "'").replace(" '", " ")
    t = re.sub(r"(?<=[A-Za-z]),(?=[A-Za-z])", ", ", t)
    t = re.sub(r"\s*;\s*", "; ", t)
    return re.sub(r"\s+", " ", t).strip(" ;,'").lstrip(".? ")


def split_pos(text):
    """Leading PDF part-of-speech labels and the gloss after them.

    "v. like doing sth." gives (["v."], "like doing sth."), "nm.copy; issue" gives (["m."], "copy; issue"),
    "sv. dance" gives (["v."], "dance"), and "protect; care" gives ([], "protect; care").
    A colon between two senses becomes "; ", so "instead:fjdk" gives "instead; fjdk".
    """
    labels = []
    while True:
        m = _POS_AT_START.match(text)
        if not m:
            break
        label = _PDF_POS[m.group(1) or m.group(2)]
        if label not in labels:
            labels.append(label)
        text = text[m.end():]
    return labels, clean_gloss(_COLON.sub(";", text))


def public_pos(tags):
    """Card labels from the public list's tags, in order and without repeats, so ["v", "vn", "b"] gives ["v."]."""
    out = []
    for t in tags:
        label = _PUBLIC_POS.get(t)
        if label and label not in out:
            out.append(label)
    return out[:SENSES_MAX]


def senses_of(glosses):
    """Every distinct sense of a list of glosses, in order, so ["love", "like; love"] gives ["love", "like"].

    Two senses are the same when they match with case and spaces ignored, because a PDF copy of a
    gloss sometimes lost a space. The copy with more spaces is kept, in the place of the first copy,
    so ["can't compare withothers", "can't compare with others"] gives ["can't compare with others"].
    """
    out, where = [], {}
    for g in glosses:
        for part in clean_gloss(g).split(";"):
            part = part.strip()
            if not part:
                continue
            key = re.sub(r"\s+", "", part.lower())
            if key not in where:
                where[key] = len(out)
                out.append(part)
            elif part.count(" ") > out[where[key]].count(" "):
                out[where[key]] = part
    return out


def vocabulary(meanings):
    """The lower-case English words used in a list of meanings, so ["to take"] gives {"to", "take"}."""
    return {w.lower() for m in meanings for w in _WORD.findall(m)}


def unknown_words(text, vocab):
    """Words of `text` that `vocab` lacks, in order and without repeats.

    A word also counts as known when it is in vocab after removing a common ending (s, es, ed, d, ing,
    ly) or in its American spelling ("honour" as "honor", "centre" as "center"). Step 5 uses this to
    list PDF glosses with words run together, misspellings or junk text. With a vocabulary built
    from "to take" and "an interest in sth", "take aninterest in" gives ["aninterest"].
    """
    out = []
    for word in _WORD.findall(text):
        low = word.lower()
        forms = {low} | {low[:-len(e)] for e in _ENDINGS if low.endswith(e)}
        forms |= {f[:-len(old)] + new for f in list(forms) for old, new in _SPELLINGS if f.endswith(old)}
        if not forms & vocab and word not in out:
            out.append(word)
    return out


def _shorten(sense, limit):
    """Fit one sense into `limit` characters by dropping brackets, then cutting at a comma, then at a space."""
    if len(sense) <= limit:
        return sense
    s = re.sub(r"\s*\([^)]*\)", "", sense).strip()
    if len(s) <= limit:
        return s
    s = s.split(",")[0].strip()
    if len(s) <= limit:
        return s
    return s[:limit - 1].rsplit(" ", 1)[0].rstrip(" ,;") + "…"


def fit_en(senses):
    """The card meaning, which is up to 3 senses joined by "; " in at most 80 characters."""
    out = []
    for s in senses:
        s = _shorten(s, EN_MAX)
        if len(out) == SENSES_MAX or len("; ".join(out + [s])) > EN_MAX:
            break
        out.append(s)
    return "; ".join(out)


def en_short(senses):
    """The quiz-choice meaning, which is the first sense cut to at most 30 characters."""
    return _shorten(senses[0], SHORT_MAX) if senses else ""


def cedict_senses(meanings):
    """Usable senses from the public list's CC-CEDICT meanings, with no Chinese characters left.

    Pinyin in square brackets is removed, the notes matched by _CEDICT_DROP are dropped, and
    "traditional|simplified" pairs keep the simplified form. Then a bracket that holds Chinese
    characters and a Chinese word at the end of a sense are removed, and a sense that still
    holds Chinese characters is dropped. So "expressway (abbr. for 高速公路)" gives "expressway",
    "first of the ten Heavenly Stems 十天干" gives "first of the ten Heavenly Stems", and
    "unit of volume equal to 12 斗 and 8 升" is dropped.
    ["surname Wang", "king; ruler", "CL:個|个[ge4]"] gives ["king", "ruler"].
    Register labels are handled as in the notes above _REGISTER_DROP: ["to kick", "(slang) butch"]
    gives ["to kick"], ["(literary) to be deficient in", "to owe"] gives ["to owe", "(literary) to be
    deficient in"], and "(coll.) mother's mother" gives "mother's mother".
    The result can be empty; the caller then looks elsewhere (wordlist.english).
    """
    kept, later = [], []
    for m in meanings:
        for part in m.split(";"):
            part = re.sub(r"\[[^\]]*\]", "", part).strip()
            if not part or _CEDICT_DROP.search(part) or _REGISTER_DROP.match(part):
                continue
            part = _COLLOQUIAL.sub("", part)
            part = re.sub(r"\S+\|(\S+)", r"\1", part).replace("(bound form)", "")
            part = re.sub(r"\s*\([^)]*[一-鿿][^)]*\)", "", part).strip()
            part = re.sub(r"\s+[一-鿿]+$", "", part).strip()
            if part and not _HANZI.search(part):
                (later if _REGISTER_LAST.match(part) else kept).append(part)
    return senses_of(kept + later)
