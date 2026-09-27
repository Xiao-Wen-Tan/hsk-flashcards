from pathlib import Path

import pytest

from pdfread import body_runs, parse_tounicode, seed_table

PDF = Path("../HSK 词汇 6本/HSK1 词汇.pdf")


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
