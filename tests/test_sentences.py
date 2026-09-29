from sentences import (char_levels, check_answers, choose_pdf_sentence, english_problems, fix_share, hard_chars,
                       pdf_problem, redo_batches, spotcheck_problems, verdict_problems, written_limit,
                       written_problems)

WORDS = [{"hz": "我", "lv": 1}, {"hz": "你", "lv": 1}, {"hz": "爱", "lv": 1}, {"hz": "吃", "lv": 1},
         {"hz": "米饭", "lv": 1}, {"hz": "喜欢", "lv": 1}, {"hz": "餐厅", "lv": 4}, {"hz": "今天", "lv": 1},
         {"hz": "很", "lv": 1}, {"hz": "好", "lv": 1}, {"hz": "这个", "lv": 1}]
LEVELS = char_levels(WORDS)


def test_char_levels_and_hard_chars():
    assert LEVELS["我"] == 1 and LEVELS["餐"] == 4
    assert hard_chars("我爱餐厅。", "爱", 2, LEVELS) == ["餐", "厅"]
    assert hard_chars("我爱鲸。", "爱", 6, LEVELS) == ["鲸"]


def test_the_zero_of_years_is_a_character_as_easy_as_ling():
    # 〇 (U+3007), the zero of years, lies outside the main block of Chinese characters. It counts as a
    # character with the level of 零, so a year such as 二〇〇八年 does not make a sentence hard.
    levels = char_levels(WORDS + [{"hz": "零", "lv": 2}, {"hz": "二", "lv": 1}, {"hz": "八", "lv": 1},
                                  {"hz": "年", "lv": 1}])
    assert levels["〇"] == 2
    assert written_problems("我在二〇〇八年很爱吃米饭。", {"hz": "爱", "lv": 1}, levels) == []


def test_pdf_problem():
    assert pdf_problem("妈妈，我爱你。", "爱") is None
    assert pdf_problem(None, "爱") == "the ～ marks do not match the headword"
    assert pdf_problem("我喜欢你。", "爱") == "the headword is missing"
    assert pdf_problem("甲：谢谢你！乙：不客气。", "不客气") == "a two-speaker dialogue"
    assert pdf_problem("拜托！", "拜托") == "too short"


def test_choose_pdf_sentence_prefers_easy_then_short():
    word = {"hz": "爱", "lv": 1, "sents": [["我～餐厅。", "HSK1 #1"], ["我～吃米饭，我～你。", "HSK1 #1"],
                                           ["我～你。", "HSK2 #1"], ["我～鲸", "HSK1 #1"]]}
    assert choose_pdf_sentence(word, LEVELS) == ("我爱你。", "HSK2 #1")
    assert choose_pdf_sentence({"hz": "爱", "lv": 1, "sents": []}, LEVELS) is None


def test_written_limit():
    assert [written_limit(lv) for lv in range(1, 7)] == [2, 2, 3, 4, 4, 4]


def test_written_problems():
    word = {"hz": "爱", "lv": 1}
    assert written_problems("我很爱吃米饭。", word, LEVELS) == []
    assert written_problems("我爱你。", word, LEVELS) == ["3 Chinese characters, not 6 to 15"]
    assert "does not contain the headword exactly" in written_problems("我很喜欢吃米饭。", word, LEVELS)
    assert "too many hard characters: 餐厅" in written_problems("我很爱这个餐厅。", word, LEVELS)
    assert "does not end with 。！ or ？" in written_problems("我很爱吃米饭", word, LEVELS)


def test_english_problems():
    assert english_problems("I love you.") == []
    assert english_problems("") == ["empty translation"]
    assert english_problems("I love 你") == ["Chinese characters in the translation",
                                             "translation does not end with . ! or ?"]


def test_check_answers():
    inputs = [{"id": "w1", "hz": "爱"}, {"id": "w2", "hz": "吃"}]
    outputs = [{"id": "w1", "hz": "爱", "sentence": "我很爱吃米饭。"}, {"id": "w1", "hz": "爱", "sentence": "x"},
               {"id": "w3", "hz": "好", "sentence": "好。"}]
    rule = lambda given, answer: [] if answer["sentence"].endswith("。") else ["bad"]
    problems, got = check_answers(inputs, outputs, "hz", rule)
    assert problems == ["w1: bad", "w3: not in the input", "w1: answered 2 times", "w2: missing"]
    assert set(got) == {"w1"}


def test_verdict_problems():
    word = {"hz": "爱", "lv": 1}
    assert verdict_problems({}, {"verdict": "OK"}, word, LEVELS) == []
    assert verdict_problems({}, {"verdict": "maybe"}, word, LEVELS) == ["verdict 'maybe' is not OK or FIX"]
    assert verdict_problems({}, {"verdict": "FIX", "fixed_en": ""}, word, LEVELS) == ["fixed_en: empty translation"]
    assert verdict_problems({}, {"verdict": "FIX", "fixed_en": "I love rice.", "fixed_sentence": "我爱。"},
                            word, LEVELS) == ["fixed_sentence: 2 Chinese characters, not 6 to 15"]


def test_redo_batches_and_fix_share():
    sample = [{"id": "w1", "batch": "sentences/batch_001", "src": "claude"},
              {"id": "w2", "batch": "sentences/batch_001", "src": "claude"},
              {"id": "w3", "batch": "translations/batch_004", "src": "pdf"},
              {"id": "w4", "batch": "translations/batch_004", "src": "pdf"}]
    assert redo_batches(sample, {"w1", "w2", "w3"}) == ["sentences/batch_001"]
    assert fix_share(sample, {"w1", "w3"}, "pdf") == 0.5
    assert fix_share(sample, set(), "claude") == 0.0


def test_spotcheck_problems():
    generated = [{"id": "w1"}, {"id": "w2"}, {"id": "w3"}]
    reviewed = [{"id": "w1", "ok": "y", "better_en": ""}, {"id": "w2", "ok": "N", "better_en": "I eat rice."},
                {"id": "w3", "ok": "Y", "better_en": ""}]
    assert spotcheck_problems(generated, reviewed) == ([], [("w2", "I eat rice.")])
    assert spotcheck_problems(generated, reviewed[:2])[0] == ["w3: missing from the reviewed sheet"]
    reviewed = [{"id": "w1", "ok": "", "better_en": ""}, {"id": "w2", "ok": "N", "better_en": ""},
                {"id": "w3", "ok": "Y"}, {"id": "w3", "ok": "Y"}, {"id": "w9", "ok": "Y"}]
    assert spotcheck_problems(generated, reviewed)[0] == [
        "w1: ok is '', write Y or N", "w2: better_en: empty translation", "'w9': not in the spot-check sheet",
        "w3: appears 2 times"]
