from themes import (THEMES, batch_rows, check_output, chunks, curriculum, is_starter, second_opinion_flags,
                    split_by_level)


def test_thirty_themes_starting_with_the_starter_kit():
    assert len(THEMES) == 30 and THEMES[0] == "Starter Kit" and THEMES[29] == "Idioms & Formal Expressions"


def test_starter_kit_rule():
    assert is_starter({"hz": "我", "lv": 1, "pos": ["pron."]})
    assert is_starter({"hz": "为什么", "lv": 2, "pos": []})
    assert is_starter({"hz": "吧", "lv": 2, "pos": ["part."]})
    assert not is_starter({"hz": "自己", "lv": 3, "pos": ["pron."]})
    assert not is_starter({"hz": "喜欢", "lv": 1, "pos": ["v."], "pyNum": "xi3 huan5"})


def test_starter_kit_rule_takes_the_six_added_words():
    assert is_starter({"hz": "和", "lv": 1, "pos": ["conj.", "prep."], "pyNum": "he2"})
    assert is_starter({"hz": "一点儿", "lv": 1, "pos": ["m."], "pyNum": "yi1 dian3 r5"})
    assert is_starter({"hz": "没有", "lv": 1, "pos": ["v."], "pyNum": "mei2 you3"})
    assert is_starter({"hz": "还", "lv": 2, "pos": ["adv."], "pyNum": "hai2"})
    assert not is_starter({"hz": "还", "lv": 2, "pos": ["v."], "pyNum": "huan2"})


def test_batch_rows_and_chunks():
    w = {"id": "w0001", "hz": "爱", "py": "ài", "lv": 1, "pos": ["v.", "n."], "en": "love"}
    assert batch_rows([w]) == [["w0001", "爱", "ài", 1, "v. n.", "love"]]
    assert [len(c) for c in chunks(list(range(5)), 2)] == [2, 2, 1]


INPUT = [{"id": "w0001", "hz": "爱"}, {"id": "w0002", "hz": "八"}]


def out(rid, hz, theme="20", conf="H", alt=""):
    return {"id": rid, "hz": hz, "theme_no": theme, "confidence": conf, "alt_theme_no": alt, "note": ""}


def test_check_output_accepts_a_clean_batch():
    assert check_output(INPUT, [out("w0001", "爱"), out("w0002", "八", "3", "M", "24")]) == []


def test_check_output_finds_every_kind_of_problem():
    problems = check_output(INPUT, [out("w0001", "受"), out("w0001", "爱", "1"), out("w0009", "九"),
                                    out("w0001", "爱", "20", "X", "99")])
    assert "w0001: hz '受' differs from the input '爱'" in problems
    assert "w0001: theme_no '1' is not 2 to 30" in problems
    assert "w0009: not in the input" in problems
    assert "w0001: confidence 'X' is not H, M or L" in problems
    assert "w0001: alt_theme_no '99' is not a theme number" in problems
    assert "w0001: classified 3 times" in problems
    assert "w0002: missing" in problems


def test_second_opinion_flags_only_real_disagreements():
    main = {"w1": ("6", ""), "w2": ("6", "9"), "w3": ("6", "")}
    second = {"w1": ("7", ""), "w2": ("9", ""), "w3": ("6", "")}
    assert second_opinion_flags(main, second) == {"w1": "7"}


def test_split_by_level():
    assert [len(p) for p in split_by_level(list(range(700)))] == [350, 350]
    assert [len(p) for p in split_by_level(list(range(351)))] == [176, 175]
    assert [len(p) for p in split_by_level(list(range(40)))] == [40]


def test_curriculum_orders_by_theme_level_frequency_and_splits_big_themes():
    words = [{"id": f"w{i:04d}", "lv": 6 - i % 2, "freq": i} for i in range(1, 401)] + \
            [{"id": "w0999", "lv": 1, "freq": 5}]
    theme_of = {w["id"]: 6 for w in words}
    theme_of["w0999"] = 2
    out_ = curriculum(words, theme_of, [2, 6, 3], {2: "Greetings & Courtesy", 6: "Food & Drink", 3: "Numbers"})
    assert [(no, name, len(ws)) for no, name, ws in out_] == [
        (2, "Greetings & Courtesy", 1), (6, "Food & Drink (Part 1)", 200), (6, "Food & Drink (Part 2)", 200)]
    part1 = out_[1][2]
    assert [w["lv"] for w in part1] == [5] * 200 and part1[0]["id"] == "w0001"
