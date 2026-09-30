"""Step 8b. Turn the polyphone checker's answers into pinyin fixes.

Inputs:  the latest data/build/polyphone_batches_vNNN/ and the answers in data/claude/polyphone_vNNN/
         (for each batch_KKK.csv the latest batch_KKK_vMMM.csv; columns id, index, char, verdict, syllable),
         and the latest data/claude/pinyin_fixes_vFFF.csv if one exists
Output:  data/claude/pinyin_fixes_vFFF.csv (next version; id, index, char, syllable) holding every earlier
         row plus one row per checked character. An OK answer keeps the given syllable, so that
         character counts as checked and is not listed again.
Nothing is written while an answer file is missing or has problems.
"""
import sys
from pathlib import Path

from common import all_version_paths, latest_version_path, next_version_path, read_csv, write_new_csv
from sentpinyin import check_polyphone_answers


def main():
    folder = latest_version_path("data/build/polyphone_batches", "")
    batches = sorted(folder.glob("batch_*.csv"))
    if not batches:
        sys.exit(f"Nothing to merge: {folder} is empty, so every character is checked.")
    answers_dir = Path("data/claude") / folder.name.replace("polyphone_batches", "polyphone")
    problems, new_rows, changed = [], [], 0
    for batch in batches:
        found = all_version_paths(answers_dir / batch.stem, ".csv")
        if not found:
            problems.append(f"{batch.stem}: no answer file")
            continue
        given = read_csv(batch)
        more, rows = check_polyphone_answers(given, read_csv(found[-1][1]))
        problems += [f"{batch.stem}: {p}" for p in more]
        chosen = {(r["id"], int(r["index"])): r["given"] for r in given}
        changed += sum(1 for rid, i, _, syl in rows if chosen[(rid, i)] != syl)
        new_rows += rows
    if problems:
        sys.exit("Stopped, nothing written. Redo these answers:\n  " + "\n  ".join(problems[:40]))
    earlier = all_version_paths("data/claude/pinyin_fixes", ".csv")
    merged = {(r["id"], int(r["index"])): (r["char"], r["syllable"]) for r in
              (read_csv(earlier[-1][1]) if earlier else [])}
    for rid, i, ch, syl in new_rows:
        merged[(rid, i)] = (ch, syl)
    path = next_version_path("data/claude/pinyin_fixes", ".csv")
    write_new_csv(path, ["id", "index", "char", "syllable"],
                  [[rid, i, ch, syl] for (rid, i), (ch, syl) in sorted(merged.items())])
    print(f"{len(new_rows)} characters checked, {changed} readings changed. {len(merged)} rows in {path}. "
          "Now run tools/08_pinyin.py again.")


if __name__ == "__main__":
    main()
