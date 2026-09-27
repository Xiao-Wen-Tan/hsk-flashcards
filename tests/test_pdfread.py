from pathlib import Path

import pytest

from pypdf.generic import ContentStream, TextStringObject, create_string_object

from pdfread import _raw, body_runs, page_runs, parse_tounicode, seed_table

PDF = Path("../HSK 词汇 6本/HSK1 词汇.pdf")
ALL_PDFS = [Path(f"../HSK 词汇 6本/HSK{n} 词汇.pdf") for n in range(1, 7)]


def test_parse_tounicode_bfchar_and_bfrange():
    data = b"""begincmap
2 beginbfchar
<21> <0101>
<0481> <FF08>
endbfchar
1 beginbfrange
<0030> <0032> <4E00>
endbfrange
endcmap"""
    assert parse_tounicode(data) == {0x21: "ā", 0x481: "（", 0x30: "一", 0x31: "丁", 0x32: "丂"}


@pytest.mark.skipif(not PDF.exists(), reason="vocabulary PDF not found")
def test_first_entry_of_hsk1():
    runs = list(body_runs(PDF))
    i = next(k for k, r in enumerate(runs) if r.kind == "l" and r.x < 12 and r.text.strip() == "1")
    head, latin = runs[i + 1], runs[i + 2]
    assert head.kind == "c" and head.cids == [835, 4541, 836]
    assert latin.kind == "l" and latin.text.startswith(" ài")


@pytest.mark.skipif(not PDF.exists(), reason="vocabulary PDF not found")
def test_body_runs_drop_footer_fonts():
    assert not any(r.font.startswith(".") or "sayninhao" in r.text for r in body_runs(PDF))


@pytest.mark.skipif(not PDF.exists(), reason="vocabulary PDF not found")
def test_seed_table_has_footer_characters():
    seed = seed_table(PDF)
    assert seed[5973] == "英" and seed[6575] == "词" and seed[1153] == "（"


def test_raw_keeps_codes_that_pypdf_mistakes_for_utf16():
    # pypdf reads <0e001350> as UTF-16LE (second byte 0) and <000f> as UTF-16BE (first byte 0).
    # Asking it to re-encode the text adds a byte-order mark: FF FE 0E 00 13 50 and FE FF 00 0F.
    le = create_string_object(bytes.fromhex("0e001350"))
    be = create_string_object(bytes.fromhex("000f"))
    assert isinstance(le, TextStringObject) and isinstance(be, TextStringObject)
    assert _raw(le) == bytes.fromhex("0e001350")
    assert _raw(be) == bytes.fromhex("000f")


def test_raw_in_a_real_content_stream():
    stream = ContentStream(None, None)
    stream.set_data(b"BT /C1 1 Tf <0e001350> Tj [<1a001a00> -20 <05a6>] TJ ET")
    items = [ops for ops, op in stream.operations if op in (b"Tj", b"TJ")]
    assert b"".join(_raw(x) for x in [items[0][0]]) == bytes.fromhex("0e001350")
    assert b"".join(b for b in map(_raw, items[1][0]) if b) == bytes.fromhex("1a001a0005a6")


@pytest.mark.skipif(not all(p.exists() for p in ALL_PDFS), reason="vocabulary PDFs not found")
def test_no_byte_order_mark_codes_in_any_pdf():
    import pypdf
    for path in ALL_PDFS:
        reader = pypdf.PdfReader(path)
        for i in range(len(reader.pages)):
            for run in page_runs(reader, i):
                assert 65534 not in run.cids and 65279 not in run.cids, (path.name, i, run.cids[:4])
