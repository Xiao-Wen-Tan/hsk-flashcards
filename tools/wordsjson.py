"""Assemble the app's word data file, exactly in the shape of .claude/plans/words-json-schema.md."""

LICENSE = ("Meanings adapted from CC-CEDICT (CC BY-SA 4.0) via drkameleon/complete-hsk-vocabulary (MIT). "
           "Example sentences: see ATTRIBUTION.md.")
WORD_FIELDS = ("id", "hz", "py", "pyNum", "pyBase", "syl", "lv", "pos", "en", "enShort")


def build(version, generated, words, curriculum, themes, sentences, pinyin, audio):
    """The whole data file as a dict.

    version: "v001". generated: "2026-10-05". words: word-list rows. curriculum: rows with
    id, theme, ord and noDistract. themes: [{id, order, name, count}]. sentences: rows with
    id, sentence, en and src. pinyin: {id: sentence pinyin}. audio: {id: {"w": path, "s": path}}.
    Words are listed in curriculum order.
    """
    place = {r["id"]: r for r in curriculum}
    said = {r["id"]: r for r in sentences}
    out = []
    for w in sorted(words, key=lambda w: place[w["id"]]["ord"]):
        c, s = place[w["id"]], said[w["id"]]
        entry = {k: w[k] for k in WORD_FIELDS}
        entry.update({"theme": c["theme"], "ord": c["ord"], "au": audio[w["id"]]["w"], "noDistract": c["noDistract"],
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
