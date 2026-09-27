"""Step 3d. Draw every decoded glyph next to the character proposed for it, for a visual check.

Inputs:  data/decode/cidmap_vNNN.csv, data/public/hsk_complete_vNNN.json (for radicals), the six PDFs
Outputs: data/decode/verify_vNNN/sheet_01.png and so on, 60 numbered cells per sheet (10 rows of 6)
         data/decode/verify_key_vNNN.csv (cell, cid, shown_char, true_char, planted)
Each cell shows the PDF glyph on the left and a character drawn with a Windows Chinese font on the right.
About 5% of cells are planted errors whose right side shows a different decoded character, one with the
same radical where possible. Readers flag every cell whose two sides are not the same character, and
tools/04d_check_verify.py checks the flags.
"""
import random

from common import latest_version_path, next_versions, read_csv, read_json, write_new_csv
from glyphsheets import VERIFY_CELLS, choose_planted, draw_verify_sheet, find_cjk_font, glyph_outlines, radical_table

PLANT_RATE = 0.05


def main():
    fwd = {int(r["cid"]): r["char"] for r in read_csv(latest_version_path("data/decode/cidmap", ".csv"))}
    radical_of = radical_table(read_json(latest_version_path("data/public/hsk_complete", ".json")))
    font = find_cjk_font()
    cids = sorted(fwd)
    planted = choose_planted(cids, fwd, radical_of, PLANT_RATE, random.Random(13))
    outlines = glyph_outlines(set(cids))

    paths = next_versions(sheets=("data/decode/verify", ""), key=("data/decode/verify_key", ".csv"))
    paths["sheets"].mkdir()
    cells = [(n, cid, planted.get(cid, fwd[cid])) for n, cid in enumerate(cids, start=1)]
    for start in range(0, len(cells), VERIFY_CELLS):
        draw_verify_sheet(cells[start:start + VERIFY_CELLS], outlines, font,
                          paths["sheets"] / f"sheet_{start // VERIFY_CELLS + 1:02d}.png")
    write_new_csv(paths["key"], ["cell", "cid", "shown_char", "true_char", "planted"],
                  [(n, cid, shown, fwd[cid], int(cid in planted)) for n, cid, shown in cells])
    missing = [c for c in cids if c not in outlines]
    sheets = (len(cells) - 1) // VERIFY_CELLS + 1
    print(f"{len(cells)} decoded codes, {len(planted)} of them planted errors, on {sheets} sheets in "
          f"{paths['sheets']} (right side drawn with {font}). Key: {paths['key']}")
    if missing:
        print(f"No outline found for {len(missing)} codes: {missing[:20]}")


if __name__ == "__main__":
    main()
