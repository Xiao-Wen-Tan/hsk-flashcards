from wordsjson import LICENSE, build, extra_no_distract, fix_short_meanings, stale

ROWS = [("w0001", "爱", "ài", "ai4", "ai", "love"), ("w0002", "八", "bā", "ba1", "ba", "eight"),
        ("w0003", "爸爸", "bàba", "ba4 ba5", "baba", "father"), ("w0004", "杯子", "bēizi", "bei1 zi5", "beizi", "cup"),
        ("w0005", "北京", "běijīng", "bei3 jing1", "beijing", "Beijing")]


def sample():
    words = [{"id": i, "hz": hz, "py": py, "pyNum": num, "pyBase": base, "syl": len(num.split()), "lv": 1,
              "pos": ["n."], "en": en, "enShort": en, "freq": 1} for i, hz, py, num, base, en in ROWS]
    curriculum = [{"id": w["id"], "theme": "t01", "ord": k, "noDistract": []} for k, w in enumerate(words, start=1)]
    themes = [{"id": "t01", "order": 1, "name": "Family & People", "count": 5}]
    sentences = [{"id": w["id"], "sentence": f"我说{w['hz']}。", "en": "I say it.", "src": "claude"} for w in words]
    pinyin = {w["id"]: f"wǒ shuō {w['py']}." for w in words}
    audio = {w["id"]: {"w": f"w/{w['id']}_0123abcd.mp3", "s": f"s/{w['id']}_4567cdef.mp3"} for w in words}
    return build("v001", "2026-10-05", words, curriculum, themes, sentences, pinyin, audio)


def test_build_matches_the_schema_example_shape():
    data = sample()
    assert list(data) == ["version", "generated", "license", "themes", "words"] and data["license"] == LICENSE
    first = data["words"][0]
    assert list(first) == ["id", "hz", "py", "pyNum", "pyBase", "syl", "lv", "pos", "en", "enShort", "theme", "ord",
                           "au", "noDistract", "ex"]
    assert first["ex"] == {"hz": "我说爱。", "py": "wǒ shuō ài.", "en": "I say it.", "au": "s/w0001_4567cdef.mp3",
                           "src": "claude"}


def test_stale_names_pinyin_and_audio_made_from_other_text():
    sentences = [{"id": "w0001", "sentence": "我爱你。"}, {"id": "w0002", "sentence": "八个人。"}]
    pinyin_rows = [{"id": "w0001", "sentence": "我爱你。", "py": "wǒ ài nǐ."},
                   {"id": "w0002", "sentence": "八本书。", "py": "bā běn shū."}]
    expected = {"w0001": {"w": "w/w0001_0123abcd.mp3", "s": "s/w0001_4567cdef.mp3"},
                "w0002": {"w": "w/w0002_0123abcd.mp3", "s": "s/w0002_89abcdef.mp3"}}
    audio = {"w0001": expected["w0001"], "w0002": {"w": "w/w0002_0123abcd.mp3", "s": "s/w0002_00000000.mp3"}}
    assert stale(sentences, pinyin_rows, audio, expected) == [
        "w0002: the pinyin was made from '八本书。' but the final sentence is '八个人。'",
        "w0002: the audio map has s/w0002_00000000.mp3 where the final texts give s/w0002_89abcdef.mp3"]
    assert stale(sentences, pinyin_rows[:1], {"w0001": audio["w0001"]}, {"w0001": expected["w0001"]}) == []


def card(wid, hz, en, short=None):
    return {"id": wid, "hz": hz, "en": en, "enShort": short or en}


def test_fix_short_meanings_replaces_a_cut_off_meaning_and_names_a_stale_fix():
    words = [card("w0002", "了", "used at the end of a sentence to indicate change in status", "used at the end of a…"),
             card("w0040", "吗", "used at the end of a sentence, indicating a question", "used at the end of a sentence")]
    fixes = [{"id": "w0002", "old": "used at the end of a…", "new": "marks a change or completion"}]
    fixed, problems = fix_short_meanings(words, fixes)
    assert [w["enShort"] for w in fixed] == ["marks a change or completion", "used at the end of a sentence"]
    assert problems == [] and words[0]["enShort"] == "used at the end of a…"  # the input is not changed
    _, problems = fix_short_meanings(words, [{"id": "w0040", "old": "something else", "new": "question word"}])
    assert problems == ["w0040: the fix expects the short meaning 'something else' but the card has "
                        "'used at the end of a sentence'"]


def test_extra_no_distract_joins_agent_pairs_and_meanings_that_begin_another():
    words = [card("w0002", "了", "used at the end of a sentence to indicate change in status", "marks a change"),
             card("w0040", "吗", "used at the end of a sentence, indicating a question", "used at the end of a sentence"),
             card("w0010", "高兴", "happy; glad", "happy"), card("w0011", "愉快", "pleased; joyful", "pleased"),
             card("w0012", "吃", "to eat", "eat")]
    extra, problems = extra_no_distract(words, [{"id_a": "w0010", "id_b": "w0011"}, {"id_a": "w0012", "id_b": "w9999"}])
    # 吗's "used at the end of a sentence" begins 了's full meaning, so they are kept apart without any pair.
    assert extra["w0002"] == {"w0040"} and extra["w0040"] == {"w0002"}
    assert extra["w0010"] == {"w0011"} and extra["w0011"] == {"w0010"}
    assert extra["w0012"] == set()
    assert problems == ["w0012 and w9999: w9999 is not a card"]


def test_build_adds_the_extra_overlaps_to_no_distract():
    data = sample()
    assert data["words"][0]["noDistract"] == []
    extra = {"w0001": {"w0003"}, "w0003": {"w0001"}}
    words = [{**w, "freq": 1} for w in data["words"]]
    curriculum = [{"id": w["id"], "theme": "t01", "ord": w["ord"], "noDistract": []} for w in data["words"]]
    sentences = [{"id": w["id"], "sentence": w["ex"]["hz"], "en": w["ex"]["en"], "src": "claude"} for w in data["words"]]
    rebuilt = build("v002", "2026-10-06", words, curriculum, data["themes"], sentences,
                    {w["id"]: w["ex"]["py"] for w in data["words"]},
                    {w["id"]: {"w": w["au"], "s": w["ex"]["au"]} for w in data["words"]}, extra=extra)
    assert rebuilt["words"][0]["noDistract"] == ["w0003"] and rebuilt["words"][2]["noDistract"] == ["w0001"]


import copy

from validate import check_order, check_themes, check_word, validate


def test_validate_passes_a_good_file():
    results = validate(sample(), lambda path, kind: None, word_range=(5, 5))
    assert results == {"top": [], "word count": [], "themes": [], "fields": [], "order": [], "links": [],
                       "distractors": [], "audio": []}


def test_validate_reports_bad_fields_and_missing_audio():
    data = sample()
    bad = copy.deepcopy(data["words"][0])
    bad.update({"py": "ai4", "en": "a; b; c; d", "enShort": "abbr. for 哈萨克斯坦", "ex": {**bad["ex"], "hz": "我～你。"}})
    problems = check_word(bad, {"t01"})
    assert "w0001: py 'ai4' does not match pyBase 'ai'" in problems
    assert "w0001: en 'a; b; c; d' is empty, over 80 characters or over 3 senses" in problems
    assert "w0001: enShort 'abbr. for 哈萨克斯坦' contains Chinese characters" in problems
    assert "w0001: ex.hz '我～你。' does not contain the headword written out" in problems
    labelled = {**data["words"][1], "en": "sv. dance", "enShort": "/vm. number of times"}
    assert check_word(labelled, {"t01"}) == ["w0002: en 'sv. dance' starts with a part-of-speech label",
                                             "w0002: enShort '/vm. number of times' starts with a part-of-speech label"]
    results = validate(data, lambda path, kind: "missing" if path.startswith("s/") else None,
                       word_range=(5, 5))
    assert results["audio"][0] == "w0001: s/w0001_4567cdef.mp3: missing"


def test_check_order_catches_a_level_going_down():
    words = sample()["words"]
    words[0]["lv"] = 2
    assert check_order(words, ["t01"]) == ["w0002: level goes down from 2 to 1 inside t01"]


def test_check_order_takes_level_group_first_then_theme():
    # The user's decision of 2026-09-29: HSK 1-2 words of every theme come before any HSK 3 word,
    # so a theme is two blocks here, t01's HSK 1 words and later its HSK 3 word.
    words = sample()["words"]
    for w, theme, lv in zip(words, ["t01", "t01", "t02", "t01", "t02"], [1, 2, 1, 3, 3]):
        w.update({"theme": theme, "lv": lv})
    assert check_order(words, ["t01", "t02"]) == []
    words[1]["lv"] = 3
    assert check_order(words, ["t01", "t02"]) == ["w0003: level group HSK 1-2 comes after HSK 3 in ord order"]
    words[1]["lv"] = 2
    words[3]["theme"], words[4]["theme"] = "t02", "t01"
    assert check_order(words, ["t01", "t02"]) == ["w0005: theme t01 comes after t02 inside HSK 3 in ord order"]


def test_check_themes_has_no_size_limits_but_wants_words_in_every_theme():
    data = sample()
    assert check_themes(data["themes"], data["words"]) == []
    data["themes"].append({"id": "t02", "order": 2, "name": "Food & Drink", "count": 0})
    assert check_themes(data["themes"], data["words"]) == ["theme t02 Food & Drink: no words"]


def test_check_word_checks_the_card_pinyin_spacing():
    w = sample()["words"][0]
    kept = {**w, "hz": "不客气", "py": "bú kèqi", "pyNum": "bu4 ke4 qi5", "pyBase": "bukeqi", "syl": 3,
            "ex": {**w["ex"], "hz": "他说不客气。", "py": "tā shuō bú kèqi."}}
    idiom = {**kept, "hz": "拔苗助长", "py": "bámiáo-zhùzhǎng", "pyNum": "ba2 miao2 zhu4 zhang3",
             "pyBase": "bamiaozhuzhang", "syl": 4,
             "ex": {**w["ex"], "hz": "拔苗助长不好。", "py": "bámiáo-zhùzhǎng bù hǎo."}}
    cute = {**kept, "hz": "可爱", "py": "kě'ài", "pyNum": "ke3 ai4", "pyBase": "keai", "syl": 2,
            "ex": {**w["ex"], "hz": "她很可爱。", "py": "tā hěn kě'ài."}}
    assert [check_word(x, {"t01"}) for x in (kept, idiom, cute)] == [[], [], []]
    assert check_word({**kept, "py": "bù kèqí"}, {"t01"}) == ["w0001: syllable 3 of py is qi2 but pyNum has qi5"]
    assert check_word({**cute, "py": "kěài"}, {"t01"}) == ["w0001: an apostrophe is missing before syllable 2 'ài'"]
    assert check_word({**kept, "py": "bú_kèqi"}, {"t01"}) == [
        "w0001: py 'bú_kèqi' holds '_'; only letters, spaces, hyphens and apostrophes are allowed",
        "w0001: py 'bú_kèqi' does not match pyBase 'bukeqi'"]


def test_check_word_wants_a_neutral_er_ending_as_r5():
    w = sample()["words"][0]
    button = {**w, "hz": "纽扣儿", "py": "niǔkòur", "pyNum": "niu3 kou4 r5", "pyBase": "niukour", "syl": 2,
              "ex": {**w["ex"], "hz": "我的纽扣儿掉了。", "py": "wǒ de niǔkòur diào le."}}
    daughter = {**button, "hz": "女儿", "py": "nǚ'ér", "pyNum": "nü3 er2", "pyBase": "nüer", "syl": 2,
                "ex": {**w["ex"], "hz": "她是我的女儿。", "py": "tā shì wǒ de nǚ'ér."}}
    assert [check_word(x, {"t01"}) for x in (button, daughter)] == [[], []]
    old = {**button, "py": "niǔkòu'er", "pyNum": "niu3 kou4 er5", "pyBase": "niukouer", "syl": 3}
    assert check_word(old, {"t01"}) == ["w0001: pyNum 'niu3 kou4 er5' ends in er5, but a neutral 儿 ending is r5"]


def test_check_word_wants_the_headword_as_on_its_card():
    w = sample()["words"][0]
    thing = {**w, "hz": "东西", "py": "dōngxi", "pyNum": "dong1 xi5", "pyBase": "dongxi", "syl": 2,
             "ex": {**w["ex"], "hz": "我买了很多东西。", "py": "wǒ mǎile hěn duō dōngxi."}}
    no = {**thing, "hz": "不", "py": "bù", "pyNum": "bu4", "pyBase": "bu", "syl": 1,
          "ex": {**w["ex"], "hz": "他不是学生。", "py": "tā bú shì xuésheng."}}
    here = {**thing, "hz": "这", "py": "zhè", "pyNum": "zhe4", "pyBase": "zhe", "syl": 1,
            "ex": {**w["ex"], "hz": "我能坐在这儿吗？", "py": "wǒ néng zuò zài zhèr ma?"}}
    first = {**thing, "ex": {**w["ex"], "hz": "东西在这儿。", "py": "dōngxi zài zhèr."}}
    pattern = {**thing, "hz": "虽然…但是…", "py": "suīrán…dànshì…", "pyNum": "sui1 ran2 dan4 shi4",
               "pyBase": "suirandanshi", "syl": 4,
               "ex": {**w["ex"], "hz": "虽然下雨了，但是我去。", "py": "suīrán xià yǔ le, dànshì wǒ qù."}}
    assert [check_word(x, {"t01"}) for x in (thing, no, here, first, pattern)] == [[], [], [], [], []]
    named = {**thing, "ex": {**thing["ex"], "py": "wǒ mǎile hěn duō Dōngxi."}}
    east_west = {**thing, "ex": {**thing["ex"], "py": "wǒ mǎile hěn duō dōngxī."}}
    assert check_word(named, {"t01"}) == [
        "w0001: ex.py 'wǒ mǎile hěn duō Dōngxi.' does not show 'dōngxi' as on the card",
        "w0001: ex.py 'wǒ mǎile hěn duō Dōngxi.' has a capital letter in 'Dōngxi'; all pinyin is in lower case, the start of a sentence and names included"]
    assert check_word(east_west, {"t01"}) == [
        "w0001: ex.py 'wǒ mǎile hěn duō dōngxī.' does not show 'dōngxi' as on the card"]


def test_check_word_accepts_numbers_and_quotations():
    w = sample()["words"][0]
    thousand = {**w, "hz": "千", "py": "qiān", "pyNum": "qian1", "pyBase": "qian", "syl": 1,
                "ex": {**w["ex"], "hz": "这个手机一千元。", "py": "zhè gè shǒujī yìqiān yuán."}}
    you = {**w, "hz": "你", "py": "nǐ", "pyNum": "ni3", "pyBase": "ni", "syl": 1,
           "ex": {**w["ex"], "hz": "他说：“你看。”", "py": 'tā shuō: "nǐ kàn."'}}
    assert [check_word(x, {"t01"}) for x in (thousand, you)] == [[], []]
    love = {**w, "ex": {**w["ex"], "hz": "我很爱你。", "py": "wǒ hěn tài nǐ."}}
    assert check_word(love, {"t01"}) == ["w0001: ex.py 'wǒ hěn tài nǐ.' does not show 'ài' as on the card"]
    some = {**w, "hz": "几", "py": "jǐ", "pyNum": "ji3", "pyBase": "ji", "syl": 1,
            "ex": {**w["ex"], "hz": "我去过几十个国家。", "py": "wǒ qùguo jǐshí gè guójiā."}}
    assert check_word(some, {"t01"}) == []


def test_check_word_accepts_joined_particles_and_keeps_inner_tones():
    w = sample()["words"][0]
    point = {**w, "hz": "指", "py": "zhǐ", "pyNum": "zhi3", "pyBase": "zhi", "syl": 1,
             "ex": {**w["ex"], "hz": "他指着前面。", "py": "tā zhǐzhe qiánmiàn."}}
    aspect = {**point, "hz": "着", "py": "zhe", "pyNum": "zhe5", "pyBase": "zhe",
              "ex": {**w["ex"], "hz": "他看着我。", "py": "tā kànzhe wǒ."}}
    bear = {**w, "hz": "受不了", "py": "shòubuliǎo", "pyNum": "shou4 bu4 liao3", "pyBase": "shoubuliao", "syl": 3,
            "ex": {**w["ex"], "hz": "真让人受不了。", "py": "zhēn ràng rén shòubuliǎo."}}
    drive = {**point, "hz": "驾驶", "py": "jiàshǐ", "pyNum": "jia4 shi3", "pyBase": "jiashi", "syl": 2,
             "ex": {**w["ex"], "hz": "驾驶员要小心。", "py": "jiàshǐyuán yào xiǎoxīn."}}
    assert [check_word(x, {"t01"}) for x in (point, aspect, bear, drive)] == [[], [], [], []]
    full = {**bear, "ex": {**bear["ex"], "py": "zhēn ràng rén shòubùliǎo."}}
    assert check_word(full, {"t01"}) == [
        "w0001: ex.py 'zhēn ràng rén shòubùliǎo.' does not show 'shòubuliǎo' as on the card"]


def test_check_word_accepts_the_headword_inside_a_longer_word_at_syllable_edges():
    w = sample()["words"][0]
    man = {**w, "hz": "男", "py": "nán", "pyNum": "nan2", "pyBase": "nan", "syl": 1,
           "ex": {**w["ex"], "hz": "我不认识那个男人。", "py": "wǒ bú rènshi nà gè nánrén."}}
    spring = {**man, "hz": "春", "py": "chūn", "pyNum": "chun1", "pyBase": "chun",
              "ex": {**w["ex"], "hz": "春天是一年的开始。", "py": "chūntiān shì yì nián de kāishǐ."}}
    good = {**man, "hz": "好", "py": "hǎo", "pyNum": "hao3", "pyBase": "hao",
            "ex": {**w["ex"], "hz": "他把写好的信放进了信封里。", "py": "tā bǎ xiěhǎo de xìn fàngjìnle xìnfēng lǐ."}}
    assert [check_word(x, {"t01"}) for x in (man, spring, good)] == [[], [], []]
    door = {**man, "hz": "户", "py": "hù", "pyNum": "hu4", "pyBase": "hu",
            "ex": {**w["ex"], "hz": "这户人家住在这儿。", "py": "zhè zhù rénjiā zhù zài zhèr."}}
    assert check_word(door, {"t01"}) == [
        "w0001: ex.py 'zhè zhù rénjiā zhù zài zhèr.' does not show 'hù' as on the card"]


def test_card_and_sentence_pinyin_are_in_lower_case():
    # The user's decision of 2026-09-29: no capital at the start of a sentence or on a name, in py and
    # in ex.py. Only the Latin letters of the sentence keep their capitals ("IT").
    w = sample()["words"][0]
    province = {**w, "hz": "省", "py": "shěng", "pyNum": "sheng3", "pyBase": "sheng", "syl": 1,
                "ex": {**w["ex"], "hz": "我来自山东省。", "py": "wǒ láizì shāndōng shěng."}}
    teacher = {**province, "hz": "老师", "py": "lǎoshī", "pyNum": "lao3 shi1", "pyBase": "laoshi", "syl": 2,
               "ex": {**w["ex"], "hz": "李老师在吗？", "py": "lǐ lǎoshī zài ma?"}}
    work = {**province, "hz": "工作", "py": "gōngzuò", "pyNum": "gong1 zuo4", "pyBase": "gongzuo", "syl": 2,
            "ex": {**w["ex"], "hz": "这是IT工作。", "py": "zhè shì IT gōngzuò."}}
    assert [check_word(x, {"t01"}) for x in (province, teacher, work)] == [[], [], []]
    named = {**teacher, "ex": {**teacher["ex"], "py": "Lǐ lǎoshī zài ma?"}}
    assert check_word(named, {"t01"}) == ["w0001: ex.py 'Lǐ lǎoshī zài ma?' has a capital letter in 'Lǐ'; all pinyin is in lower case, the start of a sentence and names included"]
    capital_card = {**province, "hz": "北京", "py": "Běijīng", "pyNum": "bei3 jing1", "pyBase": "beijing", "syl": 2,
                    "ex": {**w["ex"], "hz": "我爱北京。", "py": "wǒ ài Běijīng."}}
    assert check_word(capital_card, {"t01"}) == [
        "w0001: py 'Běijīng' has a capital letter; all pinyin is in lower case",
        "w0001: ex.py 'wǒ ài Běijīng.' has a capital letter in 'Běijīng'; all pinyin is in lower case, the start of a "
        "sentence and names included"]


def test_a_card_name_shows_its_headword_in_lower_case():
    # Since 2026-09-29 a card name such as 长城 is "chángchéng", so the card 长 shows "cháng" inside it.
    data = sample()
    first, second = data["words"][0], data["words"][1]
    long = {**first, "hz": "长", "py": "cháng", "pyNum": "chang2", "pyBase": "chang", "syl": 1,
            "ex": {**first["ex"], "hz": "我去过长城。", "py": "wǒ qùguo chángchéng."}}
    wall = {**second, "hz": "长城", "py": "chángchéng", "pyNum": "chang2 cheng2", "pyBase": "changcheng", "syl": 2,
            "ex": {**second["ex"], "hz": "长城很长。", "py": "chángchéng hěn cháng."}}
    data["words"][0], data["words"][1] = long, wall
    results = validate(data, lambda path, kind: None, word_range=(5, 5))
    assert results["fields"] == []
    assert check_word(long, {"t01"}) == []


def test_ex_py_holds_no_chinese_character():
    # 〇 (U+3007), the zero of years, is a Chinese character too, so a draft that kept it fails.
    w = sample()["words"][0]
    year = {**w, "hz": "年", "py": "nián", "pyNum": "nian2", "pyBase": "nian", "syl": 1,
            "ex": {**w["ex"], "hz": "我在二〇〇八年去过北京。", "py": "wǒ zài èr 〇 〇 bā nián qùguo běijīng."}}
    assert check_word(year, {"t01"}) == [
        "w0001: ex.py 'wǒ zài èr 〇 〇 bā nián qùguo běijīng.' contains Chinese characters"]
    fixed = {**year, "ex": {**year["ex"], "py": "wǒ zài èr líng líng bā nián qùguo běijīng."}}
    assert check_word(fixed, {"t01"}) == []


def test_a_quotation_after_a_colon_is_in_lower_case():
    # Point 9 of the style sheet as the user changed it on 2026-09-29: a quotation after a colon is in
    # lower case, with or without quotation marks, as the strict checker (pinyincheck) wants.
    w = sample()["words"][0]
    you = {**w, "hz": "你", "py": "nǐ", "pyNum": "ni3", "pyBase": "ni", "syl": 1,
           "ex": {**w["ex"], "hz": "他说：你看。", "py": "tā shuō: nǐ kàn."}}
    quoted = {**you, "ex": {**w["ex"], "hz": "他说：“你看。”", "py": 'tā shuō: "nǐ kàn."'}}
    assert [check_word(x, {"t01"}) for x in (you, quoted)] == [[], []]
    capital = {**you, "ex": {**w["ex"], "hz": "他说：“你看。”", "py": 'tā shuō: "Nǐ kàn."'}}
    assert check_word(capital, {"t01"}) == [
        "w0001: ex.py 'tā shuō: \"Nǐ kàn.\"' does not show 'nǐ' as on the card",
        "w0001: ex.py 'tā shuō: \"Nǐ kàn.\"' has a capital letter in 'Nǐ'; all pinyin is in lower case, the start of a sentence and names included"]
