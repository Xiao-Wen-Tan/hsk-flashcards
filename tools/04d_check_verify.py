"""Step 3e. Check the readers' flags on the verify sheets and list the suspect codes.

Inputs:  the latest data/manual/verify_reads_vNNN.csv and data/decode/verify_key_vNNN.csv with the same NNN.
         The reads file is written by hand with columns cell,flagged_by: one row for each cell that at
         least one reader flagged because its two sides are not the same character.
Output:  data/decode/suspects_vNNN.csv (cid, char), one row for each flagged cell that was not a planted
         error. The next run of tools/03_decode_glyphs.py bans these pairs.
If any planted cell was not flagged, the reading missed a known error and nothing is written.
"""
import sys

from common import all_version_paths, next_version_path, read_csv, write_new_csv
from glyphsheets import check_verify


def main():
    reads = all_version_paths("data/manual/verify_reads", ".csv")
    if not reads:
        sys.exit("No data/manual/verify_reads_vNNN.csv yet. Read the verify sheets first.")
    version, reads_path = reads[-1]
    keys = dict(all_version_paths("data/decode/verify_key", ".csv"))
    if version not in keys:
        sys.exit(f"{reads_path} has no verify_key_v{version:03d}.csv with the same number. Nothing written.")
    key_rows = read_csv(keys[version])
    flagged = {int(r["cell"]) for r in read_csv(reads_path) if r["cell"].strip()}
    unknown = sorted(flagged - {int(r["cell"]) for r in key_rows})
    if unknown:
        sys.exit(f"{reads_path} flags cells that are not on the sheets: {unknown}. Nothing written.")
    missed, suspects = check_verify(key_rows, flagged)
    planted = sum(r["planted"] == "1" for r in key_rows)
    caught = f"Planted errors caught: {planted - len(missed)} of {planted}."
    if missed:
        sys.exit(f"{caught} Missed cells: {missed}. Nothing written. Read those sheets again.")
    path = next_version_path("data/decode/suspects", ".csv")
    write_new_csv(path, ["cid", "char"], suspects)
    print(f"{caught} {len(suspects)} suspect codes -> {path}. Now run tools/03_decode_glyphs.py again.")


if __name__ == "__main__":
    main()
