"""Step 8e. Apply the independent checker's verdicts on the sample and write the final sentence pinyin.

Inputs:  the latest data/build/sentence_pinyin_checked_vCCC.jsonl and data/build/pinyin_review_vCCC/, the
         checker's answers in data/claude/pinyin_review_vCCC/ (for each batch_KKK.csv the latest
         batch_KKK_vMMM.csv; columns id, verdict, py, point, note), and the word list, the public list and
         data/manual/capitals as in step 8d
Outputs: data/build/sentence_pinyin_final_vFFF.jsonl {id, sentence, py, draft, source}, where a line the
         checker fixed has the source review, and data/reports/pinyin_review_vFFF.txt
Nothing is written when an answer is missing or malformed or a FIX line fails the strict checker (then a
fresh checker agent redoes the sample), or when more than 5% of the sample needed a fix (then the user
decides what happens next).
"""
import sys
from pathlib import Path

from common import (all_version_paths, latest_version_path, next_versions, read_csv, read_json, read_jsonl,
                    write_new_jsonl, write_new_text)
from pinyin_text import name_rows
from pinyincheck import check_line, known_readings, match_answers, names_of, word_facts
from wordlist import public_readings

MAX_SHARE = 0.05


def main():
    checked_path = latest_version_path("data/build/sentence_pinyin_checked", ".jsonl")
    version = checked_path.stem.rsplit("_", 1)[1]
    rows = {r["id"]: r for r in read_jsonl(checked_path)}
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    complete = read_json(latest_version_path("data/public/hsk_complete", ".json"))
    listed = public_readings(complete)
    readings = known_readings(listed, words.values())
    facts = word_facts(complete, listed, words.values())
    names = names_of(name_rows(read_csv(latest_version_path("data/manual/capitals", ".csv")))[0], words.values())
    answers_dir = Path("data/claude") / f"pinyin_review_{version}"
    problems, fixes, sample = [], {}, []
    for batch in sorted(Path(f"data/build/pinyin_review_{version}").glob("batch_*.csv")):
        given = read_csv(batch)
        sample += [r["id"] for r in given]
        found = all_version_paths(answers_dir / batch.stem, ".csv")
        if not found:
            problems.append(f"{batch.stem}: no answer file")
            continue
        got, more = match_answers(given, read_csv(found[-1][1]))
        problems += [f"{batch.stem}: {p}" for p in more]
        for r in given:
            answer = got.get(r["id"])
            verdict = ((answer or {}).get("verdict") or "").strip()
            line = ((answer or {}).get("py") or "").strip()
            if answer is None:
                problems.append(f"{r['id']}: missing")
            elif verdict == "FIX":
                wrong = check_line(r["sentence"], line, words[r["id"]], readings, names, facts)
                if wrong or line == r["py"]:
                    why = "fails the strict checker: " + " | ".join(wrong) if wrong else "is the line as given"
                    problems.append(f"{r['id']}: the FIX line {line!r} {why}")
                else:
                    fixes[r["id"]] = (line, (answer.get("point") or "").strip(), (answer.get("note") or "").strip())
            elif verdict != "OK":
                problems.append(f"{r['id']}: verdict {verdict!r} is not OK or FIX")
    if problems:
        sys.exit("Stopped, nothing written. Redo the checker's answer (Task 14 Step 6):\n  "
                 + "\n  ".join(problems[:40]))
    share = len(fixes) / len(sample) if sample else 0.0
    if share > MAX_SHARE:
        sys.exit(f"Stopped, nothing written. The independent checker fixed {len(fixes)} of {len(sample)} sampled lines "
                 f"({share:.1%}), more than {MAX_SHARE:.0%}. Show the fixes to the user and ask how to proceed.")
    for rid, (line, _, _) in fixes.items():
        rows[rid] = {**rows[rid], "py": line, "source": "review"}
    paths = next_versions(rows=("data/build/sentence_pinyin_final", ".jsonl"),
                          report=("data/reports/pinyin_review", ".txt"))
    write_new_jsonl(paths["rows"], [rows[rid] for rid in sorted(rows)])
    lines = ["Pinyin review report", "", f"Sample: {len(sample)} lines. Fixed by the independent checker: {len(fixes)} "
             f"({share:.1%}).", f"Final sentence pinyin: {paths['rows']}", ""]
    lines += [f"  {rid} point {point or '?'}: {rows[rid]['py']} ({note})"
              for rid, (_, point, note) in sorted(fixes.items())]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
