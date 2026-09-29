from themes import (LEVEL_GROUPS, THEMES, batch_rows, check_output, chunks, curriculum, is_starter,
                    level_group, second_opinion_flags)


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


def test_level_groups_put_hsk_1_and_2_together():
    assert LEVEL_GROUPS == [("HSK 1-2", (1, 2)), ("HSK 3", (3,)), ("HSK 4", (4,)), ("HSK 5", (5,)), ("HSK 6", (6,))]
    assert [level_group(lv) for lv in range(1, 7)] == [0, 0, 1, 2, 3, 4]


def test_curriculum_goes_level_group_first_then_theme_then_level_frequency_and_id():
    def w(i, lv, freq):
        return {"id": f"w{i:04d}", "lv": lv, "freq": freq}
    words = [w(1, 3, 1), w(2, 1, 9), w(3, 2, 1), w(4, 1, 5), w(5, 6, 1), w(6, 1, 5), w(7, 3, 2), w(8, 4, 1)]
    theme_of = {"w0001": 6, "w0002": 6, "w0003": 6, "w0004": 2, "w0005": 2, "w0006": 6, "w0007": 2, "w0008": 9}
    names = {2: "Greetings & Courtesy", 6: "Food & Drink", 3: "Numbers", 9: "Daily Routine"}
    out_ = curriculum(words, theme_of, [2, 6, 3, 9], names)
    assert [(group, no, name, [x["id"] for x in ws]) for group, no, name, ws in out_] == [
        ("HSK 1-2", 2, "Greetings & Courtesy", ["w0004"]),
        ("HSK 1-2", 6, "Food & Drink", ["w0006", "w0002", "w0003"]),
        ("HSK 3", 2, "Greetings & Courtesy", ["w0007"]),
        ("HSK 3", 6, "Food & Drink", ["w0001"]),
        ("HSK 4", 9, "Daily Routine", ["w0008"]),
        ("HSK 6", 2, "Greetings & Courtesy", ["w0005"])]


def test_curriculum_never_splits_a_big_theme():
    words = [{"id": f"w{i:04d}", "lv": 1, "freq": i} for i in range(1, 701)]
    out_ = curriculum(words, {x["id"]: 6 for x in words}, [6], {6: "Food & Drink"})
    assert [(group, name, len(ws)) for group, no, name, ws in out_] == [("HSK 1-2", "Food & Drink", 700)]
