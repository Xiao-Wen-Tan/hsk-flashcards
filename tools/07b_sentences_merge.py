"""Step 7b. Check the written sentences and the translations, then pick the sample for the checker.

Inputs:  the latest data/build/sentence_batches_vNNN/ and translation_batches_vNNN/, the matching
         data/build/sentences_pdf_vNNN.jsonl, and the agents' answers in data/claude/sentences_vNNN/ and
         data/claude/translations_vNNN/ (for each batch_KKK.csv, the latest batch_KKK_vMMM.csv)
Outputs: data/build/sentences_en_vRRR.jsonl  {id, word, sentence, en, src, batch} for every word
         data/build/check_batches_vRRR/batch_001.csv  the checker's sample, 120 rows per file
                                            (id, word, word_py, word_en, sentence, en, src)
         data/reports/sentences_merge_vRRR.txt
When any batch has problems, only the report is written. It lists every problem by batch,
and those batches are redone by a new batch agent.
"""
import random
import sys
from pathlib import Path

from common import (all_version_paths, latest_version_path, next_version_path, next_versions, read_csv, read_jsonl,
                    write_new_csv, write_new_jsonl, write_new_text)
from sentences import char_levels, check_answers, english_problems, written_problems
from themes import chunks

CHECK_BATCH = 120


def answers_for(folder, batch):
    found = all_version_paths(folder / batch.stem, ".csv")
    return read_csv(found[-1][1]) if found else None


def main():
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    levels = char_levels(list(words.values()))
    write_dir = latest_version_path("data/build/sentence_batches", "")
    version = write_dir.name.rsplit("_", 1)[1]
    translate_dir = Path(f"data/build/translation_batches_{version}")
    pdf = {r["id"]: r for r in read_jsonl(f"data/build/sentences_pdf_{version}.jsonl")}

    def written_rule(given, answer):
        return written_problems(answer.get("sentence") or "", words[given["id"]], levels) + \
            english_problems(answer.get("en"))

    rows, problems = [], {}
    for kind, folder, key, rule in (("sentences", write_dir, "hz", written_rule),
                                    ("translations", translate_dir, "sentence",
                                     lambda given, answer: english_problems(answer.get("en")))):
        answers_dir = Path("data/claude") / f"{kind}_{version}"
        for batch in sorted(folder.glob("batch_*.csv")):
            answers = answers_for(answers_dir, batch)
            if answers is None:
                problems[f"{kind}/{batch.stem}"] = ["no answer file"]
                continue
            found, got = check_answers(read_csv(batch), answers, key, rule)
            if found:
                problems[f"{kind}/{batch.stem}"] = found
                continue
            for rid, a in got.items():
                sentence = a["sentence"].strip() if kind == "sentences" else pdf[rid]["sentence"]
                rows.append({"id": rid, "word": words[rid]["hz"], "sentence": sentence, "en": a["en"].strip(),
                             "src": "claude" if kind == "sentences" else "pdf", "batch": f"{kind}/{batch.stem}"})
    if problems:
        path = next_version_path("data/reports/sentences_merge", ".txt")
        lines = [f"Stopped. Redo these {len(problems)} batches:"]
        for batch, found in problems.items():
            lines += ["", f"{batch}:"] + [f"  {p}" for p in found]
        write_new_text(path, "\n".join(lines) + "\n")
        sys.exit(f"Stopped, only the problem list was written to {path}. Batches to redo: " + " ".join(problems))
    missing = sorted(set(words) - {r["id"] for r in rows})
    if missing:
        sys.exit(f"Stopped, nothing written. {len(missing)} words have no sentence, for example {missing[:5]}.")

    rng = random.Random(11)
    written = [r for r in rows if r["src"] == "claude"]
    translated = [r for r in rows if r["src"] == "pdf"]
    sample = rng.sample(written, max(50, len(written) // 10)) + rng.sample(translated, max(100, len(translated) // 33))
    rows.sort(key=lambda r: r["id"])
    paths = next_versions(rows=("data/build/sentences_en", ".jsonl"), check=("data/build/check_batches", ""),
                          report=("data/reports/sentences_merge", ".txt"))
    write_new_jsonl(paths["rows"], rows)
    paths["check"].mkdir()
    for n, part in enumerate(chunks(sorted(sample, key=lambda r: r["id"]), CHECK_BATCH), start=1):
        write_new_csv(paths["check"] / f"batch_{n:03d}.csv",
                      ["id", "word", "word_py", "word_en", "sentence", "en", "src"],
                      [[r["id"], r["word"], words[r["id"]]["py"], words[r["id"]]["en"], r["sentence"], r["en"],
                        r["src"]] for r in part])
    lines = ["Sentence merge report", "",
             f"Sentences: {len(rows)} ({len(written)} written, {len(translated)} from the PDFs)",
             f"Checker sample: {len(sample)} rows in {paths['check']}", ""]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
