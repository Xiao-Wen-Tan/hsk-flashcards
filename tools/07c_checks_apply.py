"""Step 7c. Apply the independent checker's verdicts and write the user's spot-check sheet.

Inputs:  the latest data/build/sentences_en_vRRR.jsonl, data/build/check_batches_vRRR/ and the checker's
         answers in data/claude/checks_vRRR/ (for each batch_KKK.csv the latest batch_KKK_vMMM.csv,
         columns id, sentence, verdict, problem, fixed_sentence, fixed_en)
Outputs: data/build/sentences_checked_vCCC.jsonl  every sentence with the checker's fixes applied
         data/review/translation_spotcheck_vCCC.csv  50 random translations for the user (opens in Excel)
         data/reports/checks_vCCC.txt
Nothing is written if an answer is missing or malformed, if a batch needed two or more fixes in
the sample (it is redone), or if more than 10% of either kind of sampled row needed a fix
(the user decides what happens next).
"""
import random
import sys
from pathlib import Path

from common import (all_version_paths, latest_version_path, next_versions, read_csv, read_jsonl, write_new_csv,
                    write_new_jsonl, write_new_text)
from sentences import char_levels, check_answers, fix_share, redo_batches, verdict_problems

SPOTCHECK_SIZE = 50
MAX_SHARE = 0.10


def main():
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    levels = char_levels(list(words.values()))
    rows_path = latest_version_path("data/build/sentences_en", ".jsonl")
    version = rows_path.stem.rsplit("_", 1)[1]
    rows = {r["id"]: r for r in read_jsonl(rows_path)}
    answers_dir = Path("data/claude") / f"checks_{version}"
    problems, verdicts, sample = [], {}, []
    for batch in sorted(Path(f"data/build/check_batches_{version}").glob("batch_*.csv")):
        given = read_csv(batch)
        sample += [rows[r["id"]] for r in given]
        found = all_version_paths(answers_dir / batch.stem, ".csv")
        if not found:
            problems.append(f"{batch.stem}: no answer file")
            continue
        more, got = check_answers(given, read_csv(found[-1][1]), "sentence",
                                  lambda g, a: verdict_problems(g, a, words[g["id"]], levels))
        problems += [f"{batch.stem}: {p}" for p in more]
        verdicts.update(got)
    if problems:
        sys.exit("Stopped, nothing written:\n  " + "\n  ".join(problems[:40]))
    fixed = {rid for rid, a in verdicts.items() if a["verdict"].strip() == "FIX"}
    redo = redo_batches(sample, fixed)
    shares = {src: fix_share(sample, fixed, src) for src in ("claude", "pdf")}
    if redo:
        sys.exit("Stopped, nothing written. Redo these batches with a new batch agent, then rerun step 7b: "
                 + " ".join(redo))
    if max(shares.values()) > MAX_SHARE:
        sys.exit(f"Stopped, nothing written. Fix share in the sample: written {shares['claude']:.0%}, "
                 f"translated {shares['pdf']:.0%}, above {MAX_SHARE:.0%}. Ask the user how to proceed.")

    for rid in fixed:
        a, r = verdicts[rid], rows[rid]
        r["en"] = a["fixed_en"].strip()
        if (a.get("fixed_sentence") or "").strip():
            r["sentence"], r["src"] = a["fixed_sentence"].strip(), "claude"
    final = [rows[rid] for rid in sorted(rows)]
    spot = sorted(random.Random(13).sample(final, SPOTCHECK_SIZE), key=lambda r: r["id"])
    paths = next_versions(rows=("data/build/sentences_checked", ".jsonl"),
                          spot=("data/review/translation_spotcheck", ".csv"), report=("data/reports/checks", ".txt"))
    write_new_jsonl(paths["rows"], final)
    write_new_csv(paths["spot"], ["id", "word", "sentence", "en", "ok", "better_en"],
                  [[r["id"], r["word"], r["sentence"], r["en"], "", ""] for r in spot], excel=True)
    lines = ["Checker report", "", f"Sampled rows: {len(sample)}. Fixed: {len(fixed)}.",
             f"Fix share: written sentences {shares['claude']:.0%}, PDF translations {shares['pdf']:.0%}.",
             f"Spot-check sheet for the user: {paths['spot']}", ""]
    lines += [f"  {rid} {rows[rid]['word']}: {verdicts[rid].get('problem', '').strip()}" for rid in sorted(fixed)]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
