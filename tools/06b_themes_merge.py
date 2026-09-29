"""Step 6b. Check the batch agents' theme choices and write the review spreadsheet.

Inputs:  data/build/theme_batches_vNNN/ (latest) and the answers in data/claude/themes_vNNN/
         (for each batch_KKK.csv the latest batch_KKK_vMMM.csv, and the latest check_vMMM.csv)
Outputs: data/review/themes_review_vRRR.csv  one row per word, sorted by theme then level, opens in Excel
         data/review/theme_list_vRRR.csv     the 30 themes with their order, names and word counts
         data/reports/themes_vRRR.txt        theme sizes, flags and the second-opinion agreement
Nothing is written while any batch is missing or has problems; the batches to redo are listed.
"""
import sys
from collections import Counter
from pathlib import Path

from common import (all_version_paths, latest_version_path, next_versions, read_csv, read_jsonl, write_new_csv,
                    write_new_text)
from themes import MAX_THEME, MIN_THEME, STARTER_NO, THEMES, check_output, second_opinion_flags

REVIEW_COLUMNS = ["id", "hz", "py", "lv", "en", "theme_no", "theme_name", "confidence", "flag",
                  "alt_theme_no", "second_opinion", "note"]


def latest_answer(folder, stem):
    found = all_version_paths(folder / stem, ".csv")
    return read_csv(found[-1][1]) if found else None


def main():
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    batches = latest_version_path("data/build/theme_batches", "")
    answers = Path("data/claude") / batches.name.replace("theme_batches", "themes")
    chosen, problems, redo = {}, [], []
    for batch in sorted(batches.glob("batch_*.csv")):
        rows = latest_answer(answers, batch.stem)
        found = check_output(read_csv(batch), rows) if rows is not None else ["no answer file"]
        if found:
            redo.append(batch.stem)
            problems += [f"{batch.stem}: {p}" for p in found[:10]]
            continue
        chosen.update({r["id"]: r for r in rows})
    sample = read_csv(batches / "check_sample.csv")
    second_rows = latest_answer(answers, "check")
    found = check_output(sample, second_rows) if second_rows is not None else ["no answer file"]
    if found:
        redo.append("check")
        problems += [f"check: {p}" for p in found[:10]]
    if problems:
        sys.exit("Stopped, nothing written. Redo these batches: " + " ".join(redo) + "\n  " + "\n  ".join(problems))

    for r in read_csv(batches / "starter.csv"):
        chosen[r["id"]] = {"id": r["id"], "theme_no": str(STARTER_NO), "confidence": "H", "alt_theme_no": "",
                           "note": "Starter Kit rule"}
    missing = sorted(set(words) - set(chosen))
    if missing:
        sys.exit(f"Stopped, nothing written. {len(missing)} words are in no batch, for example {missing[:5]}.")
    main_choice = {rid: (r["theme_no"].strip(), r["alt_theme_no"].strip()) for rid, r in chosen.items()}
    flags = second_opinion_flags(main_choice, {r["id"]: (r["theme_no"].strip(), r["alt_theme_no"].strip())
                                               for r in second_rows})
    rows = []
    for rid, r in chosen.items():
        w, no = words[rid], int(r["theme_no"])
        conf = r["confidence"].strip()
        flag = "CHECK" if conf == "L" or rid in flags else ""
        rows.append([rid, w["hz"], w["py"], w["lv"], w["en"], no, THEMES[no - 1], conf, flag,
                     r["alt_theme_no"].strip(), flags.get(rid, ""), r.get("note", "").strip()])
    rows.sort(key=lambda row: (row[5], row[3], words[row[0]]["freq"], row[0]))
    sizes = Counter(row[5] for row in rows)

    paths = next_versions(review=("data/review/themes_review", ".csv"), themes=("data/review/theme_list", ".csv"),
                          report=("data/reports/themes", ".txt"))
    write_new_csv(paths["review"], REVIEW_COLUMNS, rows, excel=True)
    write_new_csv(paths["themes"], ["theme_no", "order", "name", "words"],
                  [[n, n, name, sizes.get(n, 0)] for n, name in enumerate(THEMES, start=1)], excel=True)
    agree = len(second_rows) - len(flags)
    conf = Counter(row[7] for row in rows)
    lines = ["Theme report", "",
             f"Words: {len(rows)}. Confidence: H {conf['H']}, M {conf['M']}, L {conf['L']}.",
             f"Second opinion: agrees on {agree} of {len(second_rows)} sampled words "
             f"({100 * agree / len(second_rows):.0f}%).",
             f"Rows flagged CHECK (low confidence or a second-opinion disagreement): "
             f"{sum(1 for row in rows if row[8])}", "", "Theme sizes (limits: at least 40, at most 350 per part):"]
    for n, name in enumerate(THEMES, start=1):
        size = sizes.get(n, 0)
        note = (f"  will be split into {-(-size // MAX_THEME)} parts" if size > MAX_THEME
                else "  below 40" if size < MIN_THEME else "")
        lines.append(f"  {n:2d}. {name}: {size}{note}")
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"Review sheet: {paths['review']}. Theme list: {paths['themes']}. Report: {paths['report']}")


if __name__ == "__main__":
    main()
