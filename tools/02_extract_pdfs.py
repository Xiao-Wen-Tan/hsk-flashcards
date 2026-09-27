"""Step 2. Read the six vocabulary PDFs into entries that keep the raw glyph codes.

Input:   ../HSK 词汇 6本/HSK{1..6} 词汇.pdf (read only, never copied)
Outputs: data/extract/pdf_entries_vNNN.jsonl, one entry per line
         {"file", "n", "page", "head", "latin", "tokens", "skipped"}
         data/extract/seed_cmap_vNNN.csv, codes the footer font already names
Nothing is written unless every file gives exactly the expected number of entries
and the entry numbers missing from each file are exactly the known gaps.
For example, the HSK 4 file has no entry 677, so its entry 678 carries
"skipped": [677] and the file has 1,199 entries instead of 1,200.
"""
import sys
from pathlib import Path

from common import next_versions, write_new_csv, write_new_jsonl
from pdfentries import group_entries, head_of, latin_of
from pdfread import body_runs, seed_table

PDF_DIR = Path("../HSK 词汇 6本")
EXPECTED = {1: 150, 2: 300, 3: 600, 4: 1199, 5: 437, 6: 2623}
KNOWN_GAPS = {4: [677]}  # entry numbers the source PDFs themselves leave out


def main():
    rows, seed, problems = [], {}, []
    for level, expected in EXPECTED.items():
        path = PDF_DIR / f"HSK{level} 词汇.pdf"
        entries = group_entries(body_runs(path))
        seed.update(seed_table(path))
        no_head = [e["n"] for e in entries if not head_of(e)]
        no_latin = [e["n"] for e in entries if not latin_of(e).strip()]
        gaps = sorted(n for e in entries for n in e.get("skipped", []))
        known = KNOWN_GAPS.get(level, [])
        print(f"HSK{level}: {len(entries)} entries (expected {expected}), "
              f"missing headword {len(no_head)}, missing pinyin {len(no_latin)}, "
              f"skipped numbers {gaps} (known {known})")
        if len(entries) != expected:
            last = entries[-1]["n"] if entries else 0
            problems.append(f"HSK{level}: {len(entries)} entries, stopped after entry {last}")
        if gaps != known:
            problems.append(f"HSK{level}: skipped numbers {gaps}, expected {known}")
        if no_head or no_latin:
            problems.append(f"HSK{level}: no headword {no_head[:10]}, no pinyin {no_latin[:10]}")
        for e in entries:
            rows.append({"file": level, "n": e["n"], "page": e["page"],
                         "head": head_of(e), "latin": latin_of(e), "tokens": e["tokens"],
                         "skipped": e.get("skipped", [])})
    if problems:
        sys.exit("Stopped, nothing written:\n  " + "\n  ".join(problems))
    paths = next_versions(entries=("data/extract/pdf_entries", ".jsonl"),
                          seed=("data/extract/seed_cmap", ".csv"))
    write_new_jsonl(paths["entries"], rows)
    write_new_csv(paths["seed"], ["cid", "char"], sorted(seed.items()))
    print(f"Wrote {len(rows)} entries to {paths['entries']} and {len(seed)} free characters to {paths['seed']}")


if __name__ == "__main__":
    main()
