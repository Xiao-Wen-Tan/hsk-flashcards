"""Step 8. Pinyin for every example sentence, and the list of characters to check by hand.

Inputs:  data/build/sentences_final_vNNN.jsonl, data/build/wordlist_vNNN.jsonl,
         data/public/hsk_complete_vNNN.json, data/manual/four_char_words_vNNN.csv and
         data/manual/capitals_vNNN.csv (latest), and data/claude/pinyin_fixes_vNNN.csv (latest)
         once the polyphone check has run
Outputs: data/build/sentence_pinyin_vNNN.jsonl  {id, sentence, py}, where sentence is the text the pinyin was
                         made from, so step 10 can tell when the final sentences changed afterwards
         data/build/polyphone_batches_vNNN/batch_001.csv ...  characters not yet checked, 200 rows each
                         (id, index, char, given, options, sentence, word); the folder is empty when all are checked
         data/reports/pinyin_vNNN.txt
All pinyin is in lower case, the start of a sentence and names included (the user's decision of
2026-09-29), so data/manual/capitals only says how the words of a name are spaced ("lǐ míng").
When four-character sentence words still need a form, only the batch files for the form agents
(Plan 3a Task 7) are written, to data/build/four_char_batches_vNNN/.
"""
import logging
import re
import sys
from collections import Counter, defaultdict

import jieba
from pypinyin import Style, lazy_pinyin, pinyin

from common import (all_version_paths, latest_version_path, next_version_path, next_versions, read_csv, read_json,
                    read_jsonl, write_new_csv, write_new_jsonl, write_new_text)
from meaning import public_pos
from pinyincheck import word_facts
from pinyin_text import (FORM_BATCH, FORM_BATCH_COLUMNS, form_joints, form_rows, joints_of_py, name_rows,
                         syllables_of_py)
from sentpinyin import (POINTING_WORDS, SYLLABLE, attached, make_lookup, name_words, potential_readings,
                        public_word_readings, regroup, render, segment, spot_checks, split_words, syllables,
                        word_joints)
from themes import chunks
from wordlist import public_readings

CHECK_BATCH = 200
NAME_TAGS = {"nr", "ns", "nt", "nrt", "nrfg"}  # jieba's tags for names of people, places and organisations
# Words that stand after a surname as a title ("lǐ lǎoshī", "wáng xiānsheng"), and before one ("xiǎo wáng").
TITLES = {"老师", "先生", "小姐", "女士", "太太", "夫人", "医生", "大夫", "教授", "博士", "经理", "校长", "师傅",
          "阿姨", "叔叔", "主任", "总"}
ERHUA = {"这儿", "那儿", "哪儿", "一点儿", "一会儿", "有点儿", "一块儿", "玩儿", "好玩儿"}
OPTIONS = dict(style=Style.TONE3, neutral_tone_with_five=True, v_to_u=True)
_HANZI = re.compile(r"[\u3007\u4e00-\u9fff]")  # Chinese characters, with the 〇 of years (二〇〇八年)


def make_readings_of(listed):
    """readings_of(char) gives the numbered readings of a character, for the spot-check list.

    listed: Plan 3a public_readings of the public list. Its lower-case readings of the character
    are used when it has any, so 他 has only ta1. pypinyin also knows rare old readings (他 tuo2,
    是 ti2) that would put nearly every 他 and 是 on the list. A character the list lacks takes
    pypinyin's readings, except 〇, the zero of years, which is only ling2 (pypinyin also gives
    yuan2 and xing1).
    """
    def readings_of(ch):
        if ch == "〇":
            return ["ling2"]
        found = [r["num"] for r in listed.get(ch, []) if r["py"][:1].islower()]
        return found or pinyin(ch, heteronym=True, **OPTIONS)[0]
    return readings_of


def load_fixes():
    found = all_version_paths("data/claude/pinyin_fixes", ".csv")
    fixes = defaultdict(dict)
    for r in (read_csv(found[-1][1]) if found else []):
        fixes[r["id"]][int(r["index"])] = (r["char"], r["syllable"])
    return fixes


def latest_rows(stem):
    found = all_version_paths(stem, ".csv")
    return read_csv(found[-1][1]) if found else []


def main():
    jieba.setLogLevel(logging.WARNING)
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    sentences = read_jsonl(latest_version_path("data/build/sentences_final", ".jsonl"))
    names, problems = name_rows(read_csv(latest_version_path("data/manual/capitals", ".csv")))
    forms, more = form_rows(latest_rows("data/manual/four_char_words"))
    problems += more
    for part in [p for w in words.values() for p in w["hz"].split("…") if p] + list(names):
        jieba.add_word(part)
    cards_of = Counter(w["hz"] for w in words.values())
    complete = read_json(latest_version_path("data/public/hsk_complete", ".json"))
    listed = public_readings(complete)
    # What the shared 一 rule (sentpinyin.yi_rule) needs to know: the known words, the measure words and
    # the surnames, as the strict checker (Task 13) builds them, so the draft and the checker agree.
    facts = word_facts(complete, listed, words.values())

    def guess(hanzi):
        """pypinyin's reading of a word, one numbered syllable per character."""
        return lazy_pinyin(hanzi, **OPTIONS)

    public_nums, word_readings = public_word_readings(listed, set(cards_of), guess)
    public_nums.update(POINTING_WORDS)  # 这个 "zhège" (point 1 of the style sheet), read like a public-list word
    # A card word is read with the syllables its card shows, so 受不了 keeps the neutral bu of "shòubuliǎo".
    shown = {w["id"]: syllables_of_py(w["py"], w["pyNum"].split()) or w["pyNum"].split() for w in words.values()}
    card_nums = {w["hz"]: " ".join(shown[w["id"]]) for w in words.values()
                 if cards_of[w["hz"]] == 1 and "…" not in w["hz"]}
    lookup = make_lookup(ERHUA | {w["hz"] for w in words.values() if w["key"].endswith("r5")}, card_nums, public_nums,
                         guess)
    settled = {hz for hz in list(card_nums) + list(public_nums) if len(hz) > 1} - set(word_readings)
    idioms = {x["simplified"] for x in complete if any("(idiom)" in m for f in x["forms"] for m in f["meanings"])}
    card_joints = {w["hz"]: joints_of_py(w["py"], w["pyNum"].split()) for w in words.values() if "…" not in w["hz"]}
    known = set(card_joints) | {x["simplified"] for x in complete}
    pos_of = {x["simplified"]: public_pos(x.get("pos", [])) for x in complete}
    for w in words.values():
        pos_of[w["hz"]] = list(dict.fromkeys(pos_of.get(w["hz"], []) + w["pos"]))
    # Four-character words kept whole take their form's joints. Every such word needs a row in
    # data/manual/four_char_words, a CC-CEDICT idiom too, whose mark is only a hint to the form agents.
    fixed = {hz: form_joints(form, parts) for hz, (form, parts) in forms.items() if form != "words"}
    fixed.update(card_joints)
    # All pinyin is in lower case (the user's decision of 2026-09-29). A row of data/manual/capitals
    # only divides a name that is not a card headword into its words (李明 "lǐ míng", 福建省 "fújiàn
    # shěng"), and jieba's name tags are only listed in the report.
    split_names = {hz: v for hz, v in names.items() if hz not in cards_of}

    def joints_of(word):
        return word_joints(word, fixed)

    readings_of = make_readings_of(listed)
    fixes = load_fixes()
    rows, checks, stale, name_count = [], [], 0, Counter()
    undecided = {}
    for s in sentences:
        w, text = words[s["id"]], s["sentence"]
        pairs = segment(text)
        tagged = {word for word, tag in pairs if tag in NAME_TAGS}
        titled = {a + b for (a, a_tag), (b, b_tag) in zip(pairs, pairs[1:])
                  if (a_tag in NAME_TAGS and len(a) == 1 and b in TITLES)
                  or (a in ("小", "老") and b_tag in NAME_TAGS and len(b) == 1)}
        titled |= {word for word, tag in pairs if tag in NAME_TAGS and word[1:] in TITLES}

        def cut(piece):
            """jieba's words for a piece that the headword cut from a longer word, whose name tags count too."""
            found = segment(piece)
            tagged.update(word for word, tag in found if tag in NAME_TAGS)
            return [word for word, _ in found]

        # Point 1 of the style sheet: 这个, 那个 and 哪个 are one word each ("zhège"), except in the
        # sentence of the card 个, whose "gè" must show as on its card ("zhè gè").
        known_here = known if w["hz"] == "个" else known | set(POINTING_WORDS)
        grouped = regroup(text, [word for word, _ in pairs], w["hz"], cut, known_here)
        keep = [p for p in w["hz"].split("…") if p] + list(names)
        tokens = split_words(grouped, known_here, pos_of, keep=keep, forms=forms, cards=card_joints)
        tokens, _ = name_words(text, tokens, split_names)
        for t in grouped + tokens:
            stem = t[:-1] if len(t) > 2 and t.endswith("儿") else t
            if len(stem) == 4 and _HANZI.match(stem) and stem not in card_joints and stem not in forms \
                    and stem not in undecided:
                mark = "idiom" if stem in idioms else ""
                undecided[stem] = [stem, " ".join(lookup(stem)), "", "sentence", text, mark]
        for t in sorted({t for t in grouped if t in tagged and t not in known} | titled):
            if t not in names:
                name_count[t] += 1
        mine = {}
        for i, (ch, syl) in fixes.get(s["id"], {}).items():
            if i < len(text) and text[i] == ch:
                mine[i] = syl
            else:
                stale += 1
        sylls = syllables(text, tokens, lookup, w["hz"], shown[w["id"]], {**potential_readings(tokens, pos_of), **mine},
                          facts=facts)
        bad = [x for x in sylls if x is not None and not SYLLABLE.match(x)]
        if bad or "".join(tokens) != text:
            problems.append(f"{s['id']} {text}: unusable pinyin {bad}")
            continue
        rows.append({"id": s["id"], "sentence": text,
                     "py": render(text, tokens, sylls, (), joints_of, attached(tokens, pos_of))})
        checks += [[s["id"], i, ch, given, options, text, w["hz"]]
                   for i, ch, given, options in spot_checks(text, tokens, sylls, w["hz"], readings_of, settled,
                                                            word_readings)
                   if i not in mine]
    if problems:
        sys.exit("Stopped, nothing written:\n  " + "\n  ".join(problems[:40]))
    if undecided:
        folder = next_version_path("data/build/four_char_batches", "")
        folder.mkdir()
        batch = list(undecided.values())
        for n in range(0, len(batch), FORM_BATCH):
            write_new_csv(folder / f"batch_{n // FORM_BATCH + 1:03d}.csv", FORM_BATCH_COLUMNS, batch[n:n + FORM_BATCH])
        sys.exit(f"Stopped before writing the pinyin: {len(batch)} four-character sentence words need a form. "
                 f"Batch files for the form agents are in {folder}.")
    paths = next_versions(rows=("data/build/sentence_pinyin", ".jsonl"), check=("data/build/polyphone_batches", ""),
                          report=("data/reports/pinyin", ".txt"))
    write_new_jsonl(paths["rows"], rows)
    paths["check"].mkdir()
    for n, part in enumerate(chunks(checks, CHECK_BATCH), start=1):
        write_new_csv(paths["check"] / f"batch_{n:03d}.csv",
                      ["id", "index", "char", "given", "options", "sentence", "word"], part)
    applied = sum(len(v) for v in fixes.values()) - stale
    lines = ["Pinyin report", "", f"Sentences: {len(rows)}. Fixes applied: {applied}. Fixes that no longer fit: {stale}.",
             f"Characters still to check: {len(checks)} in {-(-len(checks) // CHECK_BATCH)} batches in {paths['check']}",
             "", "Examples:"] + [f"  {r['id']} {r['py']}" for r in rows[:10]]
    names_note = ["", "Words that jieba tags as names, or a surname with a title, that neither list nor",
                  "data/manual/capitals has. For each real name of several words that are written apart (a surname",
                  "and a given name, 小 or 老 and a surname, a place name and its kind), add a row giving its words",
                  "to a new data/manual/capitals file (Task 11 Step 3 says how):",
                  "  " + (" ".join(f"{hz} {n}" for hz, n in name_count.most_common()) or "none")]
    write_new_text(paths["report"], "\n".join(lines + names_note) + "\n")
    print("\n".join(lines))
    print(f"Name candidates that neither list nor data/manual/capitals has: {len(name_count)}, "
          f"listed in {paths['report']}")


if __name__ == "__main__":
    main()
