"""Assemble the app's word data file, exactly in the shape of .claude/plans/words-json-schema.md."""
from collections import defaultdict

from distract import meaning_keys

LICENSE = ("Meanings adapted from CC-CEDICT (CC BY-SA 4.0) via drkameleon/complete-hsk-vocabulary (MIT). "
           "Example sentences: see ATTRIBUTION.md.")
WORD_FIELDS = ("id", "hz", "py", "pyNum", "pyBase", "syl", "lv", "pos", "en", "enShort")


def fix_short_meanings(words, fixes):
    """The words with the short quiz meanings of `fixes` (rows id, old, new) put in, and a list of problems.

    A fix applies only while the card still has its `old` short meaning, so a fix written for an older
    word list never changes a meaning it was not meant for. For 了, old "used at the end of a…" (cut off
    mid-phrase) and new "marks a change or completion". The input rows are not changed.
    """
    by_id = {f["id"]: f for f in fixes}
    out, problems = [], []
    for w in words:
        f = by_id.get(w["id"])
        if f and f["old"] != w["enShort"]:
            problems.append(f"{w['id']}: the fix expects the short meaning {f['old']!r} but the card has {w['enShort']!r}")
        out.append({**w, "enShort": f["new"]} if f and f["old"] == w["enShort"] else w)
    return out, problems


def extra_no_distract(words, pairs):
    """{id: set of ids} of cards that must never appear in the same quiz, beyond the word-for-word matches of
    distract.no_distract, and a list of problems.

    Two sources. First, the pairs (rows id_a, id_b) that Claude agents found by reading each theme's
    meanings (data/claude/meaning_overlaps_vNNN/), such as 高兴 "happy" and 愉快 "pleased". Second, a meaning
    that is the beginning of another card's meaning, such as 吗's "used at the end of a sentence" and 了's
    "used at the end of a sentence to indicate change in status", which word-for-word matching misses.
    """
    ids = {w["id"] for w in words}
    out = {w["id"]: set() for w in words}
    problems = []
    for p in pairs:
        a, b = p["id_a"].strip(), p["id_b"].strip()
        missing = [x for x in (a, b) if x not in ids]
        if missing:
            problems.append(f"{a} and {b}: {', '.join(missing)} is not a card")
        elif a != b:
            out[a].add(b)
            out[b].add(a)
    starts = defaultdict(set)  # the first n words of every meaning, for n shorter than the meaning
    keys = {w["id"]: meaning_keys(w["en"], w["enShort"]) for w in words}
    for wid, ks in keys.items():
        for k in ks:
            parts = k.split()
            for n in range(1, len(parts)):
                starts[" ".join(parts[:n])].add(wid)
    for wid, ks in keys.items():
        for k in ks:
            for other in starts.get(k, ()):
                if other != wid:
                    out[wid].add(other)
                    out[other].add(wid)
    return out, problems


def build(version, generated, words, curriculum, themes, sentences, pinyin, audio, extra=None):
    """The whole data file as a dict.

    version: "v001". generated: "2026-10-05". words: word-list rows. curriculum: rows with
    id, theme, ord and noDistract. themes: [{id, order, name, count}]. sentences: rows with
    id, sentence, en and src. pinyin: {id: sentence pinyin}. audio: {id: {"w": path, "s": path}}.
    extra: {id: set of ids} from extra_no_distract, added to each card's noDistract.
    Words are listed in curriculum order.
    """
    extra = extra or {}
    place = {r["id"]: r for r in curriculum}
    said = {r["id"]: r for r in sentences}
    out = []
    for w in sorted(words, key=lambda w: place[w["id"]]["ord"]):
        c, s = place[w["id"]], said[w["id"]]
        entry = {k: w[k] for k in WORD_FIELDS}
        entry.update({"theme": c["theme"], "ord": c["ord"], "au": audio[w["id"]]["w"],
                      "noDistract": sorted(set(c["noDistract"]) | extra.get(w["id"], set())),
                      "ex": {"hz": s["sentence"], "py": pinyin[w["id"]], "en": s["en"], "au": audio[w["id"]]["s"],
                             "src": s["src"]}})
        out.append(entry)
    return {"version": version, "generated": generated, "license": LICENSE,
            "themes": [{k: t[k] for k in ("id", "order", "name", "count")} for t in themes], "words": out}


def stale(sentences, pinyin_rows, audio, expected):
    """Words whose sentence pinyin or audio was made from other text than the final sentences.

    sentences: rows with id and sentence (the final text from step 7). pinyin_rows: step 8's rows
    {id, sentence, py}, where sentence is the text the pinyin was made from. audio: step 9's map
    {id: {"w": path, "s": path}}. expected: the same map built again from the final texts
    (ttsaudio.audio_map), so a path differs when its text changed. For example, if step 7c
    corrected the sentence of w0002 after step 8 ran, both lines for w0002 are returned.
    Returns a list of problems; an empty list means everything matches.
    """
    final = {r["id"]: r["sentence"] for r in sentences}
    problems = [f"{r['id']}: the pinyin was made from {r['sentence']!r} but the final sentence is "
                f"{final.get(r['id'])!r}" for r in pinyin_rows if r["sentence"] != final.get(r["id"])]
    for wid, paths in expected.items():
        for kind in ("w", "s"):
            have = audio.get(wid, {}).get(kind)
            if have != paths[kind]:
                problems.append(f"{wid}: the audio map has {have} where the final texts give {paths[kind]}")
    return problems
