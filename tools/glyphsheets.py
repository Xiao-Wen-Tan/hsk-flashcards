"""Draw the PDFs' Chinese glyphs as numbered picture sheets, and check what readers wrote about them.

Two kinds of sheet:
- Unknown-glyph sheets (tools/04_render_glyphs.py). Each cell shows one glyph that is still unknown,
  with some already-known "control" glyphs mixed in. Readers write down the character they see, and
  check_glyph_reads() tests the readings against the controls.
- Verify sheets (tools/04c_render_verify.py). Each cell shows a decoded glyph from the PDF on the left
  and the character the decoder proposes for it on the right, drawn with a Windows Chinese font. About
  5% of cells are planted errors whose right side is deliberately wrong. Readers flag every cell whose
  two sides differ, and check_verify() tests the flags against the planted cells.

Glyph shapes come from the Chinese font embedded in the PDFs. It is a CFF font with 1000 units per
character box, and each glyph is named after its code, so code 4541 is the glyph "cid04541".
"""
import hashlib
import io
import logging
from collections import defaultdict
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pypdf
from fontTools.cffLib import CFFFontSet
from fontTools.pens.basePen import BasePen
from matplotlib import font_manager
from matplotlib.patches import PathPatch, Rectangle
from matplotlib.path import Path as MplPath
from matplotlib.textpath import TextPath

logging.getLogger("pypdf").setLevel(logging.ERROR)

PDF_DIR = Path("../HSK 词汇 6本")
PDF_PATHS = [PDF_DIR / f"HSK{level} 词汇.pdf" for level in range(1, 7)]
PDF_FONT = "PingFangSC-Regular"  # the embedded font that draws the entry text's Chinese

SHEET_CELLS = 100  # unknown-glyph sheets: 10 rows of 10 cells

# Verify sheets: 10 rows of 6 cells. Lengths inside a cell are in font units (1000 per character box).
VERIFY_ROWS, VERIFY_COLS = 10, 6
VERIFY_CELLS = VERIFY_ROWS * VERIFY_COLS
PX_PER_EM = 110               # pixels per 1000 font units, so a full-height character is about 95 px tall
_DPI = 100
_BOX_BOTTOM = -120            # a character box runs from y = -120 to 880, with the baseline at y = 0
_RIGHT_X = 1120               # the proposed character's box starts here; the PDF glyph's box starts at 0
_DIVIDER_X = 1060             # halfway between the two boxes
_XLIM, _YLIM = (-30, 2150), (-150, 900)
_LABEL_PX, _GAP_PX, _MARGIN_PX = 24, 24, 12

CJK_FAMILIES = ("Microsoft YaHei", "DengXian", "SimHei")


class MplPen(BasePen):
    """Collects a glyph outline as a matplotlib path."""

    def __init__(self):
        super().__init__(None)
        self.verts, self.codes = [], []

    def _moveTo(self, p):
        self.verts.append(p)
        self.codes.append(MplPath.MOVETO)

    def _lineTo(self, p):
        self.verts.append(p)
        self.codes.append(MplPath.LINETO)

    def _curveToOne(self, p1, p2, p3):
        self.verts += [p1, p2, p3]
        self.codes += [MplPath.CURVE4] * 3

    def _closePath(self):
        self.verts.append((0, 0))
        self.codes.append(MplPath.CLOSEPOLY)


def glyph_outlines(wanted, pdf_paths=None):
    """{code: matplotlib path} for each wanted code found in the Chinese font embedded in the PDFs.

    Every page embeds only the glyphs it uses, so pages are searched until each code is found.
    Pages that embed an identical font are decoded once. Codes with no drawable outline are left out.
    """
    wanted = set(wanted)
    found, seen = {}, set()
    for pdf in PDF_PATHS if pdf_paths is None else pdf_paths:
        reader = pypdf.PdfReader(pdf)
        for page in reader.pages:
            for f in page["/Resources"]["/Font"].values():
                f = f.get_object()
                if str(f.get("/BaseFont", "")).lstrip("/").split("+")[-1] != PDF_FONT:
                    continue
                desc = f["/DescendantFonts"][0].get_object()["/FontDescriptor"].get_object()
                data = desc["/FontFile3"].get_object().get_data()
                digest = hashlib.sha1(data).hexdigest()
                if digest in seen:
                    continue
                seen.add(digest)
                fonts = CFFFontSet()
                fonts.decompile(io.BytesIO(data), None)
                glyphs = fonts[fonts.fontNames[0]].CharStrings
                for cid in wanted - found.keys():
                    name = f"cid{cid:05d}"
                    if name in glyphs:
                        pen = MplPen()
                        glyphs[name].draw(pen)
                        if pen.codes:
                            found[cid] = MplPath(pen.verts, pen.codes)
            if len(found) == len(wanted):
                return found
    return found


def _draw_glyph_box(ax, cid, outlines, x=0):
    """The PDF glyph inside its grey 1000-unit character box, whose left edge is at x."""
    ax.add_patch(Rectangle((x, _BOX_BOTTOM), 1000, 1000, fill=False, lw=0.5, ec="#bbbbbb"))
    if cid in outlines:
        ax.add_patch(PathPatch(outlines[cid], fc="black", ec="none"))
    else:
        ax.text(x + 500, 380, "no outline", ha="center", va="center", fontsize=6)


def draw_sheet(cells, outlines, path):
    """Unknown-glyph sheet. cells: list of (cell_number, cid), at most 100, drawn 10 by 10.

    Each glyph sits inside its grey 1000-unit character box, with the cell number above it.
    """
    fig, axes = plt.subplots(10, 10, figsize=(10, 11))
    for ax in axes.flat:
        ax.set_axis_off()
    for ax, (cell, cid) in zip(axes.flat, cells):
        _draw_glyph_box(ax, cid, outlines)
        ax.set_xlim(-20, 1020)
        ax.set_ylim(-140, 900)
        ax.set_aspect("equal")
        ax.set_title(str(cell), fontsize=8, pad=1)
    fig.tight_layout(pad=0.3)
    fig.savefig(path, dpi=110)
    plt.close(fig)


def find_cjk_font(families=CJK_FAMILIES):
    """File path of the first installed Chinese font among `families`, looked up by family name.

    matplotlib's font manager finds the file, so no path is written into the code. On Windows,
    "Microsoft YaHei" usually resolves to the fonts folder's msyh.ttc.
    """
    for family in families:
        try:
            return font_manager.findfont(font_manager.FontProperties(family=family), fallback_to_default=False)
        except ValueError:
            continue
    raise RuntimeError(f"None of these Chinese fonts is installed: {', '.join(families)}")


def draw_verify_sheet(cells, outlines, font_path, path):
    """Verify sheet. cells: list of (cell_number, cid, shown_char), at most 60, drawn 10 rows by 6 columns.

    Each cell has its number on top, the PDF glyph in its grey character box on the left, a thin divider,
    and shown_char drawn with the font file `font_path` in a matching box on the right. Both sides use a
    1000-unit character box (TextPath at size 1000 makes the font's box 1000 units, like the PDF font's),
    so the two characters come out the same size. Positions are fixed in pixels: PX_PER_EM pixels per
    character box, so 爱, which fills about 900 of the 1000 units, is about 99 pixels tall.
    """
    scale = PX_PER_EM / 1000
    ax_w, ax_h = (_XLIM[1] - _XLIM[0]) * scale, (_YLIM[1] - _YLIM[0]) * scale
    fig_w = 2 * _MARGIN_PX + VERIFY_COLS * ax_w + (VERIFY_COLS - 1) * _GAP_PX
    fig_h = 2 * _MARGIN_PX + VERIFY_ROWS * (ax_h + _LABEL_PX)
    fig = plt.figure(figsize=(fig_w / _DPI, fig_h / _DPI), dpi=_DPI)
    prop = font_manager.FontProperties(fname=font_path)
    for i, (cell, cid, char) in enumerate(cells):
        row, col = divmod(i, VERIFY_COLS)
        left = _MARGIN_PX + col * (ax_w + _GAP_PX)
        bottom = fig_h - _MARGIN_PX - (row + 1) * (ax_h + _LABEL_PX)
        ax = fig.add_axes([left / fig_w, bottom / fig_h, ax_w / fig_w, ax_h / fig_h])
        ax.set_axis_off()
        ax.set_xlim(*_XLIM)
        ax.set_ylim(*_YLIM)
        _draw_glyph_box(ax, cid, outlines)
        ax.plot([_DIVIDER_X, _DIVIDER_X], [_BOX_BOTTOM, _BOX_BOTTOM + 1000], lw=0.8, color="#888888")
        ax.add_patch(Rectangle((_RIGHT_X, _BOX_BOTTOM), 1000, 1000, fill=False, lw=0.5, ec="#bbbbbb"))
        ax.add_patch(PathPatch(TextPath((_RIGHT_X, 0), char, size=1000, prop=prop), fc="black", ec="none"))
        ax.set_title(str(cell), fontsize=10, pad=2)
    fig.savefig(path, dpi=_DPI)
    plt.close(fig)


def radical_table(words):
    """{character: radical} from the complete public list's single-character words.

    For example, [{"simplified": "妈", "radical": "女"}, {"simplified": "妈妈", "radical": "女"}]
    gives {"妈": "女"}.
    """
    table = {}
    for w in words:
        if len(w["simplified"]) == 1 and w.get("radical"):
            table.setdefault(w["simplified"], w["radical"])
    return table


def select_codes(rows, sources, has_outline):
    """The codes to draw on the verify sheets, as a list of numbers in increasing order.

    rows: rows of cidmap_vNNN.csv (cid, char, source), as read from the file.
    sources: the "source" names to keep, such as ["glyph"]. None or an empty list keeps every source.
    has_outline: the codes that have a glyph outline in the PDFs, for example the dict glyph_outlines()
    returns. A code not in it is left out. For example, with rows for code 9 (headword), 821 (glyph) and
    4541 (glyph), sources ["glyph"] and outlines for 9 and 821 only, the result is [821].
    """
    return sorted(int(r["cid"]) for r in rows
                  if (not sources or r["source"] in sources) and int(r["cid"]) in has_outline)


def choose_planted(cids, fwd, radical_of, rate, rng):
    """Pick about `rate` of the cells to show a wrong character. Returns {cid: shown_char}.

    cids: the codes on the sheets. fwd: the decoded map {cid: char}. radical_of: {char: radical}.
    rng: a random.Random, so a seeded rng gives the same choice every run.
    The shown character is always another decoded character, never the true one. One with the same
    radical is preferred, because it looks most alike. With 妈 decoded, the cell might show 好 or 她
    (radical 女). A character with no radical, such as 。, shows any other decoded character.
    At least one cell is planted whenever there are cells and rate > 0.
    """
    cids = list(cids)
    if not cids or rate <= 0:
        return {}
    count = min(len(cids), max(1, round(rate * len(cids))))
    chars = sorted(set(fwd.values()))  # sorted, because set order changes between runs
    by_radical = defaultdict(list)
    for ch in chars:
        if radical_of.get(ch):
            by_radical[radical_of[ch]].append(ch)
    planted = {}
    for cid in rng.sample(cids, count):
        true = fwd[cid]
        same = [ch for ch in by_radical.get(radical_of.get(true), []) if ch != true]
        pool = same or [ch for ch in chars if ch != true]
        if pool:
            planted[cid] = rng.choice(pool)
    return planted


def check_glyph_reads(key_rows, reads):
    """Check one round of unknown-glyph readings against its control glyphs.

    key_rows: rows of sheets_key_vNNN.csv (cell, cid, control, known_char), as read from the file.
    reads: {cell_number: char} from the hand-written glyph_reads_vNNN.csv. "?" means unreadable.
    Returns (seed, failures). seed is {cid: char} for every non-control cell with a reading other
    than "?" or blank. failures lists (cell, read, expected) for each control cell whose reading is
    not exactly its known character; a missing or "?" reading of a control is a failure too.
    """
    seed, failures = {}, []
    for row in key_rows:
        cell, cid = int(row["cell"]), int(row["cid"])
        char = reads.get(cell, "?").strip()
        if str(row["control"]) == "1":
            if char != row["known_char"]:
                failures.append((cell, char, row["known_char"]))
        elif char and char != "?":
            seed[cid] = char
    return seed, failures


def check_verify(key_rows, flagged_cells):
    """Compare the readers' flags on the verify sheets with the verify key.

    key_rows: rows of verify_key_vNNN.csv (cell, cid, shown_char, true_char, planted), as read from the file.
    flagged_cells: the cell numbers that at least one reader flagged as "the two sides differ".
    Returns (missed, suspects). missed lists the planted cells nobody flagged. suspects lists
    (cid, true_char) for the flagged cells that were not planted, whose decoded character may be wrong.
    For example, with cells 2 and 4 planted and flags {2, 3}, missed is [4] and suspects holds cell 3's
    cid and character.
    """
    flagged = {int(c) for c in flagged_cells}
    missed, suspects = [], []
    for row in key_rows:
        cell = int(row["cell"])
        if str(row["planted"]) == "1":
            if cell not in flagged:
                missed.append(cell)
        elif cell in flagged:
            suspects.append((int(row["cid"]), row["true_char"]))
    return sorted(missed), sorted(suspects)
