"""Step 7d. Apply the user's spot-check of 50 translations.

Inputs:  data/build/sentences_checked_vCCC.jsonl (latest) and data/review/translation_spotcheck_vCCC.csv
         (the sheet step 7c wrote in the same run, so the same CCC), and
         data/manual/translation_spotcheck_reviewed_vNNN.csv (latest), the user's copy of that sheet
         with ok = Y or N and better_en for every N. Its number need not match CCC, so a corrected
         copy saved as the next version is used as it is.
Outputs: data/build/sentences_final_vFFF.jsonl {id, sentence, en, src}, data/reports/spotcheck_vFFF.txt
Nothing is written if a row of the sheet is missing, repeated or unanswered, if an N row has no
usable better_en, or if more than 5 of the 50 translations were marked N (then the user decides
whether to redo translations).
"""
import sys

from common import latest_version_path, next_versions, read_csv, read_jsonl, write_new_jsonl, write_new_text
from sentences import spotcheck_problems

MAX_WRONG = 5


def main():
    checked_path = latest_version_path("data/build/sentences_checked", ".jsonl")
    version = checked_path.stem.rsplit("_", 1)[1]
    rows = {r["id"]: r for r in read_jsonl(checked_path)}
    generated = read_csv(f"data/review/translation_spotcheck_{version}.csv")
    reviewed_path = latest_version_path("data/manual/translation_spotcheck_reviewed", ".csv")
    try:
        reviewed = read_csv(reviewed_path)
    except UnicodeDecodeError:
        sys.exit(f"{reviewed_path} is not UTF-8. In Excel use Save As, 'CSV UTF-8 (Comma delimited)'.")
    problems, wrong = spotcheck_problems(generated, reviewed)
    if problems:
        sys.exit(f"Stopped, nothing written. {reviewed_path} compared with "
                 f"data/review/translation_spotcheck_{version}.csv:\n  " + "\n  ".join(problems))
    if len(wrong) > MAX_WRONG:
        sys.exit(f"Stopped, nothing written. {len(wrong)} of {len(reviewed)} translations were marked N, more "
                 f"than {MAX_WRONG}. Ask the user whether to redo the translation batches.")
    for rid, better in wrong:
        rows[rid]["en"] = better
    paths = next_versions(rows=("data/build/sentences_final", ".jsonl"), report=("data/reports/spotcheck", ".txt"))
    write_new_jsonl(paths["rows"], [{k: rows[rid][k] for k in ("id", "sentence", "en", "src")} for rid in sorted(rows)])
    lines = ["Spot-check report", "", f"Sheet used: {reviewed_path}",
             f"Reviewed: {len(reviewed)}. Marked N and corrected: {len(wrong)}.", ""]
    lines += [f"  {rid}: {better}" for rid, better in wrong]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
