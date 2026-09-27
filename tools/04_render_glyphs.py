"""Step 3b. Draw the glyphs that are still unknown, so they can be identified by eye.

Inputs:  data/decode/unresolved_vNNN.csv, data/decode/cidmap_vNNN.csv, the six PDFs
Outputs: data/decode/sheets_vNNN/sheet_01.png and so on, 100 numbered cells per sheet
         data/decode/sheets_key_vNNN.csv (cell, cid, control, known_char)
About one cell in ten is a glyph that is already known, mixed in unlabelled, to check the eye readings.
"""
import random

from common import latest_version_path, next_versions, read_csv, write_new_csv
from glyphsheets import SHEET_CELLS, draw_sheet, glyph_outlines


def main():
    unresolved = [int(r["cid"]) for r in read_csv(latest_version_path("data/decode/unresolved", ".csv"))]
    known = {int(r["cid"]): r["char"] for r in read_csv(latest_version_path("data/decode/cidmap", ".csv"))
             if r["source"] == "headword"}
    rng = random.Random(7)
    controls = set(rng.sample(sorted(known), max(5, len(unresolved) // 10)))
    cids = unresolved + sorted(controls)
    rng.shuffle(cids)
    outlines = glyph_outlines(set(cids))

    paths = next_versions(sheets=("data/decode/sheets", ""), key=("data/decode/sheets_key", ".csv"))
    paths["sheets"].mkdir()
    cells = list(enumerate(cids, start=1))
    for start in range(0, len(cells), SHEET_CELLS):
        draw_sheet(cells[start:start + SHEET_CELLS], outlines,
                   paths["sheets"] / f"sheet_{start // SHEET_CELLS + 1:02d}.png")
    write_new_csv(paths["key"], ["cell", "cid", "control", "known_char"],
                  [(n, cid, int(cid in controls), known[cid] if cid in controls else "") for n, cid in cells])
    missing = [c for c in cids if c not in outlines]
    sheets = (len(cells) - 1) // SHEET_CELLS + 1
    print(f"{len(unresolved)} unknown and {len(controls)} check glyphs on {sheets} sheets in {paths['sheets']}")
    if missing:
        print(f"No outline found for {len(missing)} codes: {missing[:20]}")


if __name__ == "__main__":
    main()
