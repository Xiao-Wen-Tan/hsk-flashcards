"""Pinyin for example sentences.

The sentence is first cut into words (by the jieba segmenter in the build script). Each
word's syllables come from a lookup function (card readings, public-list readings and
pypinyin in the build script, a small table in the tests). The headword always gets the
card's own reading, then the 一 and 不 tone changes are applied across the whole sentence,
and the result is written in the cards' textbook word spacing (Plan 3a pinyin_text), so
"我爱我的家。" gives "Wǒ ài wǒ de jiā." and "他说不客气。" gives "Tā shuō bú kèqi."
"""
import re

import jieba.posseg

from pinyin_text import DIGITS, card_py, tone_change, yi_in_arithmetic

# Chinese characters. 〇 (U+3007), the zero of years such as 二〇〇八年, lies outside the main block, but it
# is read like a character (líng, as in "èr líng líng bā nián").
_HANZI = re.compile(r"[\u3007\u4e00-\u9fff]")
_CLOSE = {"，": ",", "。": ".", "！": "!", "？": "?", "：": ":", "；": ";", "、": ",", "”": '"', "）": ")",
          "》": '"', "…": "...", "……": "..."}
_OPEN = {"“": '"', "（": "(", "《": '"'}
_DASH = {"\u2014": "-", "\u2014\u2014": "-"}
# Characters with several readings that pypinyin reads correctly when they are a word of their
# own, so such a word is not put on the spot-check list: 的 de, 了 le, 着 zhe, 个 gè, 们 men, 么 me,
# 子 zi, plus 一 and 不, whose tones the tone-change rule sets. Inside a longer word that neither
# list has they are checked like any other character (着 in 睡着 is zháo), except 一.
SAFE_ALONE = set("的了着个们么子一不")
SYLLABLE = re.compile(r"^[a-zü]+[1-5]$")
_WORD = re.compile(r"^[\u3007\u4e00-\u9fff]+$")
# 们 and the aspect particles 着, 了 and 过 join the word before them in the textbook rules (去过).
JOINS_BEFORE = set("们着了过")
# Suffixes that the rules join to the word before them (桃子, 作者, 驾驶员, 实质性, 现代化). Unlike 家, 手
# and 头, they are hardly ever a word of their own, so a lone one joins the word before it.
SUFFIXES = set("子者员性化")
# Endings that a noun or verb of two characters keeps in the same word, like the suffixes above
# (歌唱家 "gēchàngjiā", 体育迷 "tǐyùmí", 装饰品 "zhuāngshìpǐn"). 家 alone is also a word (回 家), so it
# is not one of the SUFFIXES.
WORD_ENDINGS = set("家迷品")
# In a short word that neither list has, the textbook rules put a space after these pieces:
# pronouns, and 这 那 哪 各 每 某 本 该 before a noun or a measure word (我 家, 这 件, 每 天), and
# adverbs (很 多, 不 能, 都 会).
PRONOUNS = {"我", "你", "您", "他", "她", "它", "谁", "我们", "你们", "他们", "她们", "它们", "咱们", "这", "那", "哪",
            "各", "每", "某", "本", "该", "此", "另", "这么", "那么", "这样", "那样", "怎么", "什么", "任何", "所有"}
ADVERBS = set("很不没都也还就才太最更真又再别只已刚挺极常总未仅略并越先少")
# Prepositions after a verb, which the rules write apart (坐 在, 送 给, 走 向, 生 于).
PREPOSITIONS = set("在给向往于")
# Place words, which the rules write apart from the noun before them (山 上, 河 里).
LOCATIVES = set("上下里外中内前后旁边")
# Adjectives that stand apart from one noun after them (大 树, 老 房子).
ADJECTIVES = set("大小老新旧全好")
# 这, 那 and 哪 are written joined to 点儿, 般, 边, 时 and 会儿 (这点儿 "zhèdiǎnr").
JOINED_AFTER_THIS = {"点", "点儿", "般", "边", "时", "会儿"}
# Point 1 of the pinyin style sheet writes these as one word each, with a neutral ge ("zhège", "nàge",
# "nǎge"), like 这些, 那些 and 哪些, which the public list has. Step 8 treats them as known words with
# these readings, so they are never split and never go on the check list.
POINTING_WORDS = {"这个": "zhe4 ge5", "那个": "na4 ge5", "哪个": "na3 ge5"}
# Point 2 writes a month or weekday name as one word ("bāyuè", "xīngqīwǔ"), so 月 joins a month
# number before it, and a weekday number joins 星期 or 礼拜 (see attached).
MONTH_NUMBERS = {"一", "二", "三", "四", "五", "六", "七", "八", "九", "十", "十一", "十二"}
WEEKDAY_NUMBERS = set("一二三四五六日天")
# Pieces that start a number in such a word, besides the numerals: 几 (几个), 好几 (好几种), and
# 多, 数 and 半 before a measure word (多名, 数个, 半个).
_NUMBER_WORDS = {"几", "好几", "多", "数", "半"}
# Words that point at a thing, after which a measure word stands apart from its noun (这 本 书).
_POINTING = {"这", "那", "哪", "每", "各", "某", "该", "此", "另", "这么", "那么"}
# Words after which a 了 ends its sentence, so the 了 is written apart ("Nǐ lái le ma?").
_FINAL_PARTICLES = set("吗吧呢啊呀啦嘛")
# Verbs of wanting and being able. A 过 after them is the verb guò (要过春节), not the particle.
_AUXILIARIES = {"要", "想", "能", "会", "可以", "应该", "应当", "得", "愿意", "敢", "肯", "可能", "需要", "打算"}
# Results and directions that follow 不 in a potential complement (找不到, 听不懂, 睡不着, 记不清楚).
COMPLEMENTS = set("到懂着了起上下开动完见清住出过及掉惯通透够来去")
COMPLEMENT_WORDS = {"起来", "出来", "出去", "下来", "下去", "上来", "上去", "进来", "进去", "过来", "过去", "回来", "回去",
                    "清楚", "明白"}
# Verbs of saying and deciding, and 是. After them 不来 and 不去 mean "will not come" and "will not go"
# (他说不去), and 不过 is "but", so these are not potential complements.
_SAYING = {"说", "想", "问", "讲", "答应", "决定", "表示", "是"}
# One-character results and directions that the rules join to a one-character verb before them.
# GB/T 16159-2012 6.1.2.4 writes 搞坏 "gǎohuài" and 打死 "dǎsǐ", so 写好 is "xiěhǎo" and 关上 "guānshàng".
RESULTS = set("好完到懂见住开坏死脏掉上下出进回来去走倒破断满成错清饱醒透光")
# One-character verbs after which such a character is not a result (是 好 人, 请 开 门, 到 死).
_NO_RESULT = {"是", "有", "在", "给", "爱", "像", "姓", "请", "到"}
# The reading of 不 in a potential complement (point 5 of the pinyin style sheet). A 着 or 了 there is zháo or liǎo.
POTENTIAL_BU = "bu5"
_COMPLEMENT_READING = {"着": "zhao2", "了": "liao3"}
# Characters that write numbers, and the value of each digit.
NUMERALS = set("〇零一二两三四五六七八九十百千万亿")
# After 一 these start an ordinal or a date rather than a count, so 一 may keep "yī": 一号 and 一日 (the
# first day), 一班 (class one), 一年级, 一级, 一期, 一季度, 一楼 and 一层 (the first floor), 一等 (一等奖
# "yī děng jiǎng", first prize, which no rule tells from 一等 "wait a moment"), and 一路车 (bus number one).
ORDINAL_AFTER = ("号", "日", "班", "年级", "级", "期", "季度", "楼", "层", "等", "路车", "路公交", "路汽车", "路电车")
_NUMBER_RUN_RE = re.compile("[〇零一二两三四五六七八九十百千万亿几]+")
_DIGIT = {"〇": 0, "零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4, "五": 5, "六": 6, "七": 7, "八": 8, "九": 9}
_FRACTION = re.compile(r"^([零一二两三四五六七八九十百千万亿]+)分之([零一二两三四五六七八九十百千万亿]+)$")
# The digits after the point of a decimal number (三点一四 "sān diǎn yī sì"), and the words that may follow
# a decimal. A time of day also has 点 and a digit (三点一刻 "sān diǎn yí kè", 九点零五分), so a single
# digit after 点 counts as a decimal only at the end of a sentence part, after 零点 or before a unit.
_DECIMAL_DIGITS = set("〇零一二三四五六七八九")
_UNITS = {"米", "厘米", "毫米", "公里", "千米", "公斤", "千克", "克", "吨", "升", "毫升", "秒", "度", "倍", "元", "万", "亿"}
_TIME = {"分", "刻", "点", "钟", "分钟"}


def segment(text):
    """jieba's words and part-of-speech tags for text, [(word, tag)], from its dictionary only.

    jieba's guessing of unknown words (HMM) is switched off, as in Plan 3a, because its guesses
    join characters of different words into made-up words. With it, the sentence 天太黑了，我不敢
    一个人出去。 starts with 天太 + 黑 + 了, written "Tiāntài hēi le", and without it with 天 + 太 + 黑 + 了.
    """
    return [(p.word, p.flag) for p in jieba.posseg.lcut(text, HMM=False)]


def make_lookup(erhua, card_nums, public_nums, guess):
    """lookup(word) gives one numbered syllable per Chinese character of the word.

    card_nums: {headword: the numbered syllables its card shows} for each headword that has exactly
    one card. Such a word is read as on its card, so 喜欢 is xi3 huan5 and 东西 is dong1 xi5, where
    pypinyin gives xi3 huan1 and dong1 xi1, and 受不了 is shou4 bu5 liao3 with the neutral bu that
    its card shows. public_nums: {word: numbered reading} for the other words of the public list
    that have exactly one reading, which are read as the list gives them, neutral tones included,
    so 下来 is xia4 lai5 and 身上 is shen1 shang5 (pypinyin gives xia4 lai2 and shen1 shang4). Any
    other word takes the reading guess(word) gives (pypinyin in step 8), and a word that ends in 儿
    and is a known 儿-ending word, or that guess reads with a neutral er5, ends in r5.
    """
    def lookup(word):
        hanzi = "".join(_HANZI.findall(word))
        if hanzi in card_nums:
            return card_nums[hanzi].split()
        if hanzi in public_nums:
            return public_nums[hanzi].split()
        sylls = list(guess(hanzi))
        if len(hanzi) > 1 and hanzi.endswith("儿") and (hanzi in erhua or sylls[-1] == "er5"):
            sylls[-1] = "r5"
        return sylls
    return lookup


def public_word_readings(listed, cards, guess):
    """The public list's readings of its words that are not card headwords, for make_lookup and spot_checks.

    listed: Plan 3a public_readings of the public list. guess(word) gives pypinyin's reading.
    Returns (public_nums, word_readings).
    public_nums holds each such word with exactly one numbered reading. word_readings holds each
    such word of two or more characters with several readings, and also a word whose one reading
    spells a character with other letters than pypinyin does (穿着 is chuan1 zhuo2 in the list, as
    in "attire", but chuan1 zhe5 in 穿着红鞋), with both readings, so its characters are checked.
    A reading that does not give one syllable per character is left out, because the list writes
    a few readings without spaces (城里 "chéngli").
    """
    public_nums, word_readings = {}, {}
    for hz, options in listed.items():
        nums = [n for n in dict.fromkeys(r["num"] for r in options)
                if len(n.split()) == len(hz) and all(SYLLABLE.match(x) for x in n.split())]
        if hz in cards or not nums:
            continue
        if len(nums) == 1:
            public_nums[hz] = nums[0]
            guessed = list(guess(hz))
            if len(hz) > 1 and len(guessed) == len(hz) and any(
                    ch != "儿" and a[:-1] != b[:-1] for ch, a, b in zip(hz, nums[0].split(), guessed)):
                word_readings[hz] = [nums[0], " ".join(guessed)]
        elif len(hz) > 1:
            word_readings[hz] = nums
    return public_nums, word_readings


def word_pieces(word, known):
    """The fewest known words that spell `word` exactly, in order, or None when there are none.

    known: a set of words. With 足球 and 比赛 known, 足球比赛 gives ["足球", "比赛"].
    """
    best = {0: []}
    for end in range(1, len(word) + 1):
        options = [best[start] + [word[start:end]] for start in range(end)
                   if start in best and word[start:end] in known]
        if options:
            best[end] = min(options, key=len)
    return best.get(len(word))


def number_words(run):
    """The words of a number written in characters, as the textbook rules write numbers.

    - A whole number from 11 to 99 is one word, so 三十三 gives ["三十三"] ("sānshísān").
    - A digit (or 十) with 百, 千, 万 or 亿 is one word, and each such group is a word of its own,
      so 九亿七万二千三百五十六 gives ["九亿", "七万", "二千", "三百", "五十六"]
      ("jiǔyì qīwàn èrqiān sānbǎi wǔshíliù").
    - 几 counts as a digit next to 十, 百, 千 or 万, so 十几 and 几十 are one word each (十几 gives
      ["十几"], "shíjǐ gè rén"), and so are 几百 and 几千.
    - 万 or 亿 after a number of two or more characters stands apart (二十亿 gives ["二十", "亿"]).
    - 零 is a word of its own (一百零一 gives ["一百", "零", "一"]).
    - Without 十, 百, 千, 万 or 亿 the digits are read one by one, as in a year, and written apart
      (二零一二 gives ["二", "零", "一", "二"]). Two digits where the second is larger give an
      approximate number, which stays one word (一两, 两三) and gets a hyphen from word_joints.
    """
    if not any(ch in "十百千万亿" for ch in run):
        return [run] if approximate(run) else list(run)
    out, current = [], ""
    for ch in run:
        if ch in "零〇":
            out += [current, ch] if current else [ch]
            current = ""
        elif ch in "百千":
            out.append(current + ch)
            current = ""
        elif ch in "万亿":
            out += [current + ch] if len(current) <= 1 else [current, ch]
            current = ""
        else:
            current += ch
    return out + ([current] if current else [])


def approximate(word):
    """True for two digits that give an approximate number (一两 "one or two", 两三, 七八)."""
    return len(word) == 2 and all(ch in _DIGIT for ch in word) and 0 < _DIGIT[word[0]] < _DIGIT[word[1]]


def split_words(words, known, pos_of, keep=(), forms=None, cards=()):
    """The segmenter's words, with words that neither list has split where the textbook rules write them apart.

    known: every card headword and every word of the public list. pos_of: {word: its part-of-speech
    labels, such as ["adv."]} for those words. keep: words never split (the headword's parts and
    the names of data/manual/capitals). forms: {hz: (form, words)} for four-character words, from
    data/manual/four_char_words (Plan 3a pinyin_text.form_rows). cards: the card headwords, which
    keep the spacing of their cards.
    - A four-character word with the form "words" is split into its listed words, even when it is
      known (市场经济 gives 市场 + 经济). One with the form idiom or joined stays whole.
    - Another word that is not known is split into the fewest known words that spell it, always
      when it has four or more characters, so 足球比赛 gives 足球 + 比赛. A word of two or three
      characters is split only where the rules put a space between the first two pieces (_apart).
      That is after a pronoun (我 + 家, 这 + 件, 每 + 天), after an adverb (很 + 多, 不 + 能), between a
      number and a measure word (一 + 个, 几 + 十 + 个, 好几 + 种), before a preposition after a verb
      (坐 + 在), and between a measure word and a noun after a number or 这 (jieba's 本书, cut from
      这本书, gives 本 + 书). Other short words stay whole, because many of them are ordinary words
      or names that neither list has (把守, 企业家, 西班牙, 桃子, 劳动节).
    - A potential complement, a verb, 不 and a result (睡不着, 听不懂), is split into its three
      characters, as the rules write 打不着 "dǎ bù zháo". When jieba cut it out of a longer word
      (记不清 + 楚), the result takes the rest of that word back (记 + 不 + 清楚).
    - One character written twice also stays whole (看看 "kànkan"). 们 and the aspect particles 着,
      了 and 过 join the piece before them, so 去过 and 同学们 stay whole and 别忘了 gives 别 + 忘了. A
      final 儿 joins the last piece (这点儿 stays whole, as the rules write "zhèdiǎnr").
    - A fraction is written syllable by syllable, as GB/T 16159-2012 6.1.5.1 writes 二分之一 "èr fèn
      zhī yī". So 三分之一 gives 三 + 分 + 之 + 一, and so do jieba's 分之 and 百分之 (百 + 分 + 之),
      unless they are the headword. 第 with a number stays one word (第十 "dì-shí").
    - Numbers are written as number_words says. Neighbouring words made only of numerals, and 几
      next to 十, 百, 千 or 万, are joined into one number and divided again, so jieba's 六 + 十 + 岁
      gives 六十 + 岁 ("liùshí suì") and 一 + 千 + 五 + 百 gives 一千 + 五百 ("yìqiān wǔbǎi"). A known
      word such as 千万 (be sure to) that stands alone is left as it is, and a number after a lone
      第 joins it (第 + 二十 gives 第二十). 好几 lets go of 几 before 十, 百, 千 or 万, so 几十 stays
      one word (好 + 几十 + 个). The digits after the point of a decimal are written one by one
      (三 + 点 + 一 + 四, "sān diǎn yī sì"), not as an approximate number (_is_decimal).
    - jieba's 不了 and 不过 after a verb are the end of a potential complement, so they are split
      (忍受 + 不了 gives 忍受 + 不 + 了, and 跨 + 不过 gives 跨 + 不 + 过, "kuà bu guò"). So is a potential
      complement of the public list that is not a card (赶不上 gives 赶 + 不 + 上, "gǎn bu shàng"),
      while a card keeps the spacing of its card (受不了 "shòubuliǎo").
    - Last, a 了 or a particle such as 吧 or 吗 that ends a sentence is split from a word that neither
      list has (弄脏了。 gives 弄脏 + 了, and jieba's 咖啡吧 in 喝杯咖啡吧。 gives 咖啡 + 吧), because the
      rules write them apart ("nòngzāng le.", "hē bēi kāfēi ba.").
    """
    out, words = [], list(words)
    for k, word in enumerate(words):
        if word in known and word not in cards and word not in keep and len(word) == 3 and word[1] == "不" \
                and potential(word[0], word[2], pos_of):
            out += list(word)
            continue
        if word in ("不了", "不过") and word not in keep and out and _WORD.match(out[-1]) \
                and "v." in pos_of.get(out[-1], ()) and out[-1] not in _SAYING and out[-1] not in _AUXILIARIES:
            out += ["不", word[1]]
            continue
        pieces = _pieces(word, known, pos_of, keep, forms or {}, out[-1] if out else "")
        if len(pieces) == 3 and pieces[1] == "不" and k + 1 < len(words) and pieces[2] + words[k + 1] in known:
            words[k + 1] = pieces.pop() + words[k + 1]
        out += pieces
    out = _numbers([piece for word in out for piece in _fraction(word, keep)], known)
    final = []
    for k, word in enumerate(out):
        final += _sentence_end(word, out[k + 1] if k + 1 < len(out) else "", known, keep)
    return final


def _fraction(word, keep):
    """A word 分之, with or without a number before it, written syllable by syllable (百分之 gives 百 + 分 + 之)."""
    if word in keep or not re.match(r"^[零一二两三四五六七八九十百千万亿]*分之$", word):
        return [word]
    return ([word[:-2]] if len(word) > 2 else []) + ["分", "之"]


def _sentence_end(word, after, known, keep):
    """A word that neither list has, with a 了 or a particle that ends the sentence split off (走了吧 gives 走 + 了 + 吧)."""
    if len(word) < 2 or word in known or word in keep or not _WORD.match(word) or not ends_sentence(after):
        return [word]
    if word[-1] in _FINAL_PARTICLES:
        return _sentence_end(word[:-1], word[-1], known, keep) + [word[-1]]
    if len(word) < 4 and word.endswith("了") and word[-2] != "不":
        return [word[:-1], "了"]
    return [word]


def ends_sentence(after):
    """True when a 了 before the word `after` ends its sentence: at the end, before punctuation or before 吗, 吧 and 呢."""
    return not _HANZI.match(after[:1]) or after in _FINAL_PARTICLES


def _pieces(word, known, pos_of, keep, forms, before=""):
    if len(word) < 2 or word in keep or not _WORD.match(word):
        return [word]
    stem, er = (word[:-1], "儿") if len(word) > 2 and word.endswith("儿") else (word, "")
    if len(stem) == 4 and stem in forms:
        form, parts = forms[stem]
        return parts[:-1] + [parts[-1] + er] if form == "words" else [word]
    fraction = _FRACTION.match(stem)
    if fraction:
        return [fraction.group(1), "分", "之", fraction.group(2) + er]
    if word in known:
        return [word]
    ordinal = re.match(r"^第[零一二两三四五六七八九十百千万亿几]+", stem)
    if ordinal and ordinal.group(0) != stem:
        return [ordinal.group(0)] + _pieces(word[ordinal.end():], known, pos_of, keep, forms, ordinal.group(0))
    if ordinal or (len(stem) == 2 and stem[0] == stem[1]):
        return [word]
    if len(stem) == 3 and ((stem[1] == "不" and potential(stem[0], stem[2], pos_of))
                           or (stem[1] == "得" and pos_of.get(stem[0], ()) and set(pos_of[stem[0]]) & {"v.", "adj."})):
        return [stem[0], stem[1], stem[2] + er]
    if len(stem) == 3 and stem[0] == stem[1] and stem[2] in "地的":
        return [stem[:2], stem[2] + er]
    merged, rough = [], stem[2:3] in ("十", "百", "千", "万")
    for piece in word_pieces(stem, known) or [stem]:
        if merged and piece in JOINS_BEFORE:
            merged[-1] += piece
        elif piece == "好几" and rough:
            merged += ["好", "几"]
        elif merged == ["好"] and piece == "几" and not rough:
            merged = ["好几"]
        else:
            merged.append(piece)
    if len(merged) < 2 or len(stem) > 3:
        return merged[:-1] + [merged[-1] + er]
    if merged[-1] in LOCATIVES and "n." in pos_of.get(merged[-2], ()) and not (merged == [stem[0], "中"]):
        return ["".join(merged[:-1]), merged[-1] + er]
    if not _apart(merged, er, before, pos_of):
        return [word]
    return merged[:-1] + [merged[-1] + er]


def _is_number(piece):
    return piece in _NUMBER_WORDS or all(ch in NUMERALS or ch == "几" for ch in piece)


def _apart(pieces, er, before, pos_of):
    """True when the textbook rules put a space between the pieces of a short word that neither list has.

    pieces: the known words that spell the word, er: its final 儿, before: the word before it.
    The rules write these apart:
    - a pronoun, 是, or a word such as 这, 每 or 所有, and what follows (我 家, 这 件, 每 天, 是 从),
      except that 这, 那 and 哪 join 点儿, 般, 边, 时 and 会儿 (这点儿 "zhèdiǎnr");
    - an adverb and what follows (很 多, 不 能, 少 吸), and an adverb after 要, 会 or 能 (要 先);
    - a number and a measure word, 月, 多, an adjective or a noun of two characters (一 个,
      几十 个, 好几 种, 八 月, 一 大, 三 年级), but not a festival named by its date (五一节);
    - a measure word and its noun after a number or 这 (这 本 书, 7 点 钟);
    - a verb and a preposition after it (坐 在), 点 or 些 after it (买 点儿, but 有点 and 差点 are
      one word), a measure word or its object after a verb of one character whose first part of
      speech is a verb (喝 杯 茶, 买 票), and a verb after 来 or 去 (来 说, 去 看);
    - 把 or 被 and a noun after it (把 门 关上);
    - 大, 小, 老, 新, 旧, 全 or 好 and one noun (大 树, 老 房子), a noun of two characters and a
      verb (电话 响), and 可 and a verb of two characters (可 更改).
    Other short words stay whole, such as 西班牙, 日本, 桃子, 企业家, 发动机 and 五官, and so do a
    noun or verb of two characters with 家, 迷 or 品 after it (歌唱家, 体育迷, 装饰品) and words
    whose first piece is also a noun or an adjective (面孔, 热天, 树丛).
    """
    first, second = pieces[0], pieces[1] + (er if len(pieces) == 2 else "")
    labels = [set(pos_of.get(p, ())) for p in pieces]
    if first in ("这", "那", "哪") and second in JOINED_AFTER_THIS:
        return False
    if first in PRONOUNS or first in ADVERBS or first == "是" or (len(first) > 1 and "adv." in labels[0]):
        return True
    if first in _AUXILIARIES and pieces[1] in ADVERBS:
        return True
    count = next((k for k, p in enumerate(pieces) if not _is_number(p)), len(pieces))
    if count:
        number, rest = "".join(pieces[:count]), pieces[count:]
        festival = rest == ["节"] and len(number) == 2 and all(ch in _DIGIT for ch in number) and not approximate(number)
        doubled = len(rest) == 2 and rest[0] == rest[1]
        if festival or doubled or not rest:
            return not (festival or doubled)
        after = set(pos_of.get(rest[0], ()))
        noun = len(rest[0]) > 1 and "n." in after and number != "半"
        return rest[0] in ("多", "月", "月份") or rest[0] in ADJECTIVES or "m." in after or noun
    if len(first) == 2 and len(pieces) == 2 and pieces[1] in WORD_ENDINGS and labels[0] & {"n.", "v."}:
        return False
    if first in ("把", "被") and "n." in labels[1]:
        return True
    if "m." in labels[0] and "n." in labels[1] and before and (_is_number(before) or before.isdigit()
                                                               or before in _POINTING):
        return True
    verb_first = len(first) == 1 and pos_of.get(first, [""])[:1] == ["v."] and first != "有"
    if "v." in labels[0] and (pieces[1] in PREPOSITIONS or (second in ("点", "点儿", "些") and first not in ("有", "差"))
                              or (verb_first and "m." in labels[1] and "v." not in labels[1])):
        return True
    if first in ("来", "去") and "v." in labels[1] and pieces[1] != "得":
        return True
    noun_verb = len(first) == 2 and len(pieces[1]) == 1 and "n." in labels[0] and labels[1] & {"v.", "n."} == {"v."}
    if len(pieces) == 2 and ((first in ADJECTIVES and "n." in labels[1]) or noun_verb):
        return True
    return first == "可" and len(pieces[1]) > 1 and "v." in labels[1]


def potential(verb, result, pos_of):
    """True when verb + 不 + result is a potential complement (找 不 到 "cannot find", 买 不 来 "cannot buy").

    After a verb of saying, deciding or wanting, 不来 and 不去 are "will not come" and "will not go"
    (他 说 不 去), so they are not one.
    """
    return bool(_WORD.match(verb)) and "v." in pos_of.get(verb, ()) and verb != result and (
        result in COMPLEMENTS or result in COMPLEMENT_WORDS) and not (
        result in ("来", "去") and (verb in _SAYING or verb in _AUXILIARIES))


def potential_readings(words, pos_of):
    """{sentence index: syllable} for the 不 of each potential complement, and a 着 or 了 after it.

    words: the words of split_words. A 不 between a verb and a result or direction (找 + 不 + 到,
    睡 + 不 + 着, 记 + 不 + 清楚) says that the action cannot reach its result. It is read POTENTIAL_BU,
    the neutral tone, as point 5 of the style sheet says and HSK 4 prints 受不了 "shòubuliǎo", and a 着
    or 了 after it is read zháo or liǎo. So ["我", "睡", "不", "着"] gives {2: "bu5", 3: "zhao2"}, which
    render writes "wǒ shuì bu zháo". Step 8 passes these to syllables with the polyphone fixes.
    """
    out, pos = {}, 0
    for k, word in enumerate(words):
        if word == "不" and 0 < k < len(words) - 1 and potential(words[k - 1], words[k + 1], pos_of):
            out[pos] = POTENTIAL_BU
            if words[k + 1] in _COMPLEMENT_READING:
                out[pos + 1] = _COMPLEMENT_READING[words[k + 1]]
        pos += len(word)
    return out


def attached(words, pos_of):
    """Sentence indexes where a word starts that is written joined to the word before it.

    The textbook rules write 们 and the aspect particles 着, 了 and 过 joined to the word before
    them, and so are the SUFFIXES. So 们, 着 and a suffix always join a Chinese word before them
    (孩子们 "háizimen", 指着 "zhǐzhe", jieba's 驾驶 + 员 "jiàshǐyuán").
    A 了 joins too ("yòngle liǎng gè xiǎoshí"), except that a 了 that ends a sentence stays apart
    ("Zuótiān xià yǔ le.", "Nǐ lái le ma?"). A 过 joins a verb (见过 "jiànguo"), but after a noun,
    a pronoun, an adverb or a verb of wanting it is the verb guò and stays apart (要过春节
    "yào guò Chūnjié"). None of them joins 不 or 得, where they finish a potential complement
    (睡不着 "shuì bu zháo").
    A one-character result or direction of RESULTS joins a one-character verb before it, as the
    rules join two one-character words there (写 + 好 gives "xiěhǎo", 关 + 上 + 了 "guānshàngle"). The
    word before must be first of all a verb (not 树 in 树 上 or 没 in 没 去), and not 是, 有, 请, a
    verb of wanting or a preposition (是 好 人, 请 开 门). A second result after a first stays apart
    (走 出 去).
    Month and weekday names are one word (point 2 of the pinyin style sheet), so 月 joins a month
    number (八 + 月 gives "bāyuè", but 三 + 个 + 月 stays "sān gè yuè" and 几 + 月 "jǐ yuè"), and a
    weekday number joins 星期 or 礼拜 (星期 + 五 gives "xīngqīwǔ") unless a measure word follows it.
    """
    out, pos, joined_result = set(), 0, False
    for k, word in enumerate(words):
        before = words[k - 1] if k else ""
        after = words[k + 1] if k + 1 < len(words) else ""
        result = word in RESULTS and not joined_result and word != before and _takes_result(before, pos_of)
        month = word == "月" and before in MONTH_NUMBERS and not (k > 1 and (_is_number(words[k - 2])
                                                                            or words[k - 2] == "第"))
        weekday = before in ("星期", "礼拜") and word in WEEKDAY_NUMBERS and "m." not in pos_of.get(after, ())
        if _WORD.match(before) and before not in ("不", "得") and (
                word in ("们", "着") or word in SUFFIXES or result or (word == "了" and not ends_sentence(after))
                or (word == "过" and "v." in pos_of.get(before, ()) and before not in _AUXILIARIES)
                or month or weekday):
            out.add(pos)
        joined_result = result
        pos += len(word)
    return out


def _takes_result(verb, pos_of):
    """True when a one-character result after `verb` joins it (写 + 好, 关 + 上), see attached."""
    return len(verb) == 1 and bool(_WORD.match(verb)) and pos_of.get(verb, [])[:1] == ["v."] \
        and verb not in _NO_RESULT and verb not in _AUXILIARIES and verb not in PREPOSITIONS


def _numbers(words, known):
    out, run = [], []
    for word in words + [""]:
        if word and all(ch in NUMERALS or ch == "几" for ch in word):
            run.append(word)
            continue
        joined = "".join(run)
        if run and len(out) > 1 and out[-1] == "点" and _is_decimal(out[:-1], joined, word):
            out += list(joined)
        elif run and out and out[-1] == "第":
            out[-1] += joined
        elif len(run) == 1 and (len(run[0]) == 1 or run[0] in known):
            out += run
        elif "几" in joined and not any(ch in "十百千万" for ch in joined):
            out += run
        elif run:
            out += number_words(joined)
        run = []
        if word:
            out.append(word)
    return out


def _is_decimal(before, digits, after):
    """True when digits after a number and 点 are the digits of a decimal, which are read one by one.

    before: the words before 点, digits: the characters after it, after: the next word. So 三 + 点 +
    一四 is a decimal ("sān diǎn yī sì"), and so are 零点一, 一点五公里, 三点一 at the end of a sentence
    part and 百分之三点一, while 三点一刻 and 九点零五分 are times of day.
    """
    if not before or not all(ch in NUMERALS for ch in before[-1]) or not digits \
            or not all(ch in _DECIMAL_DIGITS for ch in digits) or after in _TIME:
        return False
    return len(digits) > 1 or before[-1] in ("零", "〇") or not _HANZI.match(after[:1]) or after in _UNITS \
            or (len(before) > 1 and before[-2] == "之")


def decimal_digits(words):
    """Indexes of the words that belong to a decimal number: the number before 点 and the digits after it.

    A 一 among them keeps its first tone, because a decimal is read digit by digit (三 点 一 四
    "sān diǎn yī sì", 一 点 五 公里 "yī diǎn wǔ gōnglǐ"). split_words already wrote the digits apart.
    """
    out = set()
    for k, word in enumerate(words):
        if word != "点" or not k:
            continue
        end = k + 1
        while end < len(words) and len(words[end]) == 1 and words[end] in _DECIMAL_DIGITS:
            end += 1
        if _is_decimal(words[:k], "".join(words[k + 1:end]), words[end] if end < len(words) else ""):
            out |= {k - 1} | set(range(k + 1, end))
    return out


def decimal_positions(sentence):
    """Indexes of the sentence characters that are digits of a decimal number, which are read one by one.

    The same test as decimal_digits, but on the characters of a sentence, for the strict checker
    (Task 13). The number before 点 counts only when it is written digit by digit. So 三点一四米
    gives the indexes of 三, 一 and 四, while 三点一刻 (a time of day) gives none.
    """
    out = set()
    for k, ch in enumerate(sentence):
        if ch != "点" or not k or sentence[k - 1] not in NUMERALS:
            continue
        start = k
        while start and sentence[start - 1] in NUMERALS:
            start -= 1
        end = k + 1
        while end < len(sentence) and sentence[end] in _DECIMAL_DIGITS:
            end += 1
        after = next((sentence[end:end + n] for n in (2, 1) if sentence[end:end + n] in _TIME | _UNITS),
                     sentence[end:end + 1])
        if _is_decimal(list(sentence[:start]) + [sentence[start:k]], sentence[k + 1:end], after):
            digits = range(start, k) if all(c in _DECIMAL_DIGITS for c in sentence[start:k]) else range(0)
            out |= set(digits) | set(range(k + 1, end))
    return out


def word_joints(word, fixed):
    """Joints for one word of a sentence (see Plan 3a pinyin_text), so a sentence is spaced like the cards.

    The words come from split_words. fixed: {word: joints} for the words whose spacing is set
    elsewhere. Those are the card headwords (as on the card, so 不客气 gives [" ", ""] "bú kèqi")
    and the four-character words kept whole, which are the idioms (IDIOM_JOINTS) and the joined words.
    - A 儿 ending of a longer word joins the rest, which these rules place.
    - 第 with a number takes a hyphen (第十 "dì-shí"), and so does an approximate number (一两
      "yì-liǎng").
    - Any other word is one joined word, so 英国 gives [""] ("yīngguó").
    """
    if word in fixed:
        return list(fixed[word])
    if len(word) > 2 and word.endswith("儿"):
        return word_joints(word[:-1], fixed) + [""]
    if len(word) > 1 and word[0] == "第" and all(ch in NUMERALS or ch == "几" for ch in word[1:]):
        return ["-"] + [""] * (len(word) - 2)
    if approximate(word):
        return ["-"]
    return [""] * (len(word) - 1)


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


def regroup(sentence, words, hz, cut=None, known=()):
    """The segmenter's words, changed so each part of the headword is one word and a lone 儿 joins the word before it.

    The places where jieba cut the sentence are kept, except that each headword part starts and
    ends a word and nothing cuts through it. So 都市里 cut as 都 + 市里 gives 都市 + 里 for the
    headword 都市, and the headword's pinyin is spaced as on its card. A piece left over from a
    word that the headword cut through is cut again with cut(piece) (jieba in step 8), so jieba's
    勇敢的人 gives 勇敢 + 的 + 人 for the headword 勇敢, and 耸了耸肩 gives 耸 + 了 + 耸肩 for 耸.
    A word of `known` (the card headwords and the public list's words) that holds the whole
    headword part is not cut, and the sentence is written as it is for any other headword. So
    男人 stays "nánrén" for the card 男, 春天 "chūntiān" for 春, and 下雨 "xià yǔ" for 雨, with the
    space its card shows. Then a 儿 that jieba left as its own word joins the word before it
    (小摊 + 儿 gives 小摊儿), so it is read and checked as the 儿 ending.
    """
    cuts, spans, pos = {0, len(sentence)}, set(), 0
    for word in words:
        spans.add((pos, pos + len(word)))
        pos += len(word)
        cuts.add(pos)
    start = 0
    for part in (p for p in hz.split("…") if p):
        at = sentence.find(part, start)
        if at < 0:
            break
        start = at + len(part)
        if any(a <= at and start <= b and sentence[a:b] in known for a, b in spans):
            continue
        cuts = {c for c in cuts if not at < c < start} | {at, start}
        spans.add((at, start))
    points = sorted(cuts)
    out = []
    for a, b in zip(points, points[1:]):
        for word in (cut(sentence[a:b]) if cut and (a, b) not in spans else [sentence[a:b]]):
            if word == "儿" and out and _HANZI.search(out[-1][-1]):
                out[-1] += word
            else:
                out.append(word)
    return out


def keeps_yi(sentence, i, known):
    """The word before the 一 at index i when that 一 is part of a number, an ordinal or a weekday, so it
    keeps "yī" (第 in 第一, 十 in 十一个, 星期 in 星期一), else ""."""
    if sentence[max(i - 2, 0):i] in ("星期", "礼拜"):
        return sentence[i - 2:i]
    if sentence[i - 1:i] == "第":
        return "第"
    if not i or sentence[i - 1] not in NUMERALS or sentence[i + 1:i + 2] in ("百", "千", "万", "亿"):
        return ""
    if any(sentence[i:i + n] in known and not _NUMBER_RUN_RE.fullmatch(sentence[i:i + n]) for n in (2, 3, 4)):
        return ""
    return sentence[i - 1]


def yi_counts(sentence, i, counted):
    """The word after the 一 at index i when that 一 counts with it (一个, 一天, 一千, 一公斤), else "".

    counted holds measure words of one or more characters (公斤) and the words of pinyincheck._COUNTED.
    """
    rest = sentence[i + 1:]
    word = next((rest[:n] for n in (4, 3, 2, 1) if rest[:n] in counted), "")
    if not word or rest.startswith(ORDINAL_AFTER):
        return ""
    return word if rest[:1] != "点" or rest[1:2] in ("儿", "点") else ""


def yi_rule(sentence, i, facts=None, span_of=None, decimal=()):
    """How the 一 at index i is written before the syllable after it, as (kind, why).

    The draft (syllables) and the strict checker (pinyincheck) both follow it, so they agree. kind is
    "keep" (it must be "yī"), "change" (it must be "yí" before a fourth tone and "yì" before the other
    tones, the user's decision of 2026-09-29), or "open-keep" and "open-change" (either passes, and the
    draft writes the first). why is the checker's reason, where "{next}" stands for the next syllable.
    facts: pinyincheck.word_facts ("known", "counted", "surnames"). span_of(j): (start, end) of the word
    that holds character j as the line or the segmenter divides it. decimal: the digits of decimals.
    - "keep": a digit of a decimal, after 第, a numeral, 星期 or 礼拜 (keeps_yi), next to a word of
      arithmetic or between numbers with 比 or 是 (pinyin_text.yi_in_arithmetic: 一加一, 一比零, 一是一),
      and before another digit (一九九八).
    - "open-keep": before 月 (一月), before an ordinal or a date (ORDINAL_AFTER: 一楼, 一号, 一等奖, 一路车),
      after a numeral that keeps_yi left open (三千一百), in a name after a surname that the lists tag
      as one ("wáng yī", both written as words of their own), and at the end of a card or list word
      where the word ends (统一 "tǒngyī", 同一 in "tóngyī gè rén").
    - "open-change": before 点 other than in 一点儿 and 一点点, because 一点 may be one o'clock.
    - "change": everywhere else, with the reason that it counts with a measure word when it does.
    """
    facts = facts or {}
    known, counted = facts.get("known", ()), facts.get("counted", ())
    keep_why = "so it keeps its first tone 'yī'"
    if i in decimal:
        return "keep", "is a digit of a decimal number, which is read digit by digit, " + keep_why
    kept = keeps_yi(sentence, i, known)
    if kept:
        return "keep", f"follows {kept}, so it is part of a number, an ordinal or a weekday and keeps its first tone 'yī'"
    word = yi_in_arithmetic(sentence, i, counted, span_of, known)
    if word:
        return "keep", f"is a number in arithmetic next to {word}, " + keep_why
    if sentence[i + 1:i + 2] in DIGITS and sentence[i + 1:i + 2]:
        return "keep", f"is read digit by digit before {sentence[i + 1]}, " + keep_why
    rest = sentence[i + 1:]
    if rest[:1] == "月" or rest.startswith(ORDINAL_AFTER):
        return "open-keep", ""
    if rest[:1] == "点" and rest[1:2] not in ("儿", "点"):
        return "open-change", ""
    if i and sentence[i - 1] in NUMERALS | {"第"}:
        return "open-keep", ""
    span = span_of(i) if span_of else None
    if i and sentence[i - 1] in facts.get("surnames", ()) and span_of and span_of(i - 1) == (i - 1, i) \
            and span == (i, i + 1):
        return "open-keep", ""
    if (span is None or span[1] == i + 1) and any(i >= k and sentence[i - k:i + 1] in known for k in (1, 2, 3)):
        return "open-keep", ""
    count = yi_counts(sentence, i, counted) if span is None or span[0] == i else ""
    if count:
        return "change", (f"counts with {count} here, so it shows its tone change, 'yí' before a fourth tone and "
                          "'yì' before the other tones")
    return "change", ("comes before '{next}', so it shows its spoken tone change, 'yí' before a fourth tone and "
                      "'yì' before the other tones")


def syllables(sentence, words, lookup, hz, head_nums, fixes=None, facts=None):
    """One numbered syllable per sentence character (None for non-Chinese characters).

    words: the segmenter's words, which together spell the sentence. lookup(word) gives one
    numbered syllable per Chinese character of the word. The headword's characters get
    head_nums (the syllables its card shows). fixes: {index: syllable} from the polyphone check
    and potential_readings, applied last. facts: pinyincheck.word_facts, which yi_rule needs (the
    known words, the measure words and the surnames). Then 不 changes tone by pinyin_text.tone_change
    within each stretch of Chinese characters between punctuation marks, so a doubled word never
    reaches across a comma ("liǎng fèn, yí fèn"), and each 一 before a syllable follows yi_rule, the
    checker's own rule, with the segmenter's words as the word breaks. So 统一中国 keeps "tǒngyī" when
    统一 is a known word, 星期 + 一 + 下午 gives "xīngqīyī xiàwǔ", a decimal gives "sān diǎn yī sì", and
    a word that only jieba has (划一) does not keep "yī". Every syllable of the headword but its last keeps the
    tone its card shows, so 不得了 stays "bùdéliǎo" in 开心得不得了,
    where 得不得 looks like a doubled verb.
    """
    out = [None] * len(sentence)
    keep, pos, decimal, span = set(), 0, decimal_digits(words), {}
    for n, word in enumerate(words):
        span.update({pos + k: (pos, pos + len(word)) for k in range(len(word))})
        found = iter(lookup(word)) if _HANZI.search(word) else iter(())
        for k, ch in enumerate(word):
            if _HANZI.match(ch):
                out[pos + k] = next(found)
            if ch == "一" and n in decimal:
                keep.add(pos + k)
        pos += len(word)
    head, lasts, end = head_positions(sentence, hz), set(), 0
    for part in (p for p in hz.split("…") if p and head):
        end += len(part)
        lasts.add(head[end - 1])
    for i, syl in zip(head, head_nums):
        out[i] = syl
    for i, syl in (fixes or {}).items():
        out[i] = syl
    base = list(out)
    idx = [i for i, s in enumerate(out) if s]
    runs = []
    for i in idx:
        if runs and runs[-1][-1] == i - 1:
            runs[-1].append(i)
        else:
            runs.append([i])
    for run in runs:
        changed = tone_change([sentence[i] for i in run], [base[i] for i in run],
                              keep={n for n, i in enumerate(run) if sentence[i] == "一"})
        for i, syl in zip(run, changed):
            out[i] = syl
    for i in idx:
        if sentence[i] != "一" or base[i] != "yi1" or out[i] == "yi5" or not out[i + 1:i + 2] or not base[i + 1]:
            continue
        kind, _ = yi_rule(sentence, i, facts, span.get, keep)
        if kind in ("keep", "open-keep"):
            out[i] = "yi1"
        else:
            out[i] = "yi2" if base[i + 1][-1] in "45" else "yi4"
    for i, syl in zip(head, head_nums):
        if i not in lasts:
            out[i] = syl
    return out


def render(sentence, words, sylls, capital_positions=(), joints_of=None, attach=()):
    """Write the sentence pinyin, with the syllables of one word together, words apart and punctuation attached.

    All pinyin is in lower case, the start of a sentence and names included, as the user decided on
    2026-09-29 ("wǒ qù běijīng."). capital_positions (where name_words finds a word of a name) is
    still accepted from callers, but it no longer changes the text, so 黄河 with the card joints
    [" "] gives "huáng hé".
    joints_of(word): the word's joints (word_joints in the build script); without it, or when
    the joints do not fit the word, all its syllables are joined.
    attach: sentence indexes where a word starts that joins the word before it (attached), so
    他指着前面 gives "tā zhǐzhe qiánmiàn".
    A quotation after a colon is in lower case too ('tā shuō: "nǐ kàn."'). The Chinese dash, two long dashes that jieba
    may cut into two marks, is written as one "-". A percent sign stays with the digits before it, as
    in the sentence ("70%", which jieba cuts into 70 and %).
    """
    pieces, pos = [], 0
    for word in words:
        if _HANZI.search(word):
            nums = [sylls[pos + k] for k, ch in enumerate(word) if sylls[pos + k]]
            joints = joints_of(word) if joints_of else None
            text = card_py(nums, joints if joints is not None and len(joints) == len(nums) - 1 else None)
            if pos in attach and pieces and pieces[-1][0] == "word":
                pieces[-1] = ("word", pieces[-1][1] + ("'" if text[:1] in "aāáǎàoōóǒòeēéěè" else "") + text)
            else:
                pieces.append(("word", text))
        elif word.strip() in _CLOSE:
            pieces.append(("close", _CLOSE[word.strip()]))
        elif word.strip() in _OPEN:
            pieces.append(("open", _OPEN[word.strip()]))
        elif word.strip() in _DASH:
            if not pieces or pieces[-1] != ("dash", "-"):
                pieces.append(("dash", _DASH[word.strip()]))
        elif word.strip() == "%" and pieces and pieces[-1][0] == "word" and pieces[-1][1][-1:].isdigit():
            pieces[-1] = ("word", pieces[-1][1] + "%")
        elif word.strip():
            pieces.append(("word", word.strip()))
        pos += len(word)
    out = ""
    for kind, text in pieces:
        if kind == "close" or out.endswith(("(", ' "')) or out == '"':
            out += text
        else:
            out += (" " if out else "") + text
    return out


def name_words(sentence, words, names):
    """The words with each name of several words divided into its words, and where the name's words start.

    names: {hz: (words, capitals)} from data/manual/capitals (Plan 3a pinyin_text.name_rows).
    A person's name is written as the textbook rules write it, with the surname apart from the
    given name and a title apart. So with the row 李老师 (李 老师, Y N), the words
    ["喂", "，", "李老师", "在", "吗", "？"] give ["喂", "，", "李", "老师", "在", "吗", "？"] and the
    positions {2} of the words the row marks Y, which render writes "wèi, lǐ lǎoshī zài ma?", in lower
    case since 2026-09-29. A name is found wherever
    the words start and end at its words, even when the segmenter already cut it (李 + 老师).
    """
    out = []
    for word in words:
        out += names[word][0] if word in names else [word]
    starts, pos = set(), 0
    for word in out:
        starts.add(pos)
        pos += len(word)
    starts.add(pos)
    capitals = set()
    for hz, (parts, flags) in names.items():
        at = sentence.find(hz)
        while at >= 0:
            offsets = [at + sum(len(p) for p in parts[:k]) for k in range(len(parts) + 1)]
            if all(o in starts for o in offsets):
                capitals |= {o for o, flag in zip(offsets, flags) if flag}
            at = sentence.find(hz, at + 1)
    return out, capitals


def spot_checks(sentence, words, sylls, hz, readings_of, settled, word_readings):
    """Characters to check by hand.

    readings_of(char) gives every numbered reading of a character. settled: the words of two or
    more characters whose reading is certain, which are card headwords with one card and words
    of the public list with one reading (make_lookup in step 8 reads them so). word_readings:
    {word: [numbered readings]} for the other public-list words of two or more characters, which
    have several readings. A character that is not part of the headword is listed when:
    - its word has several readings that differ at this character (来 in 出来, read lai2 or lai5,
      and 着 in 穿着, whose one reading in the list, chuan1 zhuo2, differs from pypinyin's chuan1 zhe5);
    - it is a word of its own, is not in SAFE_ALONE and has several readings (长 in 一个人长大了);
    - its word has two or more characters and neither list has it, unless it is 一, whose tone the
      tone-change rule sets. The characters of SAFE_ALONE are checked there too, because they may
      have another reading inside a word (着 in 睡着 is zháo). pypinyin may have read such a word
      character by character (缝 in jieba's 缝到), and it may have missed a neutral tone, so the
      neutral tone is an option at every character but the first.
    A 儿 that ends a longer word but was not read as the 儿 ending "r5" is also checked (女儿 is
    right as er2, 哪儿 is not).
    Returns [(index, char, chosen syllable, "a/b/c")].
    """
    head = set(head_positions(sentence, hz))
    out, pos = [], 0
    for word in words:
        last = pos + len(word) - 1
        if _WORD.match(word) and word not in settled:
            several = [r.split() for r in word_readings.get(word, [])]
            for k, ch in enumerate(word):
                given = sylls[pos + k]
                if pos + k in head or (k and k == len(word) - 1 and ch == "儿"):
                    continue
                if several:
                    options = [given] + [r[k] for r in several]
                elif ch in SAFE_ALONE and (len(word) == 1 or ch == "一"):
                    continue
                elif len(word) == 1:
                    options = readings_of(ch)
                else:
                    options = [given] + readings_of(ch) + ([given[:-1] + "5"] if k else [])
                if len(set(options)) > 1:
                    out.append((pos + k, ch, given, "/".join(dict.fromkeys([given] + options))))
        if len(word) > 1 and word.endswith("儿") and last not in head and sylls[last] != "r5":
            out.append((last, "儿", sylls[last], "er2/r5"))
        pos += len(word)
    return out


def check_polyphone_answers(inputs, outputs):
    """Match the checker's answers to the spot-check rows by (id, index).

    Each row needs verdict OK or FIX. A FIX needs a numbered syllable such as "zhang3", and an OK
    keeps the given syllable. Returns (problems, [(id, index, char, syllable)]).
    """
    want = {(r["id"], r["index"]): r for r in inputs}
    problems, rows, seen = [], [], {}
    for r in outputs:
        key = ((r.get("id") or "").strip(), (r.get("index") or "").strip())
        seen[key] = seen.get(key, 0) + 1
        if key not in want:
            problems.append(f"{key[0]} at {key[1]}: not in the input")
            continue
        given = want[key]
        verdict = (r.get("verdict") or "").strip()
        syllable = (r.get("syllable") or "").strip().lower()
        if (r.get("char") or "").strip() != given["char"]:
            problems.append(f"{key[0]} at {key[1]}: char differs from the input")
        elif verdict == "OK":
            rows.append((key[0], int(key[1]), given["char"], given["given"]))
        elif verdict == "FIX" and SYLLABLE.match(syllable):
            rows.append((key[0], int(key[1]), given["char"], syllable))
        else:
            problems.append(f"{key[0]} at {key[1]}: verdict {verdict!r} with syllable {syllable!r}")
    problems += [f"{k[0]} at {k[1]}: answered {n} times" for k, n in seen.items() if n > 1 and k in want]
    problems += [f"{k[0]} at {k[1]}: missing" for k in want if k not in seen]
    return problems, rows
