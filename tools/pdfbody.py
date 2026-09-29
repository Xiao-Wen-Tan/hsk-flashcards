"""Split a decoded PDF entry into its senses, each an English gloss with its example sentences.

An entry's tokens alternate between Chinese glyph codes ("c") and Latin text ("l").
tokens[0] is the headword and tokens[1] its pinyin, part of speech and first gloss.
After that, Chinese tokens are sentences, and a Latin token is either part of a
sentence (spaces, digits, punctuation, an upper-case abbreviation such as DNA,
or the ASCII ~ that stands for the headword) or the gloss of the next sense.
For example, HSK1 #1 爱 gives
[("àiv. love", "妈妈，我～你。"), ("v. like doing sth.", "我～吃米饭。")].
"""
import re

from decode import decode_cids

PLACEHOLDER = "～"
_DIGITS_PUNCT = re.compile(r"[\s\d.,:;%/+\-!?'\"“”#~\u2014]+")
_ACRONYM = re.compile(r"\s*[A-Z][A-Z0-9]+\s*")
_HALF_TO_FULL = {",": "，", "!": "！", "?": "？", ":": "：", ";": "；", "~": PLACEHOLDER}
_ENDS = "。！？"


def is_inline(text):
    """True when a Latin token belongs inside a sentence rather than starting a new gloss."""
    return not text.strip() or bool(_DIGITS_PUNCT.fullmatch(text)) or bool(_ACRONYM.fullmatch(text))


def inline_text(text):
    """Latin text inside a sentence, in the form a Chinese sentence uses.

    Spaces and stray apostrophes are dropped, half-width punctuation becomes full-width,
    ASCII ~ becomes ～, and a full stop becomes 。 unless it sits between digits (3.5).
    " 10 " gives "10", "~" gives "～", "?" gives "？".
    """
    t = text.strip().replace("'", "")
    t = "".join(_HALF_TO_FULL.get(ch, ch) for ch in t)
    return re.sub(r"(?<!\d)\.|\.(?!\d)", "。", t)


def split_senses(tokens, fwd):
    """[(gloss, body_text)] for one entry, where body_text joins everything up to the next gloss."""
    senses = []
    for kind, value in tokens[1:]:
        if kind == "l" and (not senses or not is_inline(value)):
            senses.append([value.strip(), ""])
        elif kind == "l":
            senses[-1][1] += inline_text(value)
        else:
            senses[-1][1] += decode_cids(value, fwd)
    return [(g, b) for g, b in senses]


def sentences_of(body):
    """Cut a sense's body text into sentences that end in 。, ！ or ？ (a closing ” stays attached).

    Leading ；, commas and spaces are removed, and pieces without a proper ending are dropped.
    So "；；游客挨了宰，" gives [], and "～个人是我的同学。我能坐在～儿吗？" gives two sentences.
    """
    out = []
    for m in re.finditer(r"[^。！？]*[。！？]+”?", body):
        s = m.group(0).lstrip("；;，, ")
        if s and s[0] not in _ENDS:
            out.append(s)
    return out


def sentence_candidates(body):
    """The sentences of a sense, plus all of them joined when there are several.

    The joined form keeps short exclamations usable, so "哇！这些照片真漂亮！" gives
    ["哇！", "这些照片真漂亮！", "哇！这些照片真漂亮！"].
    """
    found = sentences_of(body)
    return found + ["".join(found)] if len(found) > 1 else found


def fill_placeholder(sentence, hz):
    """Write the headword where the sentence has ～, or None if it cannot be done.

    A pattern word such as 虽然…但是… fills each ～ with its own half, in order, so
    "～下雨了，～我们还是想去看电影。" gives "虽然下雨了，但是我们还是想去看电影。".
    It needs exactly one ～ per half. An ordinary word fills every ～.
    """
    parts = [p for p in hz.split("…") if p]
    count = sentence.count(PLACEHOLDER)
    if len(parts) == 1:
        return sentence.replace(PLACEHOLDER, parts[0])
    if count != len(parts):
        return None
    for p in parts:
        sentence = sentence.replace(PLACEHOLDER, p, 1)
    return sentence


def contains_head(sentence, hz):
    """True when every part of the headword appears in the sentence, in order."""
    pos = 0
    for part in (p for p in hz.split("…") if p):
        pos = sentence.find(part, pos)
        if pos < 0:
            return False
        pos += len(part)
    return True
