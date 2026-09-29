"""Pinyin formats for the cards: tone-marked with textbook word spacing, numbered and toneless.

Numbered pinyin writes the tone as a digit after each syllable, one syllable per
space, as in "ping2 guo3". Tone 5 is the neutral (light) tone, and the 儿 ending is the
syllable "r5", as in "gan4 huo2 r5" for 干活儿.

The card pinyin `py` follows the textbook word-spacing rules (汉语拼音正词法). The syllables of
one word are written together, words are separated by spaces, and a four-character idiom that
divides into two pairs is written as two joined pairs with a hyphen, as in 不客气 "bú kèqi",
拔苗助长 "bámiáo-zhùzhǎng" and 一点儿 "yìdiǎnr". Inside a word, a syllable that starts with a, o
or e gets an apostrophe (西安 "xī'ān"). Where the words meet is described by "joints", one per gap between two
syllables. "" joins two syllables of one word, " " starts a new word, "-" joins the halves of
an idiom (or 第 and its number), and "…" separates the halves of a pattern word such as 虽然…但是….

A four-character word takes one of three forms (FORMS), as the textbook rules write it. An idiom
that divides into two pairs is two joined pairs with a hyphen (拔苗助长 "bámiáo-zhùzhǎng"), a
compound of several words is written as those words ("words", 通货膨胀 "tōnghuò péngzhàng"), and a
single word that cannot be divided is written joined (二氧化碳 "èryǎnghuàtàn"), as are an idiom
that does not divide into two pairs (总而言之 "zǒng'éryánzhī") and a doubled word (断断续续).
data/manual/four_char_words says which form each such word takes, and data/manual/capitals says
which words are names and how their words are spaced. All pinyin is in lower case, names included,
as the user decided on 2026-09-29 (北京 "běijīng", 李老师 "lǐ lǎoshī").
"""
import re
import unicodedata

from pinyin_norm import toneless

_MARKS = {"a": "āáǎà", "e": "ēéěè", "i": "īíǐì", "o": "ōóǒò", "u": "ūúǔù", "ü": "ǖǘǚǜ"}
_TONE_OF = {ch: (base, n + 1) for base, row in _MARKS.items() for n, ch in enumerate(row)}
_NUMERALS = set("〇零一二两三四五六七八九十百千万亿第")
_AOE = "aāáǎàoōóǒòeēéěè"
# Characters that may stand between two syllables in printed pinyin. The PDFs write the
# apostrophe as ’.
_SEPARATORS = " -'’…"
IDIOM_JOINTS = ["", "-", ""]
FORMS = ("idiom", "words", "joined")
FORM_COLUMNS = ["hz", "form", "words"]
# The columns of the batch files for the form agents (Plan 3a Task 7). They hold the word, its
# numbered pinyin, an English meaning for a card, card or sentence, for a sentence word one
# sentence that holds it, and "idiom" in mark when CC-CEDICT marks the word "(idiom)", which is
# only a hint to the agents.
FORM_BATCH_COLUMNS = ["hz", "pinyin", "en", "where", "sentence", "mark"]
FORM_BATCH = 100


def syllable_to_num(syl):
    """One tone-marked syllable in numbered form, so "Běi" gives "bei3", "lǜ" gives "lü4" and "r" gives "r5"."""
    syl = unicodedata.normalize("NFC", syl.replace("u:", "ü").replace("U:", "Ü")).lower()
    tone, out = 5, []
    for ch in syl:
        if ch in _TONE_OF:
            base, tone = _TONE_OF[ch]
            out.append(base)
        else:
            out.append(ch)
    return "".join(out) + str(tone)


def marked_to_num(py):
    """A tone-marked reading with one syllable per space to numbered pinyin.

    "Běi jīng" gives "bei3 jing1", and "gàn huó r" gives "gan4 huo2 r5".
    """
    return " ".join(syllable_to_num(s) for s in py.split())


def join_erhua(hz, nums):
    """The numbered syllables with a neutral 儿 ending written as "r5", which joins the syllable before it.

    The public list writes the 儿 ending as "r" (一点儿 "yī diǎn r", numbered yi1 dian3 r5), except
    for 纽扣儿, which it writes "niǔ kòu er", numbered niu3 kou4 er5. So a final "er5" of a headword
    of more than one character that ends in 儿 becomes "r5", and ["niu3", "kou4", "er5"] gives
    ["niu3", "kou4", "r5"], which card_py writes "niǔkòur". A 儿 with its own tone stays a syllable
    (女儿 nü3 er2, 婴儿 ying1 er2).
    """
    if len(hz) > 1 and hz.endswith("儿") and nums and nums[-1] == "er5":
        return list(nums[:-1]) + ["r5"]
    return list(nums)


def num_to_marked(syl):
    """One numbered syllable in tone-marked form, so "lü4" gives "lǜ", "guo3" gives "guǒ" and "ma5" gives "ma".

    The mark goes on a or e if there is one, on the o of "ou", and otherwise on the last vowel.
    """
    base, tone = syl[:-1], int(syl[-1])
    if tone == 5:
        return base
    if "a" in base:
        i = base.index("a")
    elif "e" in base:
        i = base.index("e")
    elif "ou" in base:
        i = base.index("o")
    else:
        i = max(base.rfind(v) for v in "iouü")
    return base[:i] + _MARKS[base[i]][tone - 1] + base[i + 1:]


# The digits of a number read digit by digit, before which a 一 keeps yi1 (一九九八 "yī jiǔ jiǔ bā").
# 两 is not one, because 一两 is an approximate number ("yì-liǎng").
DIGITS = set("〇零一二三四五六七八九")
# The words of arithmetic, next to which a 一 is a number and keeps yi1 ("yī jiā yī děngyú èr").
ARITHMETIC = ("除以", "乘以", "等于", "加", "减", "乘", "除")


def yi_in_arithmetic(chars, i, counted=(), span_of=None):
    """The arithmetic word next to the 一 at index i of chars, when that 一 keeps yi1 there, else "".

    A 一 directly before or after 加, 减, 乘, 除 or 等于 is a number in arithmetic, as the coordinator
    decided on 2026-09-29, so 一加一等于二 gives 加 for both 一. A 一 after such a word that counts
    with a word of counted (the measure words, 个) still shows its tone change (再加一个 "zài jiā yí gè").
    span_of(j) gives (start, end) of the word that holds the character j as the line or the segmenter
    divides it, or None. An arithmetic character that belongs to a longer word without the 一 is not
    arithmetic (coordinator's decision of 2026-09-29), so in 一加班 "yì jiābān" the 一 changes. 除以
    and 乘以 are arithmetic words of their own ("yī chúyǐ èr").
    The draft (tone_change) and the checker (pinyincheck) share this rule.
    """
    chars = "".join(chars)

    def alone(a, b):
        span = span_of(a) if span_of else None
        return not span or (span[0] >= a and span[1] <= b) or span[0] <= i < span[1]

    after = next((w for w in ARITHMETIC if chars[i + 1:i + 1 + len(w)] == w), "")
    if after and alone(i + 1, i + 1 + len(after)):
        return after
    before = next((w for w in ARITHMETIC if i >= len(w) and chars[i - len(w):i] == w), "")
    if before and alone(i - len(before), i) and not any(chars[i + 1:i + 1 + n] in counted for n in (1, 2, 3, 4)):
        return before
    return ""


def tone_change(hz, nums, keep=(), counted=(), spans=None):
    """Apply the tone changes of 一 and 不 that textbooks write, and no others.

    hz: the characters, one per syllable (a 儿 ending counts as its own character, like "r5").
    nums: the numbered syllables, in dictionary tones. keep: positions of 一 that end a
    word inside a sentence (统一 in 统一中国), which keep yi1. counted: the measure words, which
    tell a 一 that counts after an arithmetic word (yi_in_arithmetic). spans: {position: (start, end)}
    of the segmented word that holds each position, so 加班 is not the arithmetic 加.
    Between two copies of one character, 一 and 不 lose their tone, so 看一看 gives kan4 yi5 kan4
    and 好不好 gives hao3 bu5 hao3. Otherwise these rules apply.
    不 (bu4) becomes bu2 before a fourth tone, so 不客气 bu4 ke4 qi5 gives bu2 ke4 qi5.
    一 (yi1) becomes yi2 before a fourth tone and yi4 before a first, second or third tone:
    一下 gives yi2 xia4 and 一起 gives yi4 qi3. Before a neutral tone it becomes yi2 (一个 yi2 ge5),
    because the checker (pinyincheck) wants a tone change there too and most such syllables are a
    fourth tone in the dictionary. 一 keeps yi1 at the end (统一), after a numeral or 第 (十一,
    第一), before 月 in a month name (一月, 十一月), before another digit (一九九八) and next to an
    arithmetic word (一加一), the same rules as the checker's.
    """
    out = list(nums)
    for i, (ch, syl) in enumerate(zip(hz, nums)):
        if i + 1 >= len(nums) or syl not in ("bu4", "yi1") or ch not in "不一":
            continue
        if 0 < i and hz[i - 1] == hz[i + 1]:
            out[i] = syl[:-1] + "5"
            continue
        nxt = nums[i + 1][-1]
        if ch == "不":
            if nxt == "4":
                out[i] = "bu2"
        elif not (i in keep or (i > 0 and hz[i - 1] in _NUMERALS) or hz[i + 1] == "月" or hz[i + 1] in DIGITS
                  or yi_in_arithmetic(hz, i, counted, (spans or {}).get)):
            out[i] = "yi2" if nxt in "45" else "yi4"
    return out


def reading_mismatches(chars, shown, nums):
    """Positions where the shown syllables differ from the dictionary syllables `nums`, once the
    tone changes of 一 and 不 are removed.

    A shown yi2, yi4 or yi5 of 一 counts as its dictionary yi1, and a shown bu2 or bu5 of 不 as its
    dictionary bu4. So 不客气 shown as bu2 ke4 qi5 matches bu4 ke4 qi5, and 受不了 shown as
    shou4 bu5 liao3 matches shou4 bu4 liao3, while 一下 shown as yi3 xia4 differs at position 0.
    """
    out = []
    for i, (ch, s, n) in enumerate(zip(chars, shown, nums)):
        changed = (ch == "一" and n == "yi1" and s in ("yi2", "yi4", "yi5")) or \
                  (ch == "不" and n == "bu4" and s in ("bu2", "bu5"))
        if s != n and not changed:
            out.append(i)
    return out


def card_py(nums, joints=None):
    """Tone-marked card pinyin in textbook word spacing, in lower case.

    nums: numbered syllables, with the 一 and 不 tone changes already applied. An "r5" (the 儿
    ending) always joins the syllable before it.
    joints: one item per gap between two syllables (see the module notes); None joins them all.
    A pattern word's "…" joints also get a final "…".
    Inside a word, a syllable starting with a, o or e gets an apostrophe.
    Names are in lower case too (the user's decision of 2026-09-29), so ["bei3", "jing1"] gives
    "běijīng", and ["li3", "lao3", "shi1"] with [" ", ""] gives "lǐ lǎoshī".
    ["bu2", "ke4", "qi5"] with joints [" ", ""] gives "bú kèqi", ["xi1", "an1"] gives "xī'ān",
    ["ba2", "miao2", "zhu4", "zhang3"] with IDIOM_JOINTS gives "bámiáo-zhùzhǎng", and
    ["sui1", "ran2", "dan4", "shi4"] with ["", "…", ""] gives "suīrán…dànshì…".
    """
    joints = list(joints) if joints is not None else [""] * (len(nums) - 1)
    text = ""
    for k, syl in enumerate(nums):
        if k and syl == "r5":
            text += "r"
            continue
        marked = num_to_marked(syl)
        joint = joints[k - 1] if k else ""
        if k and not joint and marked[0] in _AOE:
            joint = "'"
        text += joint + marked
    if "…" in joints:
        text += "…"
    return text


def joints_from_sizes(sizes, between=" "):
    """Joints for words of the given sizes in syllables, so [1, 2] gives [" ", ""] (不 + 客气)."""
    out = []
    for n, size in enumerate(sizes):
        if n:
            out.append(between)
        out += [""] * (size - 1)
    return out


def _spell(text, nums):
    """Find the syllables of `nums` in tone-marked text, in order, ignoring tones and capitals.

    Returns ([(separators before the syllable, the syllable as written)], end), where end is the
    position after the last syllable, or None when the letters do not spell nums. Separators are
    spaces, hyphens, apostrophes and "…". An "r5" must follow its syllable directly as "r".
    The PDFs' Latin letter "ɑ" counts as "a". So "bú kèqi You’re" with bu4 ke4 qi5 gives
    ([("", "bú"), (" ", "kè"), ("", "qi")], 7).
    """
    t = unicodedata.normalize("NFC", text).replace("ɑ", "a")
    i, out = 0, []
    for syl in nums:
        sep = ""
        while i < len(t) and t[i] in _SEPARATORS:
            sep += t[i]
            i += 1
        start = i
        for letter in syl[:-1]:
            if i >= len(t) or toneless(t[i]) != letter:
                return None
            i += 1
        if syl == "r5" and sep:
            return None
        out.append((sep, t[start:i]))
    return out, i


def _joint(sep):
    """The joint that printed separators stand for: "…", "-" or " " when present, else ""."""
    return next((j for j in ("…", "-", " ") if j in sep), "")


def _pattern_gaps(hz):
    """Gap positions between the halves of a pattern word, so 虽然…但是… gives {1}."""
    gaps, n = set(), 0
    for part in [p for p in hz.split("…") if p][:-1]:
        n += len(part)
        gaps.add(n - 1)
    return gaps


def pdf_pinyin(text, hz, nums):
    """The textbook pinyin printed at the start of a PDF entry's Latin text, when it fits the card.

    The HSK 1 to 4 PDFs print word-spaced textbook pinyin ("bú kèqi", "dǎ diànhuà", "dì-yī",
    "nǚ’ér"). text: the entry's Latin text. hz: the headword. nums: the card reading in
    dictionary tones. The printed syllables must spell nums, with the same tones once the
    tone changes of 一 and 不 are removed, and a pattern word's "…" must sit between its halves.
    Returns (the printed syllables in numbered form, joints) or None.
    " bú kèqi You’re welcome. " with 不客气 and bu4 ke4 qi5 gives (["bu2", "ke4", "qi5"], [" ", ""]).
    """
    found = _spell(text.lstrip(), nums)
    if found is None or found[0][0][0]:
        return None
    shown = [syllable_to_num(s) for _, s in found[0]]
    joints = [_joint(sep) for sep, _ in found[0][1:]]
    if reading_mismatches(hz.replace("…", ""), shown, nums):
        return None
    if {k for k, j in enumerate(joints) if j == "…"} != _pattern_gaps(hz):
        return None
    return shown, joints


def printed_pinyin(texts, hz, nums):
    """The printed pinyin of the first of a card's HSK 1 to 4 PDF texts that fits the card (pdf_pinyin).

    Returns (the printed syllables in numbered form, joints) or None. A printed capital is dropped,
    because all pinyin is in lower case since 2026-09-29, so " Běijīng n. Beijing " with bei3 jing1
    gives (["bei3", "jing1"], [""]), which card_py writes "běijīng".
    """
    for text in texts:
        found = pdf_pinyin(text, hz, nums)
        if found:
            return found
    return None


def headword_joints(hz, cut, form=None):
    """Joints for a headword whose textbook pinyin the PDFs do not print.

    cut(text) gives the words the jieba segmenter finds in text. A pattern word joins each half
    and puts "…" between the halves. A 儿 ending of a longer headword joins the rest, which these
    rules place. A headword of one or two characters is one word, and so is a headword of three
    characters with 不 or 得 in the middle, because point 5 of the pinyin style sheet keeps a card
    that is a potential complement in the joined form the PDFs print or the public list gives
    (看不起 "kànbuqǐ", 来得及), even where jieba would cut it. A four-character headword with
    a form, a pair (form, words) as form_rows gives it, is written in that form (form_joints).
    Step 5 takes every form from data/manual/four_char_words. Otherwise each word that cut finds
    is one pinyin word, so 系领带 cut as 系 + 领带 gives [" ", ""] ("xì lǐngdài").
    """
    if "…" in hz:
        return joints_from_sizes([len(p) for p in hz.split("…") if p], "…")
    if len(hz) > 2 and hz.endswith("儿"):
        return headword_joints(hz[:-1], cut, form) + [""]
    if len(hz) <= 2 or (len(hz) == 3 and hz[1] in "不得"):
        return [""] * (len(hz) - 1)
    if len(hz) == 4 and form:
        return form_joints(*form)
    return joints_from_sizes([len(w) for w in cut(hz)])


def form_joints(form, words):
    """Joints for a four-character word in one of the three FORMS.

    idiom gives IDIOM_JOINTS (拔苗助长 "bámiáo-zhùzhǎng") and joined gives ["", "", ""] (二氧化碳
    "èryǎnghuàtàn"). words puts a space between the listed words, so ["通货", "膨胀"] gives
    ["", " ", ""] ("tōnghuò péngzhàng") and ["叹", "一", "口", "气"] gives [" ", " ", " "].
    """
    if form == "idiom":
        return list(IDIOM_JOINTS)
    if form == "words":
        return joints_from_sizes([len(w) for w in words])
    return ["", "", ""]


def joints_of_py(py, nums):
    """The joints of a card's py, so "bú kèqi" with bu4 ke4 qi5 gives [" ", ""]. None if py does not spell nums."""
    py = unicodedata.normalize("NFC", py)
    found = _spell(py, nums)
    if found is None or py[found[1]:].strip("…"):
        return None
    return [_joint(sep) for sep, _ in found[0][1:]]


def syllables_of_py(py, nums):
    """The numbered syllables that a card's py shows, with its 一 and 不 tone changes.

    So "shòubuliǎo" with shou4 bu4 liao3 gives ["shou4", "bu5", "liao3"], and "bú kèqi" with
    bu4 ke4 qi5 gives ["bu2", "ke4", "qi5"]. None if py does not spell nums.
    """
    py = unicodedata.normalize("NFC", py)
    found = _spell(py, nums)
    if found is None or py[found[1]:].strip("…"):
        return None
    return [syllable_to_num(s) for _, s in found[0]]


def py_problems(hz, py, pynum):
    """Why a card's py does not fit its pyNum and the spacing rules; an empty list means it fits.

    It checks five things. py holds only letters, spaces, hyphens and apostrophes (and "…" in a
    pattern word), in lower case since the user's decision of 2026-09-29. No space, hyphen or apostrophe stands at either end or two in a row. Its
    syllables spell pyNum with the same tones once the tone changes of 一 and 不 are removed. An
    apostrophe stands exactly before each syllable inside a word that starts with a, o or e.
    ("不客气", "bú kèqi", "bu4 ke4 qi5") and ("拔苗助长", "bámiáo-zhùzhǎng", "ba2 miao2 zhu4 zhang3")
    give [], while ("西安", "xīān", "xi1 an1") gives ["an apostrophe is missing before syllable 2 'ān'"].
    """
    py, nums, chars = unicodedata.normalize("NFC", py), pynum.split(), hz.replace("…", "")
    odd = sorted({ch for ch in py if not (ch.isalpha() or ch in " -'" or (ch == "…" and "…" in hz))})
    if odd:
        return [f"py {py!r} holds {''.join(odd)!r}; only letters, spaces, hyphens and apostrophes are allowed"]
    if any(ch.isupper() for ch in py):
        return [f"py {py!r} has a capital letter; all pinyin is in lower case"]
    if re.search(r"^[ \-']|[ \-']$|[ \-'…]{2}", py.rstrip("…")):
        return [f"py {py!r} has a space, hyphen or apostrophe at an end or two in a row"]
    found = _spell(py, nums)
    if found is None or py[found[1]:].strip("…"):
        return [f"py {py!r} does not spell pyNum {pynum!r}"]
    shown = [syllable_to_num(s) for _, s in found[0]]
    problems = [f"syllable {k + 1} of py is {shown[k]} but pyNum has {nums[k]}"
                for k in reading_mismatches(chars, shown, nums)]
    for k, (sep, written) in enumerate(found[0]):
        if not k or nums[k] == "r5":
            continue
        inside = _joint(sep) == ""
        if inside and written[:1].lower() in _AOE and "'" not in sep:
            problems.append(f"an apostrophe is missing before syllable {k + 1} {written!r}")
        elif "'" in sep and not (inside and written[:1].lower() in _AOE):
            problems.append(f"an apostrophe stands before syllable {k + 1} {written!r}")
    return problems


def py_base(nums):
    """Toneless pinyin in lower case with no spaces and ü kept, so ["ping2", "guo3"] gives "pingguo"."""
    return "".join(("r" if s == "r5" else s[:-1]) for s in nums)


def syllable_count(nums):
    """Number of syllables, not counting a 儿 ending, so ["gan4", "huo2", "r5"] gives 2."""
    return sum(1 for s in nums if s != "r5")


def form_rows(rows):
    """{hz: (form, words)} from the rows of data/manual/four_char_words, and the problems found.

    Each row has hz (four characters), form (one of FORMS) and words. For the form "words", words
    lists the words that spell hz, separated by spaces, and for the other forms it is empty. So
    {"hz": "通货膨胀", "form": "words", "words": "通货 膨胀"} gives {"通货膨胀": ("words", ["通货", "膨胀"])}.
    A form that is not one of FORMS, words that do not spell hz or are given for another form,
    and a headword listed twice are problems.
    """
    out, problems = {}, []
    for r in rows:
        hz, form = (r.get("hz") or "").strip(), (r.get("form") or "").strip().lower()
        words = (r.get("words") or "").split()
        if len(hz) != 4 or form not in FORMS:
            problems.append(f"{hz}: form {r.get('form')!r} is not idiom, words or joined, or hz is not four characters")
        elif (form == "words") != bool(words) or (words and ("".join(words) != hz or len(words) < 2)):
            problems.append(f"{hz}: words {r.get('words')!r} do not fit the form {form}")
        elif hz in out:
            problems.append(f"{hz}: listed twice")
        else:
            out[hz] = (form, words)
    return out, problems


def check_form_answers(inputs, outputs):
    """Match a form agent's answers (columns FORM_COLUMNS) to its batch rows by hz.

    Each input hz needs exactly one answer that form_rows accepts. Returns (problems, rows), where
    rows holds the accepted answers as [hz, form, words], in the input order.
    """
    want = [(r.get("hz") or "").strip() for r in inputs]
    got, problems, seen = {}, [], {}
    for r in outputs:
        hz = (r.get("hz") or "").strip()
        seen[hz] = seen.get(hz, 0) + 1
        if hz not in want:
            problems.append(f"{hz}: not in the input")
            continue
        found, more = form_rows([r])
        problems += more
        got.update(found)
    problems += [f"{hz}: answered {n} times" for hz, n in seen.items() if n > 1 and hz in want]
    problems += [f"{hz}: missing" for hz in want if hz not in seen]
    return problems, [[hz, got[hz][0], " ".join(got[hz][1])] for hz in want if hz in got]


def name_rows(rows):
    """{hz: (words, capitals)} from the rows of data/manual/capitals, and the problems found.

    Each row has hz, words and capital. words is empty for a name of one word (欧洲). For a
    person's name it lists the words that spell hz, separated by spaces, because the textbook
    rules write the surname apart from the given name and a title apart from the name (王建国
    "王 建国", 李老师 "李 老师"). capital is one Y or N for all the words, or one per word. So
    {"hz": "李老师", "words": "李 老师", "capital": "Y N"} gives {"李老师": (["李", "老师"], [True, False])}.
    Since the user's decision of 2026-09-29 all pinyin is in lower case ("lǐ lǎoshī"), so the file
    only gives a name's words, and a Y only marks a row as a name (a word with only N, such as
    正月, is a common noun). A value other than Y or N, a number of values that does not fit
    the words, words that do not spell hz and a headword listed twice are problems.
    """
    out, problems = {}, []
    for r in rows:
        hz = (r.get("hz") or "").strip()
        words = (r.get("words") or "").split() or [hz]
        values = (r.get("capital") or "").upper().split()
        if len(values) == 1:
            values = values * len(words)
        if not values or any(v not in ("Y", "N") for v in values) or len(values) != len(words):
            problems.append(f"{hz}: capital is {r.get('capital')!r}, not one Y or N, or one per word")
        elif "".join(words) != hz:
            problems.append(f"{hz}: words {r.get('words')!r} do not spell it")
        elif hz in out:
            problems.append(f"{hz}: listed twice")
        else:
            out[hz] = (words, [v == "Y" for v in values])
    return out, problems
