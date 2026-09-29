import importlib

from themes import curriculum
from validate import check_order

step6c = importlib.import_module("06c_themes_finalize")


def w(rid, lv, freq=1):
    return {"id": rid, "lv": lv, "freq": freq}


def test_ord_walks_the_blocks_and_theme_ids_follow_theme_order():
    # Theme 2 is studied before theme 1. Theme 1 has words in HSK 1-2 and HSK 3, so it gets two blocks.
    words = [w("w1", 1), w("w2", 3), w("w3", 2), w("w4", 1, 5), w("w5", 4)]
    theme_of = {"w1": 1, "w2": 1, "w3": 2, "w4": 2, "w5": 2}
    blocks = curriculum(words, theme_of, [2, 1], {1: "One", 2: "Two"})
    rows, themes = step6c.finalize(blocks, [2, 1], {1: "One", 2: "Two"}, {"w1": ["w3"]})
    assert themes == [{"id": "t01", "order": 1, "name": "Two", "count": 3},
                      {"id": "t02", "order": 2, "name": "One", "count": 2}]
    assert [(r["id"], r["theme"], r["ord"]) for r in rows] == [
        ("w4", "t01", 1), ("w3", "t01", 2), ("w1", "t02", 3), ("w2", "t02", 4), ("w5", "t01", 5)]
    assert rows[2]["noDistract"] == ["w3"] and rows[0]["noDistract"] == []
    lv = {x["id"]: x["lv"] for x in words}
    assert check_order([dict(r, lv=lv[r["id"]]) for r in rows], ["t01", "t02"]) == []


def test_blank_rows_of_the_reviewed_sheet_are_dropped():
    rows = [{"id": "w1", "hz": "爱"}, {"id": "", "hz": ""}, {"id": " ", "hz": None}]
    assert step6c.without_blank_rows(rows) == [{"id": "w1", "hz": "爱"}]
