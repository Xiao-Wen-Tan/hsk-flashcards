from wordlist import (apply_gloss_fixes, english, level_of, match_reading, pdf_words, public_only_words,
                      public_readings, second_readings)


def W(hz, forms, level=None, tags=()):
    w = {"simplified": hz, "forms": [{"transcriptions": {"pinyin": py}, "meanings": m} for py, m in forms],
         "level": list(tags)}
    if level:
        w["hsk"] = level
    return w


COMPLETE = [W("长", [("cháng", ["long"]), ("zhǎng", ["to grow"])], tags=["new-2", "old-2", "old-2"]),
            W("爱", [("ài", ["to love"])], tags=["old-1"]),
            W("干活儿", [("gàn huó r", ["to work"])]), W("嗯", [("ēn", ["hm"]), ("èn", ["hm"])]),
            W("窗帘", [("chuāng lián", ["window curtains"])]),
            W("都", [("Dū", ["surname Du"]), ("dōu", ["all"]), ("dū", ["capital"])]),
            W("当", [("dāng", ["(onom.) dong", "ding dong (bell)"]), ("dāng", ["to be", "to act as"])]),
            W("得", [("dé", ["to obtain"]), ("de", ["structural particle"]), ("děi", ["to have to"])],
              tags=["old-2", "old-2"]),
            W("纪录", [("jì lù", ["variant of 記錄|记录[ji4 lu4]"])]), W("记录", [("jì lù", ["to record"])]),
            W("纽扣儿", [("niǔ kòu er", ["button"])]), W("女儿", [("nǚ ér", ["daughter"])])]
R = public_readings(COMPLETE)


def test_public_readings_number_each_reading():
    assert [r["num"] for r in R["长"]] == ["chang2", "zhang3"]
    assert R["干活儿"][0]["num"] == "gan4 huo2 r5"
    assert R["纽扣儿"][0]["num"] == "niu3 kou4 r5" and R["纽扣儿"][0]["py"] == "niǔ kòu er"
    assert R["女儿"][0]["num"] == "nü3 er2"
    assert R["当"][0]["meanings"] == ["to be", "to act as", "(onom.) dong", "ding dong (bell)"]


def test_match_reading_picks_the_pdf_reading_and_returns_the_rest():
    reading, rest = match_reading(" zhǎng v. grow ", R["长"])
    assert reading["num"] == "zhang3" and rest == " v. grow "
    assert match_reading(" gàn huó er  work", R["干活儿"])[0]["num"] == "gan4 huo2 r5"
    assert match_reading(" dū n. capital ", R["都"])[0]["py"] == "dū"
    assert match_reading(" èng hum ", R["嗯"]) is None
    assert match_reading(" chuāng curtain ", R["窗帘"]) is None


FWD = {1: "长", 2: "我", 3: "大", 4: "了", 5: "。", 6: "窗", 7: "帘"}


def entry(file, n, head, latin, body):
    return {"file": file, "n": n, "head": head, "latin": latin,
            "tokens": [["c", head], ["l", latin], ["c", body]], "skipped": []}


def test_pdf_words_groups_by_headword_and_reading():
    entries = [entry(2, 5, [1], " zhǎng v. grow ", [2, 1, 3, 4, 5]),
               entry(3, 5, [1], " zhǎng v. grow ", [2, 1, 3, 4, 5]),
               entry(5, 9, [6, 7], " chuāng curtain ", [6, 7, 5])]
    fixes = {(5, 9): {"hz": "", "pynum": "chuang1 lian2", "pos": "n.", "gloss": "curtain", "sentence": ""}}
    words, problems = pdf_words(entries, FWD, R, fixes)
    assert problems == []
    grow = words[("长", "zhang3")]
    assert grow["files"] == [2, 3] and grow["pos"] == ["v."] and grow["glosses"] == ["grow"]
    assert grow["sents"] == [("我长大了。", "HSK2 #5")]
    assert grow["latin"] == [" zhǎng v. grow ", " zhǎng v. grow "]
    assert words[("窗帘", "chuang1 lian2")]["glosses"] == ["curtain"]
    assert words[("窗帘", "chuang1 lian2")]["latin"] == []


def test_pdf_words_reports_entries_without_a_reading():
    words, problems = pdf_words([entry(5, 9, [6, 7], " chuāng curtain ", [6, 7, 5])], FWD, R, {})
    assert words == {} and problems[0].startswith("HSK5 #9 窗帘")


def test_public_only_words_need_a_chosen_reading_when_there_are_several():
    old = [W("长", [("cháng", ["long"]), ("zhǎng", ["to grow"])], 2), W("爱", [("ài", ["to love"])], 1),
           W("都", [("Dū", ["surname Du"]), ("dōu", ["all"])], 1)]
    words, problems = public_only_words(old, {"爱"}, R, {})
    assert problems == ["长: readings cháng / zhǎng; choose one", "都: readings Dū / dōu / dū; choose one"]
    words, problems = public_only_words(old, {"爱"}, R, {"长": {"pynum": "chang2"}, "都": {"pynum": "dou1"}})
    assert set(words) == {("长", "chang2"), ("都", "dou1")} and problems == []


def test_public_only_words_prefer_the_lower_case_reading():
    lu = W("露", [("Lù", ["surname Lu"]), ("lòu", ["to show"]), ("lù", ["dew"])], 5)
    words, problems = public_only_words([lu], set(), public_readings([lu]), {"露": {"pynum": "lu4"}})
    assert problems == [] and words[("露", "lu4")]["meanings"] == ["dew"]
    assert words[("露", "lu4")]["capital"] is False


def test_public_only_words_take_pos_and_gloss_from_the_reading_row():
    lu = W("露", [("lù", ["dew", "syrup", "nectar", "to show", "to reveal"])], 5)
    row = {"pynum": "lu4", "pos": "n. v.", "gloss": "dew; to show; to reveal"}
    words, problems = public_only_words([lu], set(), public_readings([lu]), {"露": row})
    assert problems == [] and words[("露", "lu4")]["pos"] == ["n.", "v."]
    assert english(words[("露", "lu4")], {}) == ["dew", "to show", "to reveal"]
    words, problems = public_only_words([lu], set(), public_readings([lu]), {"露": {"pynum": "lou4"}})
    assert words == {} and problems == ["露: chosen reading lou4 is not one of its readings"]


def test_apply_gloss_fixes():
    words = {("过问", "guo4 wen4"): {"glosses": ["concern oneself with; take aninterest in"]}}
    fixes = {("过问", "guo4 wen4"): "concern oneself with; take an interest in", ("好", "hao3"): "good"}
    assert apply_gloss_fixes(words, fixes) == ["好 hao3: a gloss fix for a card that does not exist"]
    assert words[("过问", "guo4 wen4")]["glosses"] == ["concern oneself with; take an interest in"]


def test_second_readings_need_a_decision():
    cards = {("长", "chang2"), ("得", "de5"), ("爱", "ai4")}
    words, problems = second_readings(COMPLETE, R, cards, {})
    assert words == {} and problems == [
        "长 zhǎng: a second HSK 2.0 entry with no card; add a row with card Y or N",
        "得 dé: a second HSK 2.0 entry with no card; add a row with card Y or N",
        "得 děi: a second HSK 2.0 entry with no card; add a row with card Y or N"]
    decided = {("长", "zhang3"): {"card": "Y", "pos": "v. n.", "gloss": ""}, ("得", "de2"): {"card": "N"},
               ("得", "dei3"): {"card": "y", "pos": "v.", "gloss": "must; to have to"}}
    words, problems = second_readings(COMPLETE, R, cards, decided)
    assert problems == [] and set(words) == {("长", "zhang3"), ("得", "dei3")}
    assert words[("长", "zhang3")]["pos"] == ["v.", "n."] and english(words[("长", "zhang3")], R) == ["to grow"]
    assert english(words[("得", "dei3")], R) == ["must", "to have to"]


def test_level_and_english():
    w = {"hz": "长", "num": "zhang3", "files": [3, 4], "glosses": []}
    assert level_of(w, {"长": 2}) == 2 and level_of(w, {}) == 3
    assert english(w, R) == ["to grow"]
    assert english({**w, "glosses": ["grow; develop"]}, R) == ["grow", "develop"]
    assert english({"hz": "纪录", "num": "ji4 lu4", "files": [], "glosses": []}, R) == ["to record"]


def test_card_pinyin_is_in_lower_case_and_names_keep_their_word_spacing():
    # The user's decision of 2026-09-29: card py is in lower case, names included, whether the HSK PDFs
    # print a capital (北京 "Běijīng") or the public list writes one (欧洲 "Ōuzhōu"). data/manual/capitals
    # still gives the words of a name ("lǐ lǎoshī").
    import importlib
    step5 = importlib.import_module("05_build_wordlist")

    def card(hz, num, latin=(), capital=True):
        return {"hz": hz, "num": num, "latin": list(latin), "capital": capital}

    names = {"欧洲": (["欧洲"], [True]), "李老师": (["李", "老师"], [True, False]), "长城": (["长城"], [True]),
             "黄河": (["黄", "河"], [True, True])}
    got = step5.card_pinyin(card("北京", "bei3 jing1", [" Běijīng n. Beijing "]), {}, names)
    assert (got[0]["py"], got[1], got[2]) == ("běijīng", "pdf", None)
    got = step5.card_pinyin(card("欧洲", "ou1 zhou1"), {}, names)
    assert (got[0]["py"], got[1], got[2]) == ("ōuzhōu", "jieba", None)
    assert step5.card_pinyin(card("李老师", "li3 lao3 shi1"), {}, names)[0]["py"] == "lǐ lǎoshī"
    # A row for a printed card is allowed when its words fit the print's word spacing.
    got = step5.card_pinyin(card("长城", "chang2 cheng2", [" Chángchéng n. the Great Wall "]), {}, names)
    assert (got[0]["py"], got[2]) == ("chángchéng", None)
    got = step5.card_pinyin(card("黄河", "huang2 he2", [" Huánghé n. the Yellow River "]), {}, names)
    assert got[0]["py"] == "huánghé"
    assert got[2] == "黄河: data/manual/capitals gives the words 黄 河, but the HSK PDF prints 'huánghé'"
    # A name of the public list still needs a row, which gives its word spacing.
    assert step5.card_pinyin(card("华裔", "hua2 yi4"), {}, {})[2] == \
        "华裔: the public list writes it as a name; add a row to data/manual/capitals to give its word spacing"
