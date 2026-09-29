"""The strict checker for corrected sentence pinyin (Plan 3b Task 13).

Claude batch agents correct the draft pinyin of each example sentence against the pinyin style
sheet (the section "Pinyin style sheet" of .claude/plans/words-json-schema.md). check_line accepts
a corrected line only when it finds no problem. It checks that:
1. every Chinese character lines up with exactly one pinyin syllable, in order, where a 儿 right
   after a syllable of the same word may be the 儿 ending, a bare "r" ("nǎr");
2. each syllable, with its tone, is a known reading of its character (known_readings, which are the
   public list's readings of the character, or pypinyin's when the list lacks it, and every reading
   that a longer word of the public list or a card gives it). A neutral tone that the readings lack
   counts only inside a word ("dōngxi");
3. digits and Latin letters stand unchanged ("2012", "IT");
4. the punctuation maps one to one, where PUNCTUATION turns each Chinese mark into its Western mark;
5. the headword shows the syllables its card shows, tones included, with the card's word spacing
   between them. Only a 一 or 不 at its end may show its tone change ("bú shì" for the card 不 "bù");
6. capitals stand only where the style sheet allows them, which is at the start of a sentence and
   of a quotation after a colon, and on a word of a name that the cards or data/manual/capitals write
   with a capital (people and places, languages, countries and peoples). Such a name where the line
   writes it as a name (_capital_problems), the start of the line and the start of a sentence after
   . ! or ? must have their capital;
7. 一 and 不 show their tone changes where a rule settles them (style sheet points 6 and 8, see
   _tone_change_problems). That is "bú" and "yí" before a fourth tone, "bù" and "yì" before the
   other tones, "yī" in a decimal and after 第, a numeral, 星期 or 礼拜 ("dì-yī", "shíyī"), a tone
   change for a 一 that counts ("yí gè", "yìqiān"), and a neutral "bu" or "yi" only in a doubled word
   ("kàn yi kàn"), in a potential complement ("zhǎo bu dào") and where a card or the public list
   shows it ("duìbuqǐ");
8. the words that points 1 and 2 of the style sheet write as one word are one pinyin word (这个
   "zhège", 那些 "nàxiē", 八月 "bāyuè", 星期五 "xīngqīwǔ");
9. numbers are spaced as point 6 of the style sheet says (_number_problems), with 11 to 99 and each
   group of 百, 千, 万 and 亿 joined ("shí'èr", "yìqiān wǔbǎi"), 第 with a hyphen ("dì-shí"), a numeral
   apart from its measure word ("sān gè"), and a fraction and the digits of a decimal syllable by
   syllable ("sān fēn zhī yī", "sān diǎn yī sì");
10. a 了 that ends a sentence or a clause is a word of its own ("xià yǔ le.", point 3).
It also checks the form of each syllable, which is at most one tone mark, on the vowel the rules
name, and an apostrophe before a syllable inside a word that starts with a, o or e, and nowhere else,
and that no space stands before a closing mark such as , . ! or ?.
Each problem is one plain sentence, which a redo agent receives with the line.
"""
import re
import unicodedata

from pypinyin import Style, pinyin
from pypinyin.pinyin_dict import pinyin_dict

from meaning import public_pos
from pinyin_text import joints_of_py, num_to_marked, syllable_to_num, syllables_of_py
from sentpinyin import NUMERALS, approximate, decimal_positions, number_words, potential

_HANZI = re.compile(r"[\u3007\u4e00-\u9fff]")  # Chinese characters, with the 〇 of years (二〇〇八年)
_TONE_MARKS = re.compile("[\u0304\u0301\u030c\u0300]")
# Each Chinese punctuation mark and the Western mark it becomes in the pinyin (style sheet point 9).
# The Chinese dash of two long dashes becomes one "-" standing between spaces.
PUNCTUATION = {"，": ",", "。": ".", "！": "!", "？": "?", "：": ":", "；": ";", "、": ",", "“": '"', "”": '"',
               "‘": "'", "’": "'", "（": "(", "）": ")", "《": '"', "》": '"', "……": "...", "…": "...",
               "\u2014\u2014": "-", "\u2014": "-", ",": ",", ".": ".", "!": "!", "?": "?", ":": ":", ";": ";",
               '"': '"', "(": "(", ")": ")"}
_WESTERN = set(",.!?:;\"'()")
_CLOSING = (",", ".", "!", "?", ":", ";", ")", "...")  # marks written right after the word before them
# Digits and Latin letters in a sentence, which the pinyin line keeps as they are ("2012", "IT", "3.14", "50%").
_LITERAL = re.compile(r"[A-Za-z0-9]+(?:[.:,][0-9]+)*%?")
_LINE_TOKEN = re.compile(r"(\s+)|(\.\.\.|…)|([A-Za-z0-9]+(?:[.:,][0-9]+)+%?)|([^\W_]+(?:['’][^\W_]+)*%?)|(-)|(.)",
                         re.S)
# The tones a 一 or 不 at the end of a headword may show, as in the validator (Task 18).
_TONES_OF = {("一", "yi1"): {"yi1", "yi2", "yi4", "yi5"}, ("不", "bu4"): {"bu4", "bu2", "bu5"}}
# The only readings of 一 and 不, which are the dictionary tone and the tones of their tone changes (point 8).
_TONE_CHANGES = {"一": {"yi1", "yi2", "yi4", "yi5"}, "不": {"bu4", "bu2", "bu5"}}
# 〇, the zero of years (二〇〇八年), is read only líng, although pypinyin also knows yuán and xīng.
_ONLY_READINGS = {**_TONE_CHANGES, "〇": {"ling2"}}
# Words after which a 一 counts or starts a word such as 一起, so it shows its tone change unless 第
# or another numeral stands before it (一个 "yí gè", 一千 "yìqiān", 一些 "yìxiē", but 第一个 "dì-yī gè"
# and 十一个 "shíyī gè"). word_facts adds every measure word of the two lists (斤, 家, 天, 年).
_COUNTED = set("百千万亿刻个些下起样直定共切般边种位件本张条只次")
# After 一 these start an ordinal or a date rather than a count, so no rule settles its tone:
# 一号 and 一日 "yī hào", "yī rì" (the first day), 一班 (class one), 一年级 "yī niánjí", 一级, 一期,
# 一季度, 一楼 and 一层 (the first floor).
_ORDINAL_AFTER = ("号", "日", "班", "年级", "级", "期", "季度", "楼", "层")
# Particles after which a 了 still ends its sentence ("Nǐ lái le ma?").
_FINAL_PARTICLES = set("吗吧呢啊呀啦嘛")
# A run of numerals, with 几 as in 十几 and 几十.
_NUMBER_RUN = re.compile("[〇零一二两三四五六七八九十百千万亿几]+")
# What points 1 and 2 of the style sheet write as one word: 这个, 那个, 哪个, 这些, 那些 and 哪些, and month
# and weekday names (八月 "bāyuè", 十二月 "shí'èryuè", 星期五 "xīngqīwǔ"), but not 三个月 or 六月份.
_ONE_WORD = [(1, re.compile(r"[这那哪][个些]")),
             (2, re.compile(r"(?<![〇零一二两三四五六七八九十百千万几第])(?:十[一二]|[一二三四五六七八九十])月(?!份)")),
             (2, re.compile(r"(?:星期|礼拜)[一二三四五六日天](?![次个])"))]


def toneless(syllable):
    """A syllable in lower case without its tone mark, with ü kept, so "Lǜ" gives "lü"."""
    bare = _TONE_MARKS.sub("", unicodedata.normalize("NFD", syllable))
    return unicodedata.normalize("NFC", bare).lower()


# Every toneless syllable pypinyin knows that has a vowel, which is what a pinyin word is divided into.
SYLLABLES = {toneless(s) for value in pinyin_dict.values() for s in value.split(",")}
SYLLABLES = {s for s in SYLLABLES if re.fullmatch(r"[a-zü]+", s) and re.search("[aeiouü]", s)}


def known_readings(listed, cards):
    """readings(ch) gives the set of numbered readings a character is known to have, such as {"ta1"}.

    listed: Plan 3a public_readings of the public list. cards: the card rows, with hz, pyNum and py.
    When the public list has the character as a word of its own, its readings there are used, as
    make_readings_of in step 8 does, because pypinyin also knows rare old readings (他 tuo2, 是 ti2).
    Unlike there, the readings of names count too (蒙 meng3 as in 蒙古). A character that the list
    lacks takes pypinyin's readings (heteronyms). Every syllable that a longer word of the public
    list or a card gives the character counts too, in the tones of pyNum and as the card's py shows
    them, so 行 has xing2 and hang2, 的 has di4 from 目的, and 不 has bu5 from 受不了 "shòubuliǎo".
    儿 also has the 儿 ending r5. 一 and 不 have exactly their dictionary tone and the tones of their
    tone changes (yi1 yi2 yi4 yi5, bu4 bu2 bu5), and 〇 has only ling2.
    """
    extra = {}
    pairs = [(hz, r["num"]) for hz, options in listed.items() if len(hz) > 1 for r in options]
    for w in cards:
        hz, nums = w["hz"].replace("…", ""), w["pyNum"].split()
        pairs.append((hz, w["pyNum"]))
        shown = syllables_of_py(w["py"], nums) if w.get("py") else None
        if shown:
            pairs.append((hz, " ".join(shown)))
    for hz, num in pairs:
        nums = num.split()
        if len(nums) == len(hz):
            for ch, syl in zip(hz, nums):
                extra.setdefault(ch, set()).add(syl.lower())
    cache = {}

    def readings(ch):
        if ch not in cache:
            own = {r["num"] for r in listed.get(ch, []) if len(r["num"].split()) == 1}
            found = own or set(pinyin(ch, style=Style.TONE3, heteronym=True, neutral_tone_with_five=True,
                                      v_to_u=True)[0])
            found = {s for s in found | extra.get(ch, set()) if re.fullmatch(r"[a-zü]*[aeiouü][a-zü]*[1-5]", s)}
            cache[ch] = _ONLY_READINGS.get(ch, found | ({"er2", "r5"} if ch == "儿" else set()))
        return cache[ch]
    return readings


def names_of(name_table, cards):
    """{hz: (words, capitals)} for every name that takes a capital in a sentence.

    name_table: Plan 3a pinyin_text.name_rows of data/manual/capitals. cards: the card rows. A card
    whose py starts with a capital (中国 "Zhōngguó", 北京 "Běijīng") is a name of one word with a capital.
    """
    out = {hz: v for hz, v in name_table.items() if any(v[1])}
    for w in cards:
        if w["py"][:1].isupper() and "…" not in w["hz"] and w["hz"] not in name_table:
            out[w["hz"]] = ([w["hz"]], [True])
    return out


def word_facts(complete, listed, cards):
    """What the checks of 一, 不, numbers and 了 need to know about words, as a dict.

    complete: the public list (hsk_complete, Plan 3a). listed: its public_readings. cards: the card rows.
    - "pos": {word: part-of-speech labels} of the public list and the cards, built as step 8 builds
      it, so sentpinyin.potential tells a potential complement (找不到) from a plain 不 (我不去).
    - "known": every card headword and every word of the public list.
    - "measure": the measure words of one character (the label "m.", as 个, 斤, 天 and 年 have it),
      from which a numeral stands apart ("sān gè rén"), except 月, whose month names are one word.
    - "counted": those measure words and _COUNTED, before which a 一 that counts shows its tone change.
    - "shown": {character: {(word, offset, syllable)}} for each 一 and 不 inside a card of two or
      more characters, with the syllable its py shows (一起 "yìqǐ" gives ("一起", 0, "yi4")), and
      inside a word of the public list whose reading has a neutral bu or yi (差不多 cha4 bu5 duo1
      gives ("差不多", 1, "bu5")). Such a 一 or 不 may show that syllable wherever the word stands.
    """
    pos = {x["simplified"]: public_pos(x.get("pos", [])) for x in complete}
    for w in cards:
        pos[w["hz"]] = list(dict.fromkeys(pos.get(w["hz"], []) + list(w.get("pos", []))))
    known = {w["hz"] for w in cards if "…" not in w["hz"]} | {x["simplified"] for x in complete}
    measure = {word for word, labels in pos.items() if len(word) == 1 and "m." in labels} - {"月"}
    shown = {}
    pairs = [(w["hz"], syllables_of_py(w["py"], w["pyNum"].split())) for w in cards
             if len(w["hz"]) > 1 and "…" not in w["hz"]]
    pairs += [(hz, r["num"].split()) for hz, options in listed.items() if len(hz) > 1 for r in options
              if {"bu5", "yi5"} & set(r["num"].split())]
    for hz, sylls in pairs:
        if sylls and len(sylls) == len(hz):
            for k, (ch, syl) in enumerate(zip(hz, sylls)):
                if ch in _TONE_CHANGES:
                    shown.setdefault(ch, set()).add((hz, k, syl))
    return {"pos": pos, "known": known, "measure": measure, "counted": measure | _COUNTED, "shown": shown}


def head_positions(sentence, hz):
    """Indexes of the sentence characters that belong to the headword (each part, first match, in order)."""
    out, start = [], 0
    for part in (p for p in hz.split("…") if p):
        at = sentence.find(part, start)
        if at < 0:
            return []
        out += range(at, at + len(part))
        start = at + len(part)
    return out


def sentence_units(sentence):
    """The sentence as [(kind, text)]: "han" for a Chinese character, "literal" for digits and Latin
    letters, "mark" for a punctuation mark in its Western form and "other" for anything else. Spaces
    are left out."""
    out, i = [], 0
    while i < len(sentence):
        ch, literal = sentence[i], _LITERAL.match(sentence, i)
        if _HANZI.match(ch):
            out.append(("han", ch))
            i += 1
        elif literal:
            out.append(("literal", literal.group()))
            i = literal.end()
        elif sentence[i:i + 2] in PUNCTUATION:
            out.append(("mark", PUNCTUATION[sentence[i:i + 2]]))
            i += 2
        elif ch in PUNCTUATION:
            out.append(("mark", PUNCTUATION[ch]))
            i += 1
        else:
            if not ch.isspace():
                out.append(("other", ch))
            i += 1
    return out


def line_items(line):
    """The pinyin line as [(kind, text, spaced)], where kind is "word", "literal", "joint" (a hyphen
    inside a word, as in "yì-liǎng"), "mark" or "other", and spaced says whether a space stands before
    it. A word holds letters and apostrophes, and a literal holds digits."""
    tokens, spaced = [], True
    for m in _LINE_TOKEN.finditer(unicodedata.normalize("NFC", line)):
        space, dots, number, word, hyphen, other = m.groups()
        if space:
            spaced = True
            continue
        if dots:
            tokens.append(["mark", "...", spaced])
        elif number or (word and re.search(r"\d", word)):
            tokens.append(["literal", number or word, spaced])
        elif word:
            tokens.append(["word", word.replace("’", "'"), spaced])
        elif hyphen:
            tokens.append(["joint", "-", spaced])
        else:
            tokens.append(["mark" if other in _WESTERN else "other", other, spaced])
        spaced = False
    for k, token in enumerate(tokens):
        if token[0] == "joint":
            inside = 0 < k < len(tokens) - 1 and tokens[k - 1][0] == "word" and tokens[k + 1][0] == "word" \
                and not token[2] and not tokens[k + 1][2]
            if not inside:
                token[0] = "mark"
    return [tuple(t) for t in tokens]


def segmentations(word):
    """The ways to divide one pinyin word (letters and apostrophes) into syllables, as [(syllables, problems)].

    A syllable is one that pypinyin knows (SYLLABLES), or a bare "r" after a syllable, which is the
    儿 ending. When some ways follow the apostrophe rule and put each tone mark in its place, only
    those are returned, with empty problems. Otherwise the ways that break a rule are returned, each
    with what it breaks, for example "an apostrophe is missing before 'ér' in 'nǚér'".
    "nǚ'ér" gives [(["nǚ", "ér"], [])] and "zhèr" gives [(["zhè", "r"], [])].
    """
    text, found = unicodedata.normalize("NFC", word), []

    def walk(i, done, problems):
        if len(found) >= 24:
            return
        if i == len(text):
            found.append((done, problems))
            return
        apostrophe = text[i] == "'"
        start = i + 1 if apostrophe else i
        if apostrophe and not done:
            return
        for end in range(start + 1, min(len(text), start + 6) + 1):
            piece = text[start:end]
            if "'" in piece:
                break
            base = toneless(piece)
            if base == "r" and done and not apostrophe:
                walk(end, done + [piece], problems)
            elif base in SYLLABLES:
                more = list(problems)
                if not _marked_well(piece):
                    more.append(f"'{piece}' needs one tone mark on the right vowel, or none for the neutral tone")
                if done and base[0] in "aoe" and not apostrophe:
                    more.append(f"an apostrophe is missing before '{piece}' in '{word}'")
                if apostrophe and base[0] not in "aoe":
                    more.append(f"an apostrophe stands before '{piece}' in '{word}', but only a syllable "
                                "that starts with a, o or e takes one")
                walk(end, done + [piece], more)

    walk(0, [], [])
    clean = [way for way in found if not way[1]]
    return clean or sorted(found, key=lambda way: len(way[1]))


def _marked_well(syllable):
    """True when a syllable has at most one tone mark, on the vowel the rules name ("hǎo", not "haǒ")."""
    low = unicodedata.normalize("NFC", syllable).lower()
    return low == "r" or num_to_marked(syllable_to_num(low)) == low


def _reading_problem(syl, ch, first, readings_of):
    """Why a syllable is not a known reading of its character, or None (check_line point 2).

    first: whether the syllable starts its pinyin word. A neutral tone that the character's readings
    lack counts only inside a word, where the dictionary writes many ("dōngxi", "xuésheng", "kànkan").
    So for 他 (readings ta1) "Tā" passes, while "Tuó" and "Tà" fail.
    """
    num, known = syllable_to_num(syl), readings_of(ch)
    same_letters = any(k[:-1] == num[:-1] for k in known)
    if num in known or (num.endswith("5") and not first and same_letters):
        return None
    where = " at the start of a word" if num.endswith("5") and same_letters else ""
    return f"'{syl}' is not a reading of {ch}{where}; its readings are " + \
        (", ".join(sorted(num_to_marked(k) for k in known)) or "unknown")


def _shown(text, sylls):
    """The syllables of one pinyin word as the line writes them, with the apostrophe before a syllable kept."""
    out, at = [], 0
    for syl in sylls:
        mark = text[at:at + 1] == "'"
        at += mark
        out.append("'" * mark + text[at:at + len(syl)])
        at += len(syl)
    return out


def _written(cells, span):
    """The pinyin of the sentence characters at the indexes `span`, as the line writes it ("nǎ'ér", "zhè gè")."""
    out = ""
    for k, i in enumerate(span):
        _, joint, _, shown = cells[i]
        out += joint + shown if k else shown.lstrip("'")
    return out


def _align(run, words, readings_of):
    """Line up the Chinese characters of one run with the pinyin words between the same marks.

    run: [(sentence index, character)]. words: [(text, joint, item index)]. Returns (cells, problems),
    where cells holds one (syllable, joint before it, item index, the syllable as written) per
    character, or None when the syllables cannot line up with the characters. The joint is "" inside
    a word, and the syllable as written keeps an apostrophe before it ("'ér" in "nǚ'ér").
    """
    ways = [segmentations(text) for text, _, _ in words]
    bad = [f"'{text}' cannot be divided into pinyin syllables" for (text, _, _), w in zip(words, ways) if not w]
    if bad:
        return None, bad
    best = {(0, 0): (0, [])}
    for wi in range(len(words)):
        for (w, c), (cost, path) in [item for item in best.items() if item[0][0] == wi]:
            for sylls, problems in ways[wi]:
                if c + len(sylls) > len(run):
                    continue
                extra, fits = len(problems), True
                for k, syl in enumerate(sylls):
                    ch = run[c + k][1]
                    if toneless(syl) == "r" and k:
                        fits = fits and ch == "儿"
                    elif _reading_problem(syl, ch, k == 0, readings_of):
                        extra += 1
                key, value = (wi + 1, c + len(sylls)), (cost + extra, path + [(sylls, problems)])
                if fits and (key not in best or value[0] < best[key][0]):
                    best[key] = value
    end = best.get((len(words), len(run)))
    if end is None:
        count = sum(len(w[0][0]) - sum(1 for s in w[0][0][1:] if toneless(s) == "r") for w in ways)
        han = "".join(ch for _, ch in run)
        text = " ".join(t for t, _, _ in words)
        return None, [f"the {len(run)} characters {han} do not line up with the {count} syllables of '{text}'"]
    cells, problems = [], []
    for (sylls, more), (text, joint, item) in zip(end[1], words):
        problems += more
        for k, (syl, shown) in enumerate(zip(sylls, _shown(unicodedata.normalize("NFC", text), sylls))):
            cells.append((syl, joint if k == 0 else "", item, shown))
    for (index, ch), (syl, joint, _, _) in zip(run, cells):
        if toneless(syl) == "r" and ch == "儿":
            continue
        wrong = _reading_problem(syl, ch, bool(joint), readings_of)
        if wrong:
            problems.append(wrong)
    return cells, problems


def check_line(sentence, line, head, readings_of, names, facts):
    """Problems of one corrected pinyin line; an empty list means the line is accepted.

    sentence: the Chinese sentence. line: the corrected pinyin. head: the card, a dict with hz, py
    and pyNum. readings_of: known_readings. names: names_of, {hz: (words, capitals)}. facts: word_facts.
    "他在打电话呢。" with "Tā zài dǎ diànhuà ne." and the card 打电话 "dǎ diànhuà" gives [].
    """
    han = _HANZI.findall(line)
    if han:
        return [f"the line holds Chinese characters ({''.join(han)}); write only pinyin"]
    units, items = sentence_units(sentence), line_items(line)
    problems = [f"the line holds '{text}', which is neither pinyin nor a Western punctuation mark"
                for kind, text, _ in items if kind == "other"]
    problems += [f"the sentence holds '{text}', which the checker does not know"
                 for kind, text in units if kind == "other"]
    problems += [f"a space stands before '{text}', which is written right after the word before it"
                 for kind, text, spaced in items[1:] if kind == "mark" and spaced and text in _CLOSING]
    marks = [text for kind, text in units if kind == "mark"]
    line_marks = [text for kind, text, _ in items if kind == "mark"]
    if marks != line_marks:
        return problems + [f"the sentence has the punctuation {' '.join(marks) or 'none'} but the line has "
                           f"{' '.join(line_marks) or 'none'}"]
    cells, literal_items = {}, set()
    chunks_s, chunks_l = [[]], [[]]
    for kind, text in units:
        if kind == "mark":
            chunks_s.append([])
        elif kind in ("han", "literal"):
            chunks_s[-1].append((kind, text, None))
    positions = [k for k, ch in enumerate(sentence) if _HANZI.match(ch)]
    for n, (kind, text, spaced) in enumerate(items):
        if kind == "mark":
            chunks_l.append([])
        elif kind in ("word", "literal"):
            joint = "-" if n and items[n - 1][0] == "joint" else " "
            chunks_l[-1].append((kind, text, joint, n))
    han_at = iter(positions)
    for part_s, part_l in zip(chunks_s, chunks_l):
        literals = [text for kind, text, _ in part_s if kind == "literal"]
        runs, run = [], []
        for kind, text, _ in part_s:
            if kind == "han":
                run.append((next(han_at), text))
            else:
                runs.append(run)
                run = []
        runs.append(run)
        line_literals = [text for kind, text, _, _ in part_l if kind == "literal" or text in literals]
        if line_literals != literals:
            missing = list(literals)
            for text in line_literals:
                if text in missing:
                    missing.remove(text)
                else:
                    problems.append(f"'{text}' in the line is not in the sentence")
            problems += [f"the digits or Latin letters '{text}' of the sentence are missing or changed in the line"
                         for text in missing]
            continue
        groups, group = [], []
        for kind, text, joint, n in part_l:
            if kind == "literal" or text in literals:
                groups.append(group)
                group = []
                literal_items.add(n)
            else:
                group.append((text, joint, n))
        groups.append(group)
        for run, words in zip(runs, groups):
            if not run and not words:
                continue
            if not run or not words:
                what = "".join(ch for _, ch in run) or " ".join(t for t, _, _ in words)
                problems.append(f"'{what}' has no partner, because every Chinese character needs one syllable and "
                                "every syllable one character")
                continue
            got, more = _align(run, words, readings_of)
            problems += more
            if got:
                cells.update({index: cell for (index, _), cell in zip(run, got)})
    problems += _head_problems(sentence, cells, head)
    problems += _tone_change_problems(sentence, cells, head, facts)
    problems += _one_word_problems(sentence, cells, head)
    problems += _number_problems(sentence, cells, head, facts)
    problems += _final_le_problems(sentence, cells, facts)
    problems += _capital_problems(sentence, items, cells, names, literal_items)
    return problems


def _head_problems(sentence, cells, head):
    """The headword must show the syllables and word spacing of its card (check_line point 5)."""
    at = head_positions(sentence, head["hz"])
    nums = head["pyNum"].split()
    shown, joints = syllables_of_py(head["py"], nums), joints_of_py(head["py"], nums)
    if not at:
        return [f"the sentence does not contain the headword {head['hz']}"]
    if shown is None or joints is None or len(at) != len(shown) or any(i not in cells for i in at):
        return []
    parts = [p for p in head["hz"].split("…") if p]
    ends, total = set(), 0
    for part in parts:
        total += len(part)
        ends.add(total - 1)
    wrong = False
    for k, i in enumerate(at):
        syl, joint, _, _ = cells[i]
        have = "r5" if toneless(syl) == "r" else syllable_to_num(syl)
        if have != shown[k] and not (k in ends and have in _TONES_OF.get((sentence[i], nums[k]), ())):
            wrong = True
        if k and k - 1 not in ends and joints[k - 1] != joint:
            wrong = True
    if not wrong:
        return []
    starts = [0] + [end + 1 for end in sorted(ends)][:-1]
    written = "…".join(_written(cells, at[a:b + 1]) for a, b in zip(starts, sorted(ends)))
    return [f"the headword {head['hz']} must be written '{head['py']}' as on its card, but the line has '{written}'"]


def _tone_change_problems(sentence, cells, head, facts):
    """The tone changes of 一 and 不 where a rule settles them (check_line point 7, style sheet points 6 and 8).

    A 一 or 不 inside a card or public-list word may show the syllable that word shows (facts["shown"],
    "duìbuqǐ", "yìqǐ"). Otherwise:
    - a neutral "bu" or "yi" stands only in a doubled word ("kàn yi kàn", "hǎo bu hǎo", "xǐ bu
      xǐhuan") and, for 不, in a potential complement (sentpinyin.potential, "zhǎo bu dào");
    - 不 is "bú" before a fourth tone and "bù" before the other tones;
    - 一 keeps "yī" in a decimal ("sān diǎn yī sì") and after 第, a numeral, 星期 or 礼拜 ("dì-yī",
      "shíyī gè", "xīngqīyī"), unless 百, 千, 万 or 亿 follows it or it starts a word of the lists (千万
      一定 "qiānwàn yídìng");
    - elsewhere 一 is "yí" before a fourth tone and "yì" before the other tones, it keeps "yī" where no
      syllable follows it, and it shows its tone change when it starts a word before a measure word
      or another word of facts["counted"] ("yí gè", "yì nián", "yìqiān"). Before a neutral tone the
      choice between "yí" and "yì" is open, and nothing is settled before an ordinal or a date
      (_ORDINAL_AFTER, 一号 "yī hào") or before 点, which may be a time of day ("yī diǎn"), except in
      一点儿 and 一点点. Before any other character "yī" may stand too (一楼 "yī lóu").
    A 一 or 不 inside the headword keeps the tone its card shows (受不了 "shòubuliǎo").
    So "Wǒ bù qù.", "Wǒ bu qù.", "Wǒ yī gè rén qù.", "yī tiān" and "dì-yí cì" fail, while "Wǒ bú qù.",
    "Wǒ yí gè rén qù.", "yì tiān" and "dì-yī cì" pass.
    """
    at, ends, total = head_positions(sentence, head["hz"]), set(), 0
    for part in (p for p in head["hz"].split("…") if p):
        total += len(part)
        ends.add(total - 1)
    inner = {i for k, i in enumerate(at) if k not in ends}
    decimal, problems = decimal_positions(sentence), []
    for i in sorted(cells):
        ch, (syl, joint, _, _) = sentence[i], cells[i]
        if ch not in _TONE_CHANGES or i in inner:
            continue
        num, nxt = syllable_to_num(syl), cells.get(i + 1)
        tone = num[-1]
        after = syllable_to_num(nxt[0])[-1] if nxt and toneless(nxt[0]) != "r" else ""
        if _shown_here(sentence, i, num, facts["shown"]):
            continue
        kept = _keeps_yi(sentence, i, facts["known"]) if ch == "一" else ""
        if tone == "5":
            if not (_doubled(sentence, i) or (ch == "不" and _potential_at(sentence, i, facts["pos"]))):
                problems.append(f"'{syl}' ({ch}) is in the neutral tone, which the style sheet keeps for a doubled "
                                "word ('kàn yi kàn', 'hǎo bu hǎo'), a potential complement ('zhǎo bu dào') and the "
                                "words that a card or the public list writes so ('duìbuqǐ')")
            continue
        if ch == "不":
            if tone == "4" and after == "4":
                problems.append(f"'{syl}' (不) comes before the fourth tone of '{nxt[0]}', so it is written 'bú'")
            elif tone == "2" and after not in ("4", "5"):
                problems.append(f"'{syl}' (不) is written 'bú' only before a fourth tone, so write 'bù' here")
        elif i in decimal:
            if tone != "1":
                problems.append(f"'{syl}' (一) is a digit of a decimal number, which is read digit by digit, so it "
                                "keeps its first tone 'yī'")
        elif kept:
            if tone != "1":
                problems.append(f"'{syl}' (一) follows {kept}, so it is part of a number, an ordinal or a weekday and "
                                "keeps its first tone 'yī'")
        elif tone == "4" and after == "4":
            problems.append(f"'{syl}' (一) comes before the fourth tone of '{nxt[0]}', so it is written 'yí'")
        elif tone == "2" and after in ("1", "2", "3"):
            problems.append(f"'{syl}' (一) comes before '{nxt[0]}', which is not a fourth tone, so it is written 'yì'")
        elif tone in ("2", "4") and not after:
            problems.append(f"'{syl}' (一) has no syllable after it, so it keeps its first tone 'yī'")
        elif tone == "1" and joint and _counts(sentence, i, facts["counted"]) \
                and not (i and sentence[i - 1] in NUMERALS | {"第"}):
            problems.append(f"'{syl}' (一) counts with {sentence[i + 1]} here, so it shows its tone change, 'yí' "
                            "before a fourth tone and 'yì' before the other tones")
    return problems


def _shown_here(sentence, i, num, shown):
    """True when the 一 or 不 at index i stands inside a word of facts["shown"] that shows the syllable num."""
    return any(sentence[i - k:i - k + len(word)] == word and syl == num
               for word, k, syl in shown.get(sentence[i], ()) if i >= k)


def _doubled(sentence, i):
    """True when the 一 or 不 at index i stands between two copies of a word (看一看, 好不好, 喜不喜欢, 喜欢不喜欢)."""
    one = sentence[i - 1:i]
    return bool(one and _HANZI.match(one) and sentence[i + 1:i + 2] == one) or \
        (i >= 2 and bool(_HANZI.match(sentence[i - 2])) and sentence[i - 2:i] == sentence[i + 1:i + 3])


def _potential_at(sentence, i, pos):
    """True when the 不 at index i is the middle of a potential complement (找不到, 听不懂, 忍受不了)."""
    verbs = [sentence[j:i] for j in (i - 1, i - 2) if j >= 0]
    results = [sentence[i + 1:i + 1 + n] for n in (1, 2) if i + n < len(sentence)]
    return any(potential(verb, result, pos) for verb in verbs for result in results)


def _keeps_yi(sentence, i, known):
    """The word before the 一 at index i when that 一 is part of a number, an ordinal or a weekday, so it
    keeps "yī" (第 in 第一, 十 in 十一个, 星期 in 星期一), else ""."""
    if sentence[max(i - 2, 0):i] in ("星期", "礼拜"):
        return sentence[i - 2:i]
    if sentence[i - 1:i] == "第":
        return "第"
    if not i or sentence[i - 1] not in NUMERALS or sentence[i + 1:i + 2] in ("百", "千", "万", "亿"):
        return ""
    if any(sentence[i:i + n] in known and not _NUMBER_RUN.fullmatch(sentence[i:i + n]) for n in (2, 3, 4)):
        return ""
    return sentence[i - 1]


def _counts(sentence, i, counted):
    """True when the 一 at index i counts with the word after it (一个, 一天, 一千), see _tone_change_problems."""
    rest = sentence[i + 1:]
    if rest[:1] not in counted or rest.startswith(_ORDINAL_AFTER):
        return False
    return rest[:1] != "点" or rest[1:2] in ("儿", "点")


def _one_word_problems(sentence, cells, head):
    """What points 1 and 2 of the style sheet write as one word must be one pinyin word (check_line point 8).

    Only the sentence of the card 个 or 些 may write 这个 or 这些 apart, because there the headword
    must show its card's "gè" ("zhè gè"). So "Zhè gè rén hěn hǎo." fails for the card 人.
    """
    problems = []
    for point, pattern in _ONE_WORD:
        for m in pattern.finditer(sentence):
            span = list(range(m.start(), m.end()))
            if (point == 1 and head["hz"] in ("个", "些")) or any(i not in cells for i in span) \
                    or len({cells[i][2] for i in span}) == 1:
                continue
            problems.append(f"{m.group()} is written as one word (point {point} of the style sheet), but the line "
                            f"has '{_written(cells, span)}'")
    return problems


def _joint(cells, j):
    """The joint that the line writes between the sentence characters j - 1 and j ("" inside a word, else " " or "-")."""
    return "" if cells[j][2] == cells[j - 1][2] else cells[j][1]


def _number_problems(sentence, cells, head, facts):
    """Word breaks in and around numbers, as point 6 of the style sheet sets them (check_line point 9).

    For each run of numerals (_NUMBER_RUN) the checker knows the joint that point 6 wants between
    two characters:
    - inside the run, the joints of sentpinyin.number_words, so 十二 is "shí'èr", 一千五百 "yìqiān
      wǔbǎi" and 二〇〇八 "èr líng líng bā", with a hyphen in an approximate number ("yì-liǎng"). A run
      that is itself a word of the lists (千万, 万一) or that has two digits next to each other in a
      longer number word (五六十) is not checked inside;
    - a hyphen between 第 and the run ("dì-shí");
    - a space between the run and a measure word after it ("sān gè", "yìqiān yuán"), unless a word
      of the lists holds both (一些, 一下, 一点儿);
    - a space between the syllables of a fraction ("sān fēn zhī yī", "bǎi fēn zhī shí");
    - a space before 点 and between the digits after it in a decimal ("sān diǎn yī sì").
    Joints between two characters of the headword are left to the headword check, so the card 百分之
    keeps its "bǎifēnzhī". So "shí èr diǎn", "yì qiān yuán", "dìshí kè", "dì shí kè", "sānfēnzhīyī"
    and "yígè" fail. Each stretch of wrong joints gives one message.
    """
    head_at, known = set(head_positions(sentence, head["hz"])), facts["known"]
    decimal, want = decimal_positions(sentence), {}
    for m in _NUMBER_RUN.finditer(sentence):
        a, b, run = m.start(), m.end(), m.group()
        if sentence[a - 1:a] == "第":
            want[a] = "-"
        year = sentence[b:b + 1] == "年"
        if a in decimal and sentence[a - 1:a] == "点":
            want.update({j: " " for j in range(a, b)})
        elif len(run) > 1 and run not in known and _settled(run, year):
            words = number_words(run)
            if not any(len(w) > 2 and re.search("[〇零一二两三四五六七八九]{2}", w) for w in words):
                j = a
                for n, word in enumerate(words):
                    if n:
                        want[j] = " "
                    want.update({j + k: "-" if approximate(word) else "" for k in range(1, len(word))})
                    j += len(word)
        if sentence[b:b + 2] == "分之":
            want.update({b: " ", b + 1: " "})
            if _NUMBER_RUN.match(sentence, b + 2):
                want[b + 2] = " "
        elif sentence[b:b + 1] == "点" and b + 1 in decimal:
            want[b] = " "
        elif sentence[b:b + 1] in facts["measure"] and (len(run) == 1 or _settled(run, year)) \
                and sentence[b + 1:b + 2] != sentence[b] and not _held(sentence, b, known):
            want[b] = " "
    wrong = sorted(j for j, joint in want.items() if j - 1 in cells and j in cells
                   and not (j - 1 in head_at and j in head_at) and _joint(cells, j) != joint)
    problems, done = [], set()
    for j in wrong:
        if j in done:
            continue
        start, end = j - 1, j
        while start in want and start - 1 in cells:
            start -= 1
        while end + 1 in want and end + 1 in cells:
            end += 1
        done |= set(range(start + 1, end + 1))
        span = list(range(start, end + 1))
        expected = ""
        for k, i in enumerate(span):
            bare = cells[i][3].lstrip("'")
            joint = want.get(i, _joint(cells, i)) if k else ""
            if k and joint == "" and toneless(bare)[:1] in ("a", "o", "e"):
                bare = "'" + bare
            expected += joint + bare
        problems.append(f"the number {sentence[start:end + 1]} is written '{expected}' (point 6 of the style "
                        f"sheet), but the line has '{_written(cells, span)}'")
    return problems


def _held(sentence, j, known):
    """True when a word of the lists holds both the characters j - 1 and j (一些, 一下, 一点儿, 十分)."""
    return any(sentence[s:e] in known for s in range(max(j - 3, 0), j) for e in range(j + 1, j + 4))


def _settled(run, year):
    """True when point 6 settles the word breaks inside a run of numerals that is not a word of the lists.

    It does for a number with 十, 百, 千, 万 or 亿 (十二, 一千五百) that holds no character twice in a row,
    for the digits of a year (二〇〇八年, read one by one) and for an approximate number (一两). It does
    not for other digits, which may name a date or a festival (五一节), for a doubled word (零零落落,
    千千万万) or for 几 without 十, 百, 千 or 万.
    """
    if not re.search("[十百千万亿]", run):
        return year or approximate(run)
    return not re.search(r"(.)\1", run)


def _final_le_problems(sentence, cells, facts):
    """A 了 that ends a sentence or a clause is a word of its own (check_line point 10, style sheet point 3).

    Such a 了 is read "le" and stands before a punctuation mark, at the end or before a particle such
    as 吗 ("Zuótiān xià yǔ le.", "Nǐ lái le ma?"). A word of the lists that ends in it keeps it (算了
    "suànle"). So "Zuótiān xià yǔle." fails, while "Wǒ mǎile hěn duō dōngxi." passes.
    """
    problems = []
    for i in sorted(cells):
        if sentence[i] != "了" or i - 1 not in cells or syllable_to_num(cells[i][0]) != "le5" \
                or cells[i][2] != cells[i - 1][2]:
            continue
        rest = sentence[i + 1:i + 2]
        if (rest and not (rest in PUNCTUATION or rest in _FINAL_PARTICLES)) \
                or any(sentence[s:i + 1] in facts["known"] for s in range(max(i - 3, 0), i)):
            continue
        span = [k for k in sorted(cells) if cells[k][2] == cells[i][2]]
        problems.append(f"the 了 that ends a sentence or a clause is a word of its own ('xià yǔ le.', point 3 of "
                        f"the style sheet), but the line has '{_written(cells, span)}'")
    return problems


def _capital_problems(sentence, items, cells, names, literal_items):
    """Capitals only where the style sheet allows them, and where it needs them (check_line point 6).

    literal_items: the items that are Latin letters of the sentence ("IT"), which keep their own capitals.
    A name needs its capitals, and may have them, only where the line writes it as a name, that is,
    where its first character starts a pinyin word and its last character ends one or the whole name
    stands inside one word ("Zhōngguórén"). So in 小李明天来。 with the names 小李 and 李明, "Xiǎo Lǐ
    míngtiān lái." passes and "Xiǎo Lǐ Míngtiān lái." fails, because 明天 is one word there.
    """
    must, may = {}, set()
    for hz, (parts, flags) in names.items():
        at = sentence.find(hz)
        while at >= 0:
            end = at + len(hz) - 1
            starts = at in cells and (at - 1 not in cells or cells[at - 1][2] != cells[at][2])
            ends = end in cells and (end + 1 not in cells or cells[end + 1][2] != cells[end][2])
            inside = at in cells and end in cells and cells[at][2] == cells[end][2]
            offset = at
            for part, flag in zip(parts, flags):
                if flag and starts and (ends or inside):
                    must.setdefault(offset, hz)
                    may |= set(range(offset, offset + len(part)))
                offset += len(part)
            at = sentence.find(hz, at + 1)
    first_char = {}  # the first sentence character that each pinyin word of the line stands for
    for index in sorted(cells):
        first_char.setdefault(cells[index][2], index)
    problems, state, before = [], "start", None
    for n, (kind, text, spaced) in enumerate(items):
        if kind == "mark":
            if text in ".!?":
                state = "start"
            elif text == "...":
                state = "may"
            elif text == ":":
                state = "colon"
            elif text in "\"'":
                if state == "colon" or (state == "start" and spaced):
                    state = "start"
                elif state == "start" and before in (".", "!", "?"):
                    state = "may"
            elif text not in "()":
                state = "none"
            before = text
            continue
        before = None
        if kind == "joint":
            continue
        if kind != "word" or n in literal_items:
            state = "none"
            continue
        joined = n and items[n - 1][0] == "joint"
        index = first_char.get(n)
        if index is None:
            state = "none"
            continue
        chars = "".join(sentence[i] for i in sorted(cells) if cells[i][2] == n)
        upper = any(ch.isupper() for ch in text[1:])
        if upper:
            problems.append(f"'{text}' has a capital letter inside the word")
        if joined:
            if text[:1].isupper():
                problems.append(f"'{text}' after a hyphen starts with a capital, which only a word can have")
            continue
        capital = text[:1].isupper()
        needed = state == "start" or index in must
        allowed = needed or state in ("may", "colon") or index in may
        if capital and not allowed:
            problems.append(f"'{text}' ({chars}) starts with a capital, but the style sheet allows one only at the "
                            "start of a sentence or of a quotation after a colon, and on a name that the cards or "
                            "data/manual/capitals write with a capital")
        elif needed and not capital:
            why = "starts a sentence" if state == "start" else f"starts the name {must[index]}"
            problems.append(f"'{text}' ({chars}) needs a capital, because it {why}")
        state = "none"
    return problems


def check_answer(given, answer, head, readings_of, names, facts):
    """Problems of one agent's answer row, whose characters must stay as given and whose line must pass check_line.

    given: the batch row (id, sentence, ...). answer: the answer row (id, sentence, py, note).
    """
    written = (answer.get("sentence") or "").strip()
    if written != given["sentence"]:
        changed = next((k for k, (a, b) in enumerate(zip(written, given["sentence"])) if a != b),
                       min(len(written), len(given["sentence"])))
        return [f"the Chinese sentence was changed at character {changed + 1}, so copy it exactly as given"]
    line = (answer.get("py") or "").strip()
    if not line:
        return ["the pinyin is empty"]
    return check_line(given["sentence"], line, head, readings_of, names, facts)


def match_answers(inputs, outputs):
    """The answer row for each input id, and the problems, which are an answer for an id that is not in
    the input and two answers for one id. An input id without an answer is simply absent."""
    want = {r["id"] for r in inputs}
    got, problems, seen = {}, [], {}
    for r in outputs:
        rid = (r.get("id") or "").strip()
        seen[rid] = seen.get(rid, 0) + 1
        if rid not in want:
            problems.append(f"{rid}: not in the input")
        else:
            got[rid] = r
    problems += [f"{rid}: answered {n} times" for rid, n in seen.items() if n > 1 and rid in want]
    return {rid: r for rid, r in got.items() if seen[rid] == 1}, problems
