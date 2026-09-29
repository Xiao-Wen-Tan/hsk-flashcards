"""Which words must never be offered as each other's wrong quiz choices, and a count of usable ones.

Two words clash when their meanings overlap. For example 高兴 "happy; glad" and 快乐 "happy"
share "happy", so neither may be a wrong choice for the other.
"""
import re
from collections import defaultdict

_FILLER = re.compile(r"^(to|a|an|the|be)\s+")


def sound(word):
    """The word as it is spoken, which is its tone-marked py in lower case without spaces or apostrophes.

    It uses py, not pyNum, because only py shows the 一 and 不 tone changes (不客气 is "bú kèqi"),
    and it matches how the app (Plan 2, normPy) decides that two words sound the same.
    """
    return re.sub(r"[\s'’-]", "", word["py"].lower())


def meaning_keys(en, en_short):
    """The comparable senses of a card, in lower case, without brackets and without a leading "to", "a",
    "the" or "be".

    ("to love; like doing sth.", "to love") gives {"love", "like doing sth"}.
    """
    keys = set()
    for sense in en.split(";") + [en_short]:
        s = re.sub(r"\([^)]*\)", "", sense.lower()).strip(" .!?…")
        while _FILLER.match(s):
            s = _FILLER.sub("", s, count=1)
        s = re.sub(r"\s+", " ", s).strip()
        if s:
            keys.add(s)
    return keys


def no_distract(words):
    """{id: sorted ids whose meanings overlap}, over all words ("id", "en", "enShort")."""
    by_key = defaultdict(set)
    keys = {}
    for w in words:
        keys[w["id"]] = meaning_keys(w["en"], w["enShort"])
        for k in keys[w["id"]]:
            by_key[k].add(w["id"])
    out = {}
    for w in words:
        clash = set().union(*(by_key[k] for k in keys[w["id"]])) if keys[w["id"]] else set()
        out[w["id"]] = sorted(clash - {w["id"]})
    return out


def usable_choices(word, pool, quiz):
    """The words of `pool` that may be wrong choices for `word` in one quiz type.

    In the quiz "listen" the learner hears the word and picks its meaning, so a choice must not
    sound exactly the same (same sound()), must not show the same quiz meaning, and must not clash.
    In the quiz "pinyin" the learner sees the meaning and picks the pinyin, so a choice must show
    different pinyin and must not clash.
    """
    out = []
    for other in pool:
        if other["id"] == word["id"] or other["id"] in word["noDistract"] or word["id"] in other["noDistract"]:
            continue
        if quiz == "listen" and (sound(other) == sound(word)
                                 or other["enShort"].lower() == word["enShort"].lower()):
            continue
        if quiz == "pinyin" and sound(other) == sound(word):
            continue
        out.append(other)
    return out
