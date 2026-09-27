"""Step 3c. Check the eye readings of the glyph sheets and turn them into known characters.

Inputs:  data/decode/sheets_key_vNNN.csv and data/manual/glyph_reads_vNNN.csv with the same NNN.
         The reads file is written by hand with columns cell,char. Use ? for a glyph that cannot be read.
Output:  data/decode/glyph_seed_vNNN.csv with every reading from all rounds whose check glyphs all passed.
If any check glyph was misread, nothing is written.
"""
import sys

from common import all_version_paths, next_version_path, read_csv, write_new_csv
from glyphsheets import check_glyph_reads


def main():
    seed, failures, rounds = {}, [], 0
    reads_by_version = dict(all_version_paths("data/manual/glyph_reads", ".csv"))
    for version, key_path in all_version_paths("data/decode/sheets_key", ".csv"):
        if version not in reads_by_version:
            continue
        rounds += 1
        reads = {int(r["cell"]): r["char"] for r in read_csv(reads_by_version[version])}
        found, bad = check_glyph_reads(read_csv(key_path), reads)
        seed.update(found)
        failures += [f"round {version} cell {cell}: read {got!r}, expected {want!r}" for cell, got, want in bad]
    if not rounds:
        sys.exit("No glyph_reads file matches a sheets_key file yet.")
    if failures:
        sys.exit("Check glyphs misread, nothing written:\n  " + "\n  ".join(failures))
    path = next_version_path("data/decode/glyph_seed", ".csv")
    write_new_csv(path, ["cid", "char"], sorted(seed.items()))
    print(f"{len(seed)} glyphs from {rounds} round(s) -> {path}. Now run tools/03_decode_glyphs.py again.")


if __name__ == "__main__":
    main()
