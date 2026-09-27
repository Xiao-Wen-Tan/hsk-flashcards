"""Low-level reading of the vocabulary PDFs.

The Chinese text uses a font with no character table, so we keep its raw glyph
codes (CIDs) instead of text. Latin text (pinyin, English) is decoded normally.
"""
import logging
import re
from dataclasses import dataclass, field

import pypdf
from pypdf.generic import ByteStringObject, ContentStream, TextStringObject

logging.getLogger("pypdf").setLevel(logging.ERROR)

BODY_FONTS = {"ArialMT", "PingFangSC-Regular"}  # other fonts only draw page headers and footers


@dataclass
class Run:
    page: int
    x: float
    y: float
    kind: str  # "c" for Chinese glyph codes, "l" for Latin text
    cids: list = field(default_factory=list)
    text: str = ""
    font: str = ""


def parse_tounicode(data):
    """Parse a ToUnicode CMap into {code: text}, from its bfchar and bfrange blocks."""
    table = {}
    for block in re.findall(rb"beginbfchar(.*?)endbfchar", data, re.S):
        for src, dst in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            table[int(src, 16)] = bytes.fromhex(dst.decode()).decode("utf-16-be")
    for block in re.findall(rb"beginbfrange(.*?)endbfrange", data, re.S):
        for lo, hi, dst in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            start, end, first = int(lo, 16), int(hi, 16), int(dst, 16)
            for code in range(start, end + 1):
                table[code] = chr(first + code - start)
    return table


class FontInfo:
    def __init__(self, fdict):
        self.base = str(fdict.get("/BaseFont", "")).lstrip("/").split("+")[-1]
        self.type0 = fdict.get("/Subtype") == "/Type0"
        tounicode = fdict.get("/ToUnicode")
        self.table = parse_tounicode(tounicode.get_object().get_data()) if tounicode is not None else {}
        self.encoding = "mac_roman" if fdict.get("/Encoding") == "/MacRomanEncoding" else "latin-1"

    def text(self, raw):
        return "".join(self.table.get(b, bytes([b]).decode(self.encoding)) for b in raw)

    @staticmethod
    def cids(raw):
        return [int.from_bytes(raw[i:i + 2], "big") for i in range(0, len(raw) - 1, 2)]


def _raw(item):
    """The string's bytes exactly as written in the content stream.

    pypdf guesses that a string whose first byte is 0 is UTF-16BE and one whose second
    byte is 0 is UTF-16LE, and turns it into text. get_original_bytes() then re-encodes
    that text with a byte-order mark in front, so the glyph codes <0e001350> came back as
    FF FE 0E 00 13 50, that is codes 65534, 3584, 4944 instead of 3584, 4944. The
    original_bytes property returns the bytes pypdf actually read.
    """
    if isinstance(item, TextStringObject):
        return item.original_bytes
    if isinstance(item, (ByteStringObject, bytes)):
        return bytes(item)
    return None  # kerning numbers inside TJ arrays


def page_runs(reader, index):
    """Yield every text run on one page, in content-stream order."""
    page = reader.pages[index]
    contents = page.get_contents()
    if contents is None:
        return
    fonts = {str(k): FontInfo(v.get_object()) for k, v in page["/Resources"]["/Font"].items()}
    font, x, y = None, 0.0, 0.0
    for operands, op in ContentStream(contents, reader).operations:
        if op == b"Tf":
            font = fonts.get(str(operands[0]))
        elif op == b"Tm":
            x, y = float(operands[4]), float(operands[5])
        elif op in (b"Tj", b"TJ", b"'", b'"') and font is not None:
            items = operands[0] if op == b"TJ" else [operands[-1]]
            raw = b"".join(b for b in map(_raw, items) if b)
            if not raw:
                continue
            if font.type0:
                yield Run(index, x, y, "c", cids=FontInfo.cids(raw), font=font.base)
            else:
                yield Run(index, x, y, "l", text=font.text(raw), font=font.base)


def body_runs(path):
    """All runs of entry text in one PDF, without page headers and footers."""
    reader = pypdf.PdfReader(path)
    for i in range(len(reader.pages)):
        for run in page_runs(reader, i):
            if run.font in BODY_FONTS and "sayninhao" not in run.text:
                yield run


def seed_table(path):
    """Characters we get for free from the footer font, which does have a character table."""
    reader = pypdf.PdfReader(path)
    seed = {}
    for page in reader.pages:
        for f in page["/Resources"]["/Font"].values():
            f = f.get_object()
            if f.get("/Subtype") == "/Type0" and f.get("/ToUnicode") is not None:
                seed.update(parse_tounicode(f["/ToUnicode"].get_object().get_data()))
    return seed
