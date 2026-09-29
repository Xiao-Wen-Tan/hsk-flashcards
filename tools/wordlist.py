"""Build the card word list from both sources.

The cards teach every word in the PDFs plus every word of the public HSK 2.0 list
(data/public/hsk2_old_exclusive_vNNN.json) whose characters the PDFs lack. Each
card is one word with one pronunciation, at the lowest HSK level either source gives.
A PDF headword comes from its decoded glyph codes. Its pronunciation is the public
reading that its PDF pinyin matches, so the entry "zhǎng v. grow" for 长 gives the
reading zhǎng, not cháng.
"""
import re
import unicodedata

from decode import _boundary, decode_cids, match_head
from meaning import cedict_senses, senses_of, split_pos
from pdfbody import sentence_candidates, split_senses
from pinyin_norm import norm, toneless
from pinyin_text import join_erhua, marked_to_num

NO_FREQUENCY = 1000000  # the public list's value for "frequency unknown"; smaller numbers are more common
# The HSK 1 to 4 PDFs print textbook pinyin with word spacing ("bú kèqi"); the HSK 5 and 6 PDFs
# print one syllable per space ("ài hù"), so only the first four are a source of word spacing.
TEXTBOOK_FILES = (1, 2, 3, 4)
_ERHUA = re.compile(r"(?<=[^\W\d_]) er(?=\W|$)")  # the PDFs spell the 儿 ending " er", the public list "r"


def public_readings(complete):
    """{hz: [{"py", "num", "meanings"}]} with one item per distinct reading, in the list's order.

    Forms with the same pinyin are merged, so their meanings are kept together. The meanings of a
    form that only names a sound (its first meaning starts with "(onom.)") go last, so 当 dāng gives
    ["to be", "to act as", ..., "(onom.) dong", "ding dong (bell)"].
    "num" is the numbered reading, for example "chang2" for 长 cháng. A neutral 儿 ending is
    numbered "r5" (join_erhua), so 纽扣儿 "niǔ kòu er" gives "niu3 kou4 r5", like 一点儿 "yi1 dian3 r5".
    "py" stays as the list writes it, because match_reading compares it with the PDF's pinyin.
    """
    out = {}
    for w in complete:
        readings, sounds = [], {}
        for form in w["forms"]:
            py = form["transcriptions"]["pinyin"]
            same = next((r for r in readings if r["py"] == py), None)
            if same is None:
                num = " ".join(join_erhua(w["simplified"], marked_to_num(py).split()))
                same = {"py": py, "num": num, "meanings": []}
                readings.append(same)
            if form["meanings"] and form["meanings"][0].startswith("(onom.)"):
                sounds.setdefault(py, []).extend(form["meanings"])
            else:
                same["meanings"] += form["meanings"]
        for r in readings:
            r["meanings"] += sounds.get(r["py"], [])
        out[w["simplified"]] = readings
    return out


def _rest_after(text, keep, length):
    """The part of `text` after its first `length` letters as counted by `keep` (norm or toneless)."""
    kept, i = 0, 0
    while i < len(text) and kept < length:
        kept += len(keep(text[i]))
        i += 1
    while i < len(text) and unicodedata.combining(text[i]):
        i += 1
    return text[i:]


def match_reading(latin, readings):
    """The reading whose pinyin starts the PDF's Latin text, and the text after that pinyin.

    The pinyin must end at a word boundary (decode._boundary), so " èng hum " does not
    match èn. Exact tones are tried before ignoring tones, and the longest match wins; a
    lower-case reading beats a capitalised name with the same letters. The PDF's erhua
    spelling " er" and its Latin letter "ɑ" are also tried as "r" and "a".
    With readings cháng and zhǎng, " zhǎng v. grow " gives (the zhǎng reading, " v. grow ").
    Returns None when no reading matches.
    """
    text = unicodedata.normalize("NFC", latin).replace("ɑ", "a")
    for t in (text, _ERHUA.sub("r", text)):
        for keep in (norm, toneless):
            whole = keep(t)
            hits = [r for r in readings if keep(r["py"]) and whole.startswith(keep(r["py"]))
                    and _boundary(t, keep, len(keep(r["py"]))) is not None]
            if hits:
                best = max(hits, key=lambda r: (len(keep(r["py"])), r["py"][:1].islower()))
                return best, _rest_after(t, keep, len(keep(best["py"])))
    return None


def entry_ref(e):
    return f"HSK{e['file']} #{e['n']}"


def pdf_words(entries, fwd, readings, fixes):
    """Group the PDF entries into words, one per headword and reading.

    fixes: {(file, n): row} from data/manual/pdf_fixes_vNNN.csv. A non-empty field of a
    fix row replaces what the entry gives: hz (the headword), pynum (the numbered reading;
    a capital first letter marks a name), pos (labels separated by spaces), gloss (the whole
    English meaning) and sentence (one repaired example sentence, already written out).
    An entry whose headword has a single public reading that its cut or misspelled PDF pinyin
    does not match uses that reading when its fix row gives a gloss.
    Returns (words, problems). words maps (hz, numbered reading) to
    {"hz", "num", "capital", "files", "glosses", "pos", "sents", "refs", "latin"}, where "sents" holds
    (sentence, ref) pairs that may still contain ～, and "latin" holds the Latin text of the word's
    entries in the HSK 1 to 4 PDFs, whose printed pinyin gives the card's word spacing (step 5).
    problems lists entries that need a fix row.
    """
    words, problems = {}, []
    for e in entries:
        fix = fixes.get((e["file"], e["n"]), {})
        hz = fix.get("hz") or decode_cids(match_head(e["head"]), fwd)
        senses = split_senses(e["tokens"], fwd)
        options = readings.get(hz, [])
        if fix.get("pynum"):
            num, capital, rest = fix["pynum"].lower(), fix["pynum"][0].isupper(), None
        else:
            found = match_reading(e["latin"], options)
            if found is None and len({norm(r["py"]) for r in options}) == 1 and fix.get("gloss"):
                found = (options[0], None)
            if found is None:
                problems.append(f"{entry_ref(e)} {hz} {e['latin'].strip()[:40]}: no reading, needs pynum and gloss")
                continue
            reading, rest = found
            num, capital = reading["num"], reading["py"][:1].isupper()
        labels, glosses = [], []
        first = [(rest or "", body) for _, body in senses[:1]]
        for text, _body in first + [(g, b) for g, b in senses[1:]]:
            got_labels, gloss = split_pos(text)
            labels += [x for x in got_labels if x not in labels]
            if gloss:
                glosses.append(gloss)
        if fix.get("gloss"):
            glosses = [fix["gloss"]]
        if fix.get("pos"):
            labels = fix["pos"].split()
        if fix.get("sentence"):
            sents = [(fix["sentence"], entry_ref(e))]
        else:
            sents = [(s, entry_ref(e)) for _, body in senses for s in sentence_candidates(body)]
        w = words.setdefault((hz, num), {"hz": hz, "num": num, "capital": capital, "files": [],
                                         "glosses": [], "pos": [], "sents": [], "refs": [], "latin": []})
        w["files"].append(e["file"])
        if e["file"] in TEXTBOOK_FILES:
            w["latin"].append(e["latin"])
        w["glosses"] += [g for g in glosses if g not in w["glosses"]]
        w["pos"] += [x for x in labels if x not in w["pos"]]
        w["sents"] += [s for s in sents if s[0] not in {x[0] for x in w["sents"]}]
        w["refs"].append(entry_ref(e))
    return words, problems


def _list_word(hz, reading):
    """A card that comes only from the public list, so it has no PDF files, glosses or sentences."""
    return {"hz": hz, "num": reading["num"], "capital": reading["py"][:1].isupper(), "files": [], "glosses": [],
            "pos": [], "sents": [], "refs": [], "latin": [], "meanings": reading["meanings"]}


def _with_row(word, row):
    """Apply a hand-written row's pos (labels separated by spaces) and gloss to a card, when they are given.

    The gloss then comes before the CC-CEDICT meanings in `english`, and the pos before the list's tags.
    """
    if (row.get("pos") or "").strip():
        word["pos"] = row["pos"].split()
    if (row.get("gloss") or "").strip():
        word["glosses"] = [row["gloss"].strip()]
    return word


def public_only_words(old, pdf_hz, readings, chosen):
    """Words of the public HSK 2.0 list whose characters the PDFs lack.

    chosen: {hz: row} from data/manual/public_readings_vNNN.csv, where a row has pynum and may
    have pos and gloss. A word with one reading uses it. A word with several different readings
    needs a row, and the row's numbered reading picks one. Either way a lower-case reading beats a
    capitalised name with the same numbered reading, so 露 lu4 is lù "dew", not Lù "surname Lu".
    A row's pos and gloss, when given, become the card's part of speech and meaning, because
    CC-CEDICT pools the senses of all forms of a reading (露 lù starts "dew; syrup; nectar").
    Returns (words, problems) in the same shape as pdf_words, with "files" empty, no sentences,
    and the reading's CC-CEDICT "meanings".
    """
    words, problems = {}, []
    for w in old:
        hz = w["simplified"]
        if hz in pdf_hz:
            continue
        options, row = readings[hz], chosen.get(hz, {})
        if row:
            want = [r for r in options if r["num"] == row["pynum"].strip().lower()]
            if not want:
                problems.append(f"{hz}: chosen reading {row['pynum']} is not one of its readings")
                continue
        elif len({norm(r["py"]) for r in options}) > 1:
            problems.append(f"{hz}: readings {' / '.join(r['py'] for r in options)}; choose one")
            continue
        else:
            want = options
        reading = next((r for r in want if r["py"][:1].islower()), want[0])
        words[(hz, reading["num"])] = _with_row(_list_word(hz, reading), row)
    return words, problems


def second_readings(complete, readings, card_keys, decided):
    """Cards for readings that the public list counts as a separate HSK 2.0 entry but no card has.

    The complete list tags a headword with two "old-N" levels when HSK 2.0 lists it twice
    (长 has "old-2" twice, for cháng and zhǎng). Each lower-case reading of such a headword
    that no key in `card_keys` (a set of (hz, pynum)) uses needs a decision in `decided`,
    {(hz, pynum): row}, from data/manual/second_readings_vNNN.csv. The row's card is "Y" (make a
    card) or "N" (leave it out); its pos (labels separated by spaces) and gloss, when given, become
    the card's part of speech and meaning, because the list's tags describe the headword as a whole.
    With only 长 chang2 among the cards, 长 zhang3 needs a row.
    Returns (words, problems) in the shape of public_only_words.
    """
    have = {}
    for hz, num in card_keys:
        have.setdefault(hz, set()).add(num)
    words, problems = {}, []
    for w in complete:
        hz = w["simplified"]
        if sum(1 for tag in w.get("level", []) if tag.startswith("old-")) < 2:
            continue
        for r in readings[hz]:
            if not r["py"][:1].islower() or r["num"] in have.get(hz, set()) or (hz, r["num"]) in words:
                continue
            row = decided.get((hz, r["num"]), {})
            choice = (row.get("card") or "").strip().upper()
            if choice == "Y":
                words[(hz, r["num"])] = _with_row(_list_word(hz, r), row)
            elif choice != "N":
                problems.append(f"{hz} {r['py']}: a second HSK 2.0 entry with no card; add a row with card Y or N")
    return words, problems


def apply_gloss_fixes(words, fixes):
    """Replace the glosses of the cards named in `fixes`, {(hz, pynum): gloss}, from data/manual/gloss_fixes_vNNN.csv.

    This repairs PDF glosses whose words run together, are misspelled or hold junk text in every
    copy, so 过问 "concern oneself with; take aninterest in" becomes "... take an interest in".
    `words` is changed in place. Returns a problem for each row that names no card.
    """
    problems = []
    for (hz, num), gloss in fixes.items():
        if (hz, num) in words:
            words[(hz, num)]["glosses"] = [gloss]
        else:
            problems.append(f"{hz} {num}: a gloss fix for a card that does not exist")
    return problems


def level_of(word, old_level):
    """The lowest HSK level in either source, which is the lowest PDF file it is in or the public list's level."""
    levels = list(word["files"])
    if word["hz"] in old_level:
        levels.append(old_level[word["hz"]])
    return min(levels)


def english(word, readings):
    """The word's senses, which are its PDF glosses or else the cleaned CC-CEDICT meanings of its reading.

    When CC-CEDICT only calls the word a variant of another word, that word's meanings are used,
    so 纪录 ("variant of 记录") gets the meanings of 记录. The result is empty when nothing usable is found.
    """
    senses = senses_of(word["glosses"])
    if senses:
        return senses
    meanings = word.get("meanings")
    if meanings is None:
        meanings = next((r["meanings"] for r in readings.get(word["hz"], []) if r["num"] == word["num"]), [])
    senses = cedict_senses(meanings)
    for m in meanings:
        if senses:
            break
        target = re.search(r"variant of (?:\S+\|)?([一-鿿]+)", m)
        if target:
            same = [r for r in readings.get(target.group(1), []) if r["num"] == word["num"]]
            senses = cedict_senses(same[0]["meanings"]) if same else []
    return senses
