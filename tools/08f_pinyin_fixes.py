"""Step 8f. Apply fixes to final sentence pinyin lines that a later scan found wrong outside the review sample.

Inputs:  the latest data/build/sentence_pinyin_final_vFFF.jsonl, the latest data/claude/sentence_pinyin_fixes_vNNN.csv
         (columns id, sentence, py, note; one corrected line per row), and the word list, the public list and
         data/manual/capitals as in step 8d
Output:  data/build/sentence_pinyin_final_vFFF.jsonl, the next version, where a fixed line has the source fix
Nothing is written when a fix names an unknown id, its sentence differs from the final file, its line fails
the strict checker, or it changes nothing. Step 8d keeps these lines in later runs, because it starts from the
latest final file and only replaces the sentences it batched.
"""
import sys

from common import latest_version_path, next_version_path, read_csv, read_json, read_jsonl, write_new_jsonl
from pinyin_text import name_rows
from pinyincheck import check_line, known_readings, names_of, word_facts
from wordlist import public_readings


def main():
    final_path = latest_version_path("data/build/sentence_pinyin_final", ".jsonl")
    fixes_path = latest_version_path("data/claude/sentence_pinyin_fixes", ".csv")
    rows = {r["id"]: r for r in read_jsonl(final_path)}
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    complete = read_json(latest_version_path("data/public/hsk_complete", ".json"))
    listed = public_readings(complete)
    readings = known_readings(listed, words.values())
    facts = word_facts(complete, listed, words.values())
    names = names_of(name_rows(read_csv(latest_version_path("data/manual/capitals", ".csv")))[0], words.values())
    problems, done = [], []
    for fix in read_csv(fixes_path):
        rid, line = fix["id"], fix["py"].strip()
        row = rows.get(rid)
        if row is None:
            problems.append(f"{rid}: not in {final_path}")
        elif row["sentence"] != fix["sentence"]:
            problems.append(f"{rid}: the sentence differs from {final_path}")
        elif line == row["py"]:
            problems.append(f"{rid}: the fix is the line as it stands")
        else:
            wrong = check_line(row["sentence"], line, words[rid], readings, names, facts)
            if wrong:
                problems.append(f"{rid}: the line {line!r} fails the strict checker: " + " | ".join(wrong))
            else:
                done.append((rid, row["py"], line, fix["note"].strip()))
    if problems:
        sys.exit("Stopped, nothing written:\n  " + "\n  ".join(problems))
    for rid, _, line, _ in done:
        rows[rid] = {**rows[rid], "py": line, "source": "fix"}
    path = next_version_path("data/build/sentence_pinyin_final", ".jsonl")
    write_new_jsonl(path, [rows[rid] for rid in sorted(rows)])
    print(f"{len(done)} lines fixed from {fixes_path}. Final sentence pinyin: {path}")
    for rid, old, line, note in done:
        print(f"  {rid}: {old} -> {line} ({note})")


if __name__ == "__main__":
    main()
