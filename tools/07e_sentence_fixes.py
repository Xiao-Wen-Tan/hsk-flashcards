"""Step 7e. Apply the user's approved text fixes to the final sentences.

Inputs:  data/build/sentences_final_vFFF.jsonl and data/manual/sentence_fixes_vNNN.csv (latest; columns id,
         old, new, note, where old is the sentence as it stands and new the fixed text)
Output:  data/build/sentences_final_vFFF.jsonl, the next version
Nothing is written when a fix names an unknown id, its old text differs from the final file, or new equals old.
After this step, rerun step 8 (Task 11 Step 2), Task 14 from Step 2 (only the changed sentences go to the
agents) and step 9 (Task 16 Step 4, which makes only the changed sound files).
On 2026-09-30 the user approved removing the stray space that the PDF text left inside three numbers
("1 2小时" becomes "12小时").
"""
import sys

from common import latest_version_path, next_version_path, read_csv, read_jsonl, write_new_jsonl


def main():
    final_path = latest_version_path("data/build/sentences_final", ".jsonl")
    fixes_path = latest_version_path("data/manual/sentence_fixes", ".csv")
    rows = {r["id"]: r for r in read_jsonl(final_path)}
    problems, done = [], []
    for fix in read_csv(fixes_path):
        rid, old, new = fix["id"], fix["old"], fix["new"]
        row = rows.get(rid)
        if row is None:
            problems.append(f"{rid}: not in {final_path}")
        elif row["sentence"] != old:
            problems.append(f"{rid}: the old text differs from {final_path}: {row['sentence']}")
        elif new == old:
            problems.append(f"{rid}: new equals old")
        else:
            done.append((rid, old, new))
    if problems:
        sys.exit("Stopped, nothing written:\n  " + "\n  ".join(problems))
    for rid, _, new in done:
        rows[rid] = {**rows[rid], "sentence": new}
    path = next_version_path("data/build/sentences_final", ".jsonl")
    write_new_jsonl(path, list(rows.values()))
    print(f"{len(done)} sentences fixed from {fixes_path}. Final sentences: {path}")
    for rid, old, new in done:
        print(f"  {rid}: {old} -> {new}")


if __name__ == "__main__":
    main()
