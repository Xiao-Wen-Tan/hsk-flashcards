"""Step 5. Build the card word list: headwords, readings, levels, IDs, parts of speech and meanings.

Inputs:  data/public/hsk2_old_exclusive_vNNN.json, data/public/hsk_complete_vNNN.json,
         data/extract/pdf_entries_vNNN.jsonl, data/decode/cidmap_vNNN.csv,
         data/manual/pdf_fixes_vNNN.csv, data/manual/public_readings_vNNN.csv,
         data/manual/second_readings_vNNN.csv, data/manual/gloss_fixes_vNNN.csv,
         data/manual/capitals_vNNN.csv, data/manual/four_char_words_vNNN.csv once it exists,
         data/ids/word_ids_vNNN.csv once it exists
Outputs: data/build/wordlist_vNNN.jsonl (one card per line), data/reports/wordlist_vNNN.txt,
         and data/ids/word_ids_vNNN.csv when new IDs were handed out
Nothing is written if any PDF entry or public word still needs a hand-written decision,
if a gloss fix names a card that does not exist, or if a card has no usable English meaning.
When four-character headwords still need a form (data/manual/four_char_words), only the batch
files for the form agents are written, to data/build/four_char_batches_vNNN/.
The report lists the cards whose word spacing needs a look, and ends with every card meaning
that holds a word CC-CEDICT never uses, for review.
"""
import logging
import sys
from collections import Counter

import jieba

from common import (all_version_paths, latest_version_path, next_version_path, next_versions, read_csv,
                    read_json, read_jsonl, write_new_csv, write_new_jsonl, write_new_text)
from meaning import en_short, fit_en, public_pos, unknown_words, vocabulary
from pinyin_text import (FORM_BATCH, FORM_BATCH_COLUMNS, card_py, form_rows, headword_joints, joints_from_sizes,
                         name_rows, printed_pinyin, py_base, syllable_count, tone_change)
from wordids import assign_ids
from wordlist import (NO_FREQUENCY, apply_gloss_fixes, english, level_of, pdf_words, public_only_words,
                      public_readings, second_readings)


def load_fixes():
    rows = read_csv(latest_version_path("data/manual/pdf_fixes", ".csv"))
    return {(int(r["file"]), int(r["n"])): {k: (v or "").strip() for k, v in r.items()} for r in rows}


def load_gloss_fixes():
    rows = read_csv(latest_version_path("data/manual/gloss_fixes", ".csv"))
    return {(r["hz"].strip(), r["pynum"].strip().lower()): r["gloss"].strip() for r in rows}


def latest_rows(stem):
    """The rows of the newest <stem>_vNNN.csv, or [] when there is none yet."""
    found = all_version_paths(stem, ".csv")
    return read_csv(found[-1][1]) if found else []


def cut(text):
    """The words jieba finds in text, from its own dictionary only (no guessing of unknown words)."""
    return jieba.lcut(text, HMM=False)


def card_pinyin(w, forms, names):
    """py, pyNum, pyBase and syl for one word, where py's word spacing came from, and any missing decision.

    py uses textbook word spacing. The source is "pdf" when an HSK 1 to 4 PDF entry prints pinyin
    that fits the card reading (its syllables, tones and capital are used as printed, so 互联网 is
    "hùliánwǎng" as HSK4 #776 prints it). Otherwise it is "idiom", "words" or "joined" for a
    four-character headword, whose form comes from `forms` ({hz: (form, words)} from
    data/manual/four_char_words), which has a row for every such headword, CC-CEDICT idioms
    included. Any other headword has the source "jieba". Only py shows the 一 and 不 tone changes.
    pyNum, pyBase and syl use the dictionary tones, so 不客气 gives py "bú kèqi" and pyNum
    "bu4 ke4 qi5".
    names ({hz: (words, capitals)} from data/manual/capitals) says whether a card without a fitting
    print has a capital, and for a person's name which words it has. A card that the public list or
    a pdf_fixes row writes with a capital needs a row there.
    The last two items returned name a missing decision (or None), and the four-character
    headword that needs a form (or None).
    """
    chars = w["hz"].replace("…", "")
    nums = w["num"].split()
    if len(chars) != len(nums):
        raise ValueError(f"{w['hz']}: {len(chars)} characters but reading {w['num']!r}")
    printed = printed_pinyin(w["latin"], w["hz"], nums)
    missing = needs_form = None
    if printed:
        shown, joints, capital = printed
        source = "pdf"
        if w["hz"] in names:
            missing = f"{w['hz']}: data/manual/capitals has a row, but its capital follows the HSK PDF print"
    else:
        stem = w["hz"][:-1] if len(w["hz"]) > 2 and w["hz"].endswith("儿") else w["hz"]
        form = forms.get(stem)
        if len(stem) == 4 and "…" not in stem and form is None:
            needs_form = stem
        shown, joints = tone_change(chars, nums), headword_joints(w["hz"], cut, form)
        parts, capital = names.get(w["hz"], ([w["hz"]], w["capital"]))
        if len(parts) > 1:
            joints = joints_from_sizes([len(p) for p in parts])
        if w["capital"] and w["hz"] not in names:
            missing = f"{w['hz']}: written with a capital in the public list; add a row to data/manual/capitals"
        source = form[0] if len(stem) == 4 and form else "jieba"
    return {"py": card_py(shown, joints, capital), "pyNum": " ".join(nums), "pyBase": py_base(nums),
            "syl": syllable_count(nums)}, source, missing, needs_form


def main():
    jieba.setLogLevel(logging.WARNING)
    old = read_json(latest_version_path("data/public/hsk2_old_exclusive", ".json"))
    complete = read_json(latest_version_path("data/public/hsk_complete", ".json"))
    entries = read_jsonl(latest_version_path("data/extract/pdf_entries", ".jsonl"))
    fwd = {int(r["cid"]): r["char"] for r in read_csv(latest_version_path("data/decode/cidmap", ".csv"))}
    chosen = {r["hz"]: r for r in read_csv(latest_version_path("data/manual/public_readings", ".csv"))}
    decided = {(r["hz"], r["pynum"].strip().lower()): r
               for r in read_csv(latest_version_path("data/manual/second_readings", ".csv"))}
    readings = public_readings(complete)
    info = {w["simplified"]: w for w in complete}
    idioms = {hz for hz, options in readings.items() if any("(idiom)" in m for r in options for m in r["meanings"])}
    old_level = {w["simplified"]: w["hsk"] for w in old}

    pdf, problems = pdf_words(entries, fwd, readings, load_fixes())
    listed, more = public_only_words(old, {w["hz"] for w in pdf.values()}, readings, chosen)
    problems += more
    second, more = second_readings(complete, readings, set(pdf) | set(listed), decided)
    problems += more
    words = {**pdf, **listed, **second}
    problems += apply_gloss_fixes(words, load_gloss_fixes())
    forms, more = form_rows(latest_rows("data/manual/four_char_words"))
    problems += more
    names, more = name_rows(read_csv(latest_version_path("data/manual/capitals", ".csv")))
    problems += more
    if problems:
        sys.exit("Stopped, nothing written. Add rows to data/manual/pdf_fixes, public_readings or "
                 "second_readings, or correct gloss_fixes, four_char_words or capitals:\n  " + "\n  ".join(problems))

    senses = {k: english(w, readings) for k, w in words.items()}
    empty = [f"{hz} {num}" for (hz, num), found in senses.items() if not found]
    if empty:
        sys.exit("Stopped, nothing written. No usable English meaning for: " + ", ".join(empty))
    for w in words.values():
        w["lv"] = level_of(w, old_level)
        w["freq"] = info.get(w["hz"], {}).get("frequency", NO_FREQUENCY)
    keys = sorted(words, key=lambda k: (words[k]["lv"], words[k]["freq"], k))
    found = all_version_paths("data/ids/word_ids", ".csv")
    frozen = read_csv(found[-1][1]) if found else []
    ids, new_rows = assign_ids(keys, frozen)

    rows, spacing, listed_capital, missing, need_forms = [], {}, {}, [], {}
    for key in keys:
        w = words[key]
        pinyin, spacing[ids[key]], need, stem = card_pinyin(w, forms, names)
        missing += [need] if need else []
        if stem:
            need_forms[stem] = [stem, w["num"], fit_en(senses[key]), "card", "", "idiom" if stem in idioms else ""]
        listed_capital[ids[key]] = w["capital"]
        rows.append({"id": ids[key], "hz": w["hz"], **pinyin, "lv": w["lv"],
                     "pos": w["pos"] or public_pos(info.get(w["hz"], {}).get("pos", [])),
                     "en": fit_en(senses[key]), "enShort": en_short(senses[key]), "freq": w["freq"],
                     "src": "pdf" if w["files"] else "list", "key": w["num"], "refs": w["refs"],
                     "sents": [list(s) for s in w["sents"]]})
    rows.sort(key=lambda r: r["id"])
    if missing:
        sys.exit("Stopped, nothing written. A hand-written decision is missing:\n  " + "\n  ".join(missing))
    if need_forms:
        folder = next_version_path("data/build/four_char_batches", "")
        folder.mkdir()
        batch = list(need_forms.values())
        for n in range(0, len(batch), FORM_BATCH):
            write_new_csv(folder / f"batch_{n // FORM_BATCH + 1:03d}.csv", FORM_BATCH_COLUMNS, batch[n:n + FORM_BATCH])
        sys.exit(f"Stopped before writing the word list: {len(batch)} four-character headwords need a form. "
                 f"Batch files for the form agents are in {folder}.")

    paths = next_versions(wordlist=("data/build/wordlist", ".jsonl"), report=("data/reports/wordlist", ".txt"))
    write_new_jsonl(paths["wordlist"], rows)
    ids_note = ""
    if new_rows:
        ids_path = next_version_path("data/ids/word_ids", ".csv")
        write_new_csv(ids_path, ["id", "hz", "pynum"], [[r["id"], r["hz"], r["pynum"]] for r in frozen + new_rows])
        ids_note = f" (written to {ids_path})"
    by_level = Counter(r["lv"] for r in rows)
    per_hz = Counter(r["hz"] for r in rows)
    vocab = vocabulary(m for options in readings.values() for r in options for m in r["meanings"])
    odd = [(r, unknown_words(r["en"], vocab)) for r in rows]
    odd = [(r, strange) for r, strange in odd if strange]
    by_source = Counter(spacing.values())
    unprinted = [r for r in rows if r["refs"] and any(int(ref.split()[0][3:]) <= 4 for ref in r["refs"])
                 and spacing[r["id"]] != "pdf"]
    in_file = {form: [r for r in rows if spacing[r["id"]] == form] for form in ("idiom", "words", "joined")}
    split = [r for r in rows if spacing[r["id"]] == "jieba" and " " in r["py"]]
    capitals = [r for r in rows if r["py"][:1].isupper()]
    printed_caps = [r for r in capitals if spacing[r["id"]] == "pdf"]
    listed_caps = [r for r in capitals if spacing[r["id"]] != "pdf"]
    lowered = [r for r in rows if listed_capital[r["id"]] and not r["py"][:1].isupper()]
    lines = ["Word list report", "",
             f"Cards: {len(rows)} ({len(pdf)} from the PDFs, {len(listed)} only in the public HSK 2.0 list, "
             f"{len(second)} second readings)",
             "Second readings: " + " ".join(f"{hz} {num}" for hz, num in sorted(second)),
             "By HSK level: " + ", ".join(f"HSK{lv} {by_level[lv]}" for lv in sorted(by_level)),
             f"Cards with at least one PDF sentence to choose from: {sum(1 for r in rows if r['sents'])}",
             "Headwords with more than one card: " + " ".join(sorted(h for h, n in per_hz.items() if n > 1)),
             f"IDs kept from the frozen file: {len(rows) - len(new_rows)}. New IDs: {len(new_rows)}{ids_note}",
             f"Cards without a part-of-speech label: {sum(1 for r in rows if not r['pos'])}",
             f"Cards whose quiz meaning was shortened with …: {sum(1 for r in rows if r['enShort'].endswith('…'))}",
             f"Cards whose meaning holds a word CC-CEDICT never uses: {len(odd)} (listed at the end of the report)",
             f"Card pinyin word spacing: {by_source['pdf']} from the HSK 1 to 4 PDFs, "
             f"{by_source['idiom'] + by_source['words'] + by_source['joined']} four-character words ({by_source['idiom']} "
             f"idioms, {by_source['words']} written as several words, {by_source['joined']} joined), "
             f"{by_source['jieba']} from jieba ({len(split)} of them more than one word)",
             f"Cards written with a capital: {len(capitals)} ({len(printed_caps)} as the HSK 1 to 4 PDFs print them, "
             f"{len(listed_caps)} as data/manual/capitals sets them). In lower case although the public list has "
             f"a capital: {len(lowered)}",
             ""]
    review = ["HSK 1 to 4 cards whose PDF pinyin does not fit the card reading, so jieba gave the spacing:"]
    review += [f"  {r['id']} {r['hz']} {r['py']} | {r['pyNum']}" for r in unprinted] or ["  none"]
    review += ["", "Four-character headwords whose form data/manual/four_char_words gives:"]
    review += [f"  {form}: " + (" ".join(f"{r['hz']} {r['py']}" for r in found) or "none")
               for form, found in in_file.items()]
    review += ["", "Headwords that jieba splits into more than one word:",
               "  " + (" ".join(f"{r['hz']} {r['py']}" for r in split) or "none"), ""]
    review += ["Cards written with a capital, as names. The first group follows the HSK 1 to 4 PDFs' print.",
               "The second takes its capital from data/manual/capitals, which follows the public list until the",
               "user decides, because the HSK 5 and 6 PDFs print every word in lower case. Show it to the user.",
               "  As printed: " + " ".join(f"{r['hz']} {r['py']}" for r in printed_caps),
               "  From data/manual/capitals: " + " ".join(f"{r['hz']} {r['py']}" for r in listed_caps),
               "In lower case although the public list has a capital, as the HSK 1 to 4 PDFs print them or as",
               "data/manual/capitals sets them:",
               "  " + (" ".join(f"{r['hz']} {r['py']}" for r in lowered) or "none"), ""]
    review += ["Card meanings with a word CC-CEDICT never uses. Most are real English words (noonday, kinsfolk).",
               "Look for words run together, misspellings and junk text, and fix them in a new gloss_fixes file.", ""]
    review += [f"  {r['id']} {r['hz']} {r['pyNum']}: {' '.join(strange)} | {r['en']}" for r, strange in odd]
    write_new_text(paths["report"], "\n".join(lines + review) + "\n")
    print("\n".join(lines))
    print(f"Word list: {paths['wordlist']}. Report: {paths['report']}")


if __name__ == "__main__":
    main()
