"""Step 5b. Turn the form agents' answers into a new data/manual/four_char_words file.

Step 5 (for card headwords) and Plan 3b's step 8 (for sentence words) write the batch files when
four-character words still need a form. This step is run after either of them.
Inputs:  the latest data/build/four_char_batches_vNNN/ and the answers in data/claude/four_char_vNNN/
         (for each batch_KKK.csv the latest batch_KKK_vMMM.csv; columns hz, form, words),
         and the latest data/manual/four_char_words_vFFF.csv if one exists
Output:  data/manual/four_char_words_vFFF.csv (next version; hz, form, words, where) holding every
         earlier row plus one row per answered word
Nothing is written while an answer file is missing or has problems.
"""
import sys
from pathlib import Path

from common import all_version_paths, latest_version_path, next_version_path, read_csv, write_new_csv
from pinyin_text import check_form_answers


def main():
    folder = latest_version_path("data/build/four_char_batches", "")
    answers_dir = Path("data/claude") / folder.name.replace("four_char_batches", "four_char")
    problems, new_rows = [], []
    for batch in sorted(folder.glob("batch_*.csv")):
        found = all_version_paths(answers_dir / batch.stem, ".csv")
        if not found:
            problems.append(f"{batch.stem}: no answer file")
            continue
        given = read_csv(batch)
        more, rows = check_form_answers(given, read_csv(found[-1][1]))
        problems += [f"{batch.stem}: {p}" for p in more]
        where = {r["hz"]: r["where"] for r in given}
        new_rows += [row + [where[row[0]]] for row in rows]
    if problems:
        sys.exit("Stopped, nothing written. Redo these answers:\n  " + "\n  ".join(problems[:40]))
    earlier = all_version_paths("data/manual/four_char_words", ".csv")
    merged = {r["hz"]: [r["hz"], r["form"], r["words"], r["where"]] for r in
              (read_csv(earlier[-1][1]) if earlier else [])}
    for row in new_rows:
        merged[row[0]] = row
    path = next_version_path("data/manual/four_char_words", ".csv")
    write_new_csv(path, ["hz", "form", "words", "where"], list(merged.values()))
    counts = {form: sum(1 for r in new_rows if r[1] == form) for form in ("idiom", "words", "joined")}
    print(f"{len(new_rows)} words answered: {counts['idiom']} idiom, {counts['words']} words, "
          f"{counts['joined']} joined. {len(merged)} rows in {path}.")


if __name__ == "__main__":
    main()
