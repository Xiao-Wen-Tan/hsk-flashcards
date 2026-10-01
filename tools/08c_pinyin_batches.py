"""Step 8c. Batch files for the agents that correct the sentence pinyin against the pinyin style sheet.

Inputs:  the latest data/build/sentence_pinyin_vNNN.jsonl (the draft of step 8, whose polyphone_batches_vNNN
         folder must be empty), data/build/wordlist_vNNN.jsonl and data/manual/capitals_vNNN.csv (latest),
         and the latest data/build/sentence_pinyin_final_vFFF.jsonl once one exists
Output:  data/build/pinyin_batches_vBBB/batch_001.csv ... with 100 rows each and the columns id, sentence,
         word (the headword), card_py (the headword's card pinyin), names (the names in the sentence and
         how their words are spaced) and draft (the pinyin of step 8)
Only sentences whose text or draft differs from the latest final file go into batches, so after a
sentence changes, only that sentence goes to the agents again.
"""
import sys
from pathlib import Path

from common import (all_version_paths, latest_version_path, next_version_path, read_csv, read_jsonl,
                    write_new_csv)
from pinyin_text import name_rows
from pinyincheck import names_of
from themes import chunks

BATCH = 100
COLUMNS = ["id", "sentence", "word", "card_py", "names", "draft"]


def names_note(sentence, names):
    """The names in a sentence and how their words are spaced, in words for the agents.

    Since the user's decision of 2026-09-29 all pinyin is in lower case, so the note gives only the
    words of each name. With the names 北京 and 李老师 (words 李 and 老师), "李老师在北京。" gives
    "李老师 (a name of two words: 李 | 老师); 北京 (a name, one word)". A sentence without names gives "".
    Names that overlap are read from the left, and the longer one wins, so with the names 小李 and
    李明, "小李明天来。" gives only "小李 (a name of two words: 小 | 李)", because 明天 is a word there.
    """
    found, taken = [], set()
    hits = [(at, hz) for hz in names if hz in sentence for at in range(len(sentence)) if sentence.startswith(hz, at)]
    for at, hz in sorted(hits, key=lambda hit: (hit[0], -len(hit[1]))):
        span = set(range(at, at + len(hz)))
        if not span & taken and hz not in (h for _, h in found):
            taken |= span
            found.append((at, hz))
    notes = []
    for _, hz in found:
        parts, _ = names[hz]
        if len(parts) == 1:
            notes.append(f"{hz} (a name, one word)")
        else:
            notes.append(f"{hz} (a name of {len(parts)} words: " + " | ".join(parts) + ")")
    return "; ".join(notes)


def main():
    draft_path = latest_version_path("data/build/sentence_pinyin", ".jsonl")
    version = draft_path.stem.rsplit("_", 1)[1]
    if list(Path(f"data/build/polyphone_batches_{version}").glob("batch_*.csv")):
        sys.exit("Stopped. The latest pinyin run still lists characters to check (Task 12).")
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    table, problems = name_rows(read_csv(latest_version_path("data/manual/capitals", ".csv")))
    if problems:
        sys.exit("Stopped, nothing written. data/manual/capitals has problems:\n  " + "\n  ".join(problems))
    names = names_of(table, words.values())
    drafts = read_jsonl(draft_path)
    found = all_version_paths("data/build/sentence_pinyin_final", ".jsonl")
    done = {r["id"]: (r["sentence"], r["draft"]) for r in (read_jsonl(found[-1][1]) if found else [])}
    todo = [r for r in drafts if done.get(r["id"]) != (r["sentence"], r["py"])]
    if not todo:
        sys.exit(f"Nothing to do. Every draft line of {draft_path} is already corrected in {found[-1][1]}.")
    folder = next_version_path("data/build/pinyin_batches", "")
    folder.mkdir()
    parts = list(chunks(todo, BATCH))
    for n, part in enumerate(parts, start=1):
        write_new_csv(folder / f"batch_{n:03d}.csv", COLUMNS,
                      [[r["id"], r["sentence"], words[r["id"]]["hz"], words[r["id"]]["py"],
                        names_note(r["sentence"], names), r["py"]] for r in part])
    print(f"{len(todo)} of {len(drafts)} sentences in {len(parts)} batch files in {folder}, "
          f"from the draft {draft_path}.")


if __name__ == "__main__":
    main()
