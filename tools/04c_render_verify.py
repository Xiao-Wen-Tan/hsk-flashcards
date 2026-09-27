"""Step 3d. Draw every decoded glyph next to the character proposed for it, for a visual check.

Inputs:  data/decode/cidmap_vNNN.csv, data/public/hsk_complete_vNNN.json (for radicals), the six PDFs
Outputs: data/decode/verify_vNNN/sheet_01.png and so on, 60 numbered cells per sheet (10 rows of 6)
         data/decode/verify_key_vNNN.csv (cell, cid, shown_char, true_char, planted)
Each cell shows the PDF glyph on the left and a character drawn with a Windows Chinese font on the right.
About 5% of cells are planted errors whose right side shows a different decoded character, one with the
same radical where possible. Readers flag every cell whose two sides are not the same character, and
tools/04d_check_verify.py checks the flags.

Options:
  --source NAME  Draw only the codes whose "source" column in the cidmap is NAME (headword, glyph or
                 footer). Repeat it to keep several, as in --source glyph --source footer.
                 Default: every source.
  --rate FLOAT   Share of cells that are planted errors, from 0 to 1. Default: 0.05.
Codes with no glyph outline in the PDFs are left out, and the script prints how many and which.
"""
import argparse
import random
import sys

from common import latest_version_path, next_versions, read_csv, read_json, write_new_csv
from glyphsheets import (VERIFY_CELLS, choose_planted, draw_verify_sheet, find_cjk_font, glyph_outlines,
                         radical_table, select_codes)

PLANT_RATE = 0.05


def build_parser():
    parser = argparse.ArgumentParser(description="Draw verify sheets for the decoded glyphs.")
    parser.add_argument("--source", action="append", metavar="NAME",
                        help='keep only codes whose cidmap "source" is NAME; repeatable '
                             '(default: all sources)')
    parser.add_argument("--rate", type=float, default=PLANT_RATE,
                        help=f"share of cells that are planted errors, from 0 to 1 (default: {PLANT_RATE})")
    return parser


def main():
    parser = build_parser()
    args = parser.parse_args()
    if not 0 <= args.rate <= 1:
        parser.error(f"--rate must be from 0 to 1, not {args.rate}")
    cidmap = latest_version_path("data/decode/cidmap", ".csv")
    rows = read_csv(cidmap)
    known = sorted({r["source"] for r in rows})
    unknown = sorted(set(args.source or []) - set(known))
    if unknown:
        parser.error(f"{cidmap} has no source named {', '.join(unknown)}. "
                     f"Its sources are {', '.join(known)}.")

    fwd = {int(r["cid"]): r["char"] for r in rows}
    radical_of = radical_table(read_json(latest_version_path("data/public/hsk_complete", ".json")))
    font = find_cjk_font()
    wanted = select_codes(rows, args.source, fwd)  # fwd holds every code, so only the source filter applies
    outlines = glyph_outlines(set(wanted))
    cids = select_codes(rows, args.source, outlines)
    left_out = [c for c in wanted if c not in outlines]
    print(f"Left out {len(left_out)} codes with no glyph outline in the PDFs"
          + (f": {left_out}" if left_out else "."))
    if not cids:
        sys.exit("No code left to draw. Nothing written.")
    planted = choose_planted(cids, fwd, radical_of, args.rate, random.Random(13))

    paths = next_versions(sheets=("data/decode/verify", ""), key=("data/decode/verify_key", ".csv"))
    paths["sheets"].mkdir()
    cells = [(n, cid, planted.get(cid, fwd[cid])) for n, cid in enumerate(cids, start=1)]
    for start in range(0, len(cells), VERIFY_CELLS):
        draw_verify_sheet(cells[start:start + VERIFY_CELLS], outlines, font,
                          paths["sheets"] / f"sheet_{start // VERIFY_CELLS + 1:02d}.png")
    write_new_csv(paths["key"], ["cell", "cid", "shown_char", "true_char", "planted"],
                  [(n, cid, shown, fwd[cid], int(cid in planted)) for n, cid, shown in cells])
    sheets = (len(cells) - 1) // VERIFY_CELLS + 1
    chosen = ", ".join(args.source) if args.source else "all"
    print(f"{len(cells)} decoded codes (sources: {chosen}), {len(planted)} of them planted errors "
          f"(rate {args.rate}), on {sheets} sheets in {paths['sheets']} (right side drawn with {font}). "
          f"Key: {paths['key']}")


if __name__ == "__main__":
    main()
