"""Step 8d. Check the corrected sentence pinyin with the strict checker, send failing lines back, and write the result.

Inputs:  the latest data/build/pinyin_batches_vBBB/ (the batch_KKK.csv files of step 8c and the
         batch_KKK_redo_vMMM.csv files this step writes), the agents' answers in data/claude/pinyin_vBBB/
         (batch_KKK_v001.csv answers the batch, v002 and v003 answer the redo files; columns id, sentence,
         py, note), data/build/wordlist_vNNN.jsonl, data/public/hsk_complete_vNNN.json and
         data/manual/capitals_vNNN.csv (latest), and the latest data/build/sentence_pinyin_final_vFFF.jsonl
         if one exists
Outputs: while some lines fail and may still be redone, only data/build/pinyin_batches_vBBB/batch_KKK_redo_vMMM.csv
         (the batch columns plus earlier, the rejected line, and problem, the checker's messages)
         once no line waits for a redo:
         data/build/sentence_pinyin_checked_vCCC.jsonl  {id, sentence, py, draft, source} for every sentence,
                         where source is claude for an accepted line and draft for a line that failed its
                         answer and both redos, so it keeps the draft of step 8 (the report says whether
                         that draft passes the strict checker)
         data/build/pinyin_review_vCCC/batch_001.csv  150 random accepted lines for the independent checker
                         (id, sentence, word, card_py, names, py)
         data/reports/pinyin_check_vCCC.txt
Nothing is written while an answer file is missing. Sentences that step 8c did not batch keep their
line from the latest final file.
"""
import random
import sys
from pathlib import Path

from common import (all_version_paths, latest_version_path, next_versions, read_csv, read_json, read_jsonl,
                    write_new_csv, write_new_jsonl, write_new_text)
from pinyin_text import name_rows
from pinyincheck import check_answer, check_line, known_readings, match_answers, names_of, word_facts
from wordlist import public_readings

REDOS = 2
SAMPLE = 150
COLUMNS = ["id", "sentence", "word", "card_py", "names", "draft"]


def main():
    folder = latest_version_path("data/build/pinyin_batches", "")
    answers_dir = Path("data/claude") / folder.name.replace("pinyin_batches", "pinyin")
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    complete = read_json(latest_version_path("data/public/hsk_complete", ".json"))
    listed = public_readings(complete)
    readings = known_readings(listed, words.values())
    facts = word_facts(complete, listed, words.values())
    names = names_of(name_rows(read_csv(latest_version_path("data/manual/capitals", ".csv")))[0], words.values())
    problems, redo, done, kept, notes, known_wrong = [], {}, {}, [], [], 0
    tries = {1: 0, 2: 0, 3: 0}
    for batch in sorted(folder.glob("batch_???.csv")):
        given = read_csv(batch)
        rounds = dict(all_version_paths(answers_dir / batch.stem, ".csv"))
        sent = {1: given}
        for v in range(2, REDOS + 2):
            path = folder / f"{batch.stem}_redo_v{v:03d}.csv"
            if path.exists():
                sent[v] = read_csv(path)
        missing = [v for v in sent if v not in rounds]
        if missing:
            problems.append(f"{batch.stem}: no answer file batch_{batch.stem[6:]}_v{missing[0]:03d}.csv")
            continue
        answers = {}
        for v, rows in sent.items():
            answers[v], more = match_answers(rows, read_csv(rounds[v]))
            notes += [f"{batch.stem} v{v:03d}: {p}" for p in more]
        for row in given:
            rid = row["id"]
            last = max(v for v, rows in sent.items() if any(r["id"] == rid for r in rows))
            answer = answers[last].get(rid)
            found = ["there is no single answer row for this line"] if answer is None else \
                check_answer(row, answer, words[rid], readings, names, facts)
            if ((answer or {}).get("note") or "").strip():
                notes.append(f"{rid}: {answer['note'].strip()}")
            if not found:
                done[rid] = {"id": rid, "sentence": row["sentence"], "py": answer["py"].strip(), "draft": row["draft"],
                             "source": "claude"}
                tries[last] += 1
            elif last <= REDOS:
                redo.setdefault(batch.stem, []).append(
                    [row[c] for c in COLUMNS] + [(answer or {}).get("py", ""), " | ".join(found)])
            else:
                done[rid] = {"id": rid, "sentence": row["sentence"], "py": row["draft"], "draft": row["draft"],
                             "source": "draft"}
                wrong = check_line(row["sentence"], row["draft"], words[rid], readings, names, facts)
                known_wrong += bool(wrong)
                kept.append(f"{rid} {row['sentence']} | draft {row['draft']} | last answer: {' | '.join(found)}"
                            + (f" | the draft fails the strict checker too: {' | '.join(wrong)}" if wrong else ""))
    if problems:
        sys.exit("Stopped, nothing written. Run the agents for these files first:\n  " + "\n  ".join(problems))
    if redo:
        written = []
        for stem, rows in redo.items():
            version = max(dict(all_version_paths(answers_dir / stem, ".csv"))) + 1
            path = folder / f"{stem}_redo_v{version:03d}.csv"
            write_new_csv(path, COLUMNS + ["earlier", "problem"], rows)
            written.append(str(path))
        count = sum(len(rows) for rows in redo.values())
        sys.exit(f"Stopped, only redo files written. {count} lines failed the strict checker and go to a redo agent "
                 "(Task 14 Step 5), then run this step again:\n  " + "\n  ".join(written))
    earlier = all_version_paths("data/build/sentence_pinyin_final", ".jsonl")
    rows = {r["id"]: r for r in (read_jsonl(earlier[-1][1]) if earlier else [])}
    rows.update(done)
    accepted = sorted(rid for rid, r in done.items() if r["source"] == "claude")
    sample = sorted(random.Random(17).sample(accepted, min(SAMPLE, len(accepted))))
    paths = next_versions(rows=("data/build/sentence_pinyin_checked", ".jsonl"),
                          review=("data/build/pinyin_review", ""), report=("data/reports/pinyin_check", ".txt"))
    write_new_jsonl(paths["rows"], [rows[rid] for rid in sorted(rows)])
    paths["review"].mkdir()
    by_id = {r["id"]: r for batch in sorted(folder.glob("batch_???.csv")) for r in read_csv(batch)}
    write_new_csv(paths["review"] / "batch_001.csv", COLUMNS[:5] + ["py"],
                  [[by_id[rid][c] for c in COLUMNS[:5]] + [done[rid]["py"]] for rid in sample])
    lines = ["Pinyin check report", "",
             f"Batches: {folder}. Lines checked: {len(done)}. Sentences in all: {len(rows)}.",
             f"Accepted at the first answer: {tries[1]}. After one redo: {tries[2]}. After two redos: {tries[3]}.",
             f"Kept as the draft after two failed redos: {len(kept)}. Drafts among them that fail the strict "
             f"checker too, so they are known to be wrong: {known_wrong}.",
             f"Sample for the independent checker: {len(sample)} lines in {paths['review']}", "",
             "Lines kept as the draft, with the checker's messages (show them to the user):"]
    lines += [f"  {line}" for line in kept] or ["  none"]
    lines += ["", "Notes from the agents (names that may need a row in data/manual/capitals, doubts):"]
    lines += [f"  {line}" for line in notes] or ["  none"]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines[:6]))
    print(f"Report: {paths['report']}")


if __name__ == "__main__":
    main()
