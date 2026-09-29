from pinyincheck import (check_answer, check_line, known_readings, line_items, match_answers, names_of, segmentations,
                         word_facts)

READ = {"他": {"ta1"}, "在": {"zai4"}, "打": {"da3"}, "电": {"dian4"}, "话": {"hua4"}, "呢": {"ne5", "ni2"},
        "我": {"wo3"}, "不": {"bu4", "bu2", "bu5"}, "是": {"shi4"}, "学": {"xue2"}, "生": {"sheng1"},
        "这": {"zhe4", "zhei4"}, "个": {"ge4"}, "人": {"ren2"}, "哪": {"na3", "nei3"}, "儿": {"er2", "r5"},
        "喂": {"wei4"}, "李": {"li3"}, "老": {"lao3"}, "师": {"shi1"}, "吗": {"ma5"}, "来": {"lai2"}, "自": {"zi4"},
        "山": {"shan1"}, "东": {"dong1"}, "省": {"sheng3", "xing3"}, "说": {"shuo1", "shui4"}, "你": {"ni3"},
        "看": {"kan4"}, "今": {"jin1"}, "天": {"tian1"}, "年": {"nian2"}, "月": {"yue4"}, "日": {"ri4"},
        "她": {"ta1"}, "的": {"de5", "di4"}, "女": {"nü3"}, "去": {"qu4"}, "过": {"guo4", "guo5"}, "几": {"ji3"},
        "十": {"shi2"}, "国": {"guo2"}, "家": {"jia1"}, "有": {"you3"}, "一": {"yi1", "yi2", "yi4", "yi5"},
        "点": {"dian3"}, "钱": {"qian2"}, "工": {"gong1"}, "作": {"zuo4"}, "找": {"zhao3"}, "到": {"dao4"},
        "爱": {"ai4"}, "北": {"bei3"}, "京": {"jing1"}, "它": {"ta1"}, "三": {"san1"}, "四": {"si4"}, "很": {"hen3"},
        "好": {"hao3"}, "虽": {"sui1"}, "然": {"ran2"}, "下": {"xia4"}, "雨": {"yu3"}, "但": {"dan4"},
        "了": {"le5", "liao3"}, "第": {"di4"}, "小": {"xiao3"}, "明": {"ming2"}, "现": {"xian4"}, "八": {"ba1"},
        "九": {"jiu3"}, "星": {"xing1"}, "期": {"qi1"}, "五": {"wu3"}, "斤": {"jin1"}, "千": {"qian1"},
        "元": {"yuan2"}, "次": {"ci4"}, "课": {"ke4"}, "从": {"cong2"}, "开": {"kai1"}, "始": {"shi3"}, "二": {"er4"},
        "分": {"fen1", "fen4"}, "之": {"zhi1"}, "〇": {"ling2"}, "差": {"cha4", "cha1"}, "多": {"duo1"}, "昨": {"zuo2"},
        "两": {"liang3"}, "块": {"kuai4"}, "少": {"shao3"}, "们": {"men5"}, "起": {"qi3"}}
NAMES = {"北京": (["北京"], [True]), "李老师": (["李", "老师"], [True, False]), "山东省": (["山东", "省"], [True, True])}
# What the checks of 一, 不, numbers and 了 know about words: a small public list with its parts of speech
# (q is a measure word), one public-list word with a neutral bu, and one card that shows a tone change.
FACTS = word_facts([{"simplified": hz, "pos": tags} for hz, tags in
                    [("找", ["v"]), ("到", ["v"]), ("去", ["v"]), ("是", ["v"]), ("看", ["v"]), ("个", ["q"]),
                     ("年", ["qt", "n"]), ("斤", ["q"]), ("次", ["qv"]), ("点", ["q", "n"]), ("元", ["q", "n"]),
                     ("课", ["n"]), ("月", ["n"]), ("差不多", ["d"])]],
                   {"差不多": [{"py": "chà bu duō", "num": "cha4 bu5 duo1"}]},
                   [{"hz": "一起", "py": "yìqǐ", "pyNum": "yi1 qi3"}])


def card(hz, py, pynum):
    return {"hz": hz, "py": py, "pyNum": pynum}


CALL = card("打电话", "dǎ diànhuà", "da3 dian4 hua4")


def check(sentence, line, head=CALL, names=NAMES, facts=FACTS):
    return check_line(sentence, line, head, lambda ch: READ.get(ch, set()) or MORE_READ.get(ch, set()), names, facts)


# Readings and word facts for the tests of the known open items (added after the plan's tests).
MORE_READ = {"会": {"hui4"}, "就": {"jiu4"}, "要": {"yao4"}, "公": {"gong1"}, "买": {"mai3"}, "考": {"kao3"},
             "试": {"shi4"}, "及": {"ji2"}, "格": {"ge2"}, "福": {"fu2"}, "建": {"jian4"}, "统": {"tong3"},
             "花": {"hua1"}, "听": {"ting1"}, "楼": {"lou2"}, "百": {"bai3"}, "同": {"tong2"}}
MORE_FACTS = word_facts([{"simplified": hz, "pos": tags} for hz, tags in
                         [("找", ["v"]), ("到", ["v"]), ("去", ["v"]), ("个", ["q"]), ("公斤", ["q"]),
                          ("考试", ["v", "n"]), ("试", ["v"]), ("及格", ["v"]), ("要", ["v"])]],
                        {},
                        [{"hz": "一会儿", "py": "yíhuìr", "pyNum": "yi1 hui4 r5"},
                         {"hz": "要不", "py": "yàobù", "pyNum": "yao4 bu4"},
                         {"hz": "一起", "py": "yìqǐ", "pyNum": "yi1 qi3"}])


def test_lines_that_follow_the_style_sheet_pass():
    good = [("他在打电话呢。", "tā zài dǎ diànhuà ne.", CALL),
            ("我不是学生。", "wǒ bú shì xuésheng.", card("不", "bù", "bu4")),
            ("这个人在哪儿？", "zhège rén zài nǎr?", card("这", "zhè", "zhe4")),
            ("喂，李老师在吗？", "wèi, lǐ lǎoshī zài ma?", card("老师", "lǎoshī", "lao3 shi1")),
            ("我来自山东省。", "wǒ láizì shāndōng shěng.", card("省", "shěng", "sheng3")),
            ("他说：“你看。”", 'tā shuō: "nǐ kàn."', card("说", "shuō", "shuo1")),
            ("今天是2012年8月9日。", "jīntiān shì 2012 nián 8 yuè 9 rì.", card("今天", "jīntiān", "jin1 tian1")),
            ("它是三点一四。", "tā shì sān diǎn yī sì.", card("三", "sān", "san1")),
            ("她是我的女儿。", "tā shì wǒ de nǚ'ér.", card("女儿", "nǚ'ér", "nü3 er2")),
            ("我去过几十个国家。", "wǒ qùguo jǐshí gè guójiā.", card("几", "jǐ", "ji3")),
            ("我有一点儿钱。", "wǒ yǒu yìdiǎnr qián.", card("一点儿", "yìdiǎnr", "yi1 dian3 r5")),
            ("这是IT工作。", "zhè shì IT gōngzuò.", card("工作", "gōngzuò", "gong1 zuo4")),
            ("他找不到家。", "tā zhǎo bu dào jiā.", card("找", "zhǎo", "zhao3")),
            ("我爱北京。", "wǒ ài běijīng.", card("爱", "ài", "ai4")),
            ("虽然下雨了，但是我去。", "suīrán xià yǔ le, dànshì wǒ qù.", card("虽然…但是…", "suīrán…dànshì…", "sui1 ran2 dan4 shi4"))]
    assert [check(s, line, head) for s, line, head in good] == [[]] * len(good)


def test_each_character_needs_one_syllable():
    assert check("他在打电话呢。", "tā zài dǎ diànhuà.") == [
        "the 6 characters 他在打电话呢 do not line up with the 5 syllables of 'tā zài dǎ diànhuà'"]
    assert check("他在打电话呢。", "tā zài zài dǎ diànhuà ne.") == [
        "the 6 characters 他在打电话呢 do not line up with the 7 syllables of 'tā zài zài dǎ diànhuà ne'"]
    assert check("我有一点儿钱。", "wǒ yǒu yìdiǎn r qián.", card("一点儿", "yìdiǎnr", "yi1 dian3 r5")) == [
        "'r' cannot be divided into pinyin syllables"]


def test_each_syllable_is_a_reading_of_its_character():
    assert check("他在打电话呢。", "tā zhài dǎ diànhuà ne.") == ["'zhài' is not a reading of 在; its readings are zài"]
    assert check("很好。", "hěn haǒ.", card("很", "hěn", "hen3")) == [
        "'haǒ' needs one tone mark on the right vowel, or none for the neutral tone"]


def test_tones_count_and_rare_readings_do_not():
    listed = {"他": [{"py": "tā", "num": "ta1"}], "是": [{"py": "shì", "num": "shi4"}],
              "在": [{"py": "zài", "num": "zai4"}], "学生": [{"py": "xué sheng", "num": "xue2 sheng5"}]}
    readings = known_readings(listed, [CALL])
    student = card("学生", "xuésheng", "xue2 sheng5")
    assert check_line("他是学生。", "tā shì xuésheng.", student, readings, NAMES, FACTS) == []
    # pypinyin also knows 他 tuó and 是 tí, but the public list has only tā and shì.
    assert check_line("他是学生。", "tuó tí xuésheng.", student, readings, NAMES, FACTS) == [
        "'tuó' is not a reading of 他; its readings are tā", "'tí' is not a reading of 是; its readings are shì"]
    assert check_line("他在打电话呢。", "tā zāi dǎ diànhuà ne.", CALL, readings, NAMES, FACTS) == [
        "'zāi' is not a reading of 在; its readings are zài"]
    # A neutral tone counts only inside a word ("xuésheng"), not at the start of one.
    assert check_line("他在打电话呢。", "tā zai dǎ diànhuà ne.", CALL, readings, NAMES, FACTS) == [
        "'zai' is not a reading of 在 at the start of a word; its readings are zài"]


def test_the_tone_changes_of_yi_and_bu():
    go = card("去", "qù", "qu4")
    assert check("我不去。", "wǒ bú qù.", go) == []
    assert check("我不去。", "wǒ bù qù.", go) == ["'bù' (不) comes before the fourth tone of 'qù', so it is written 'bú'"]
    assert check("我不好。", "wǒ bú hǎo.", card("好", "hǎo", "hao3")) == [
        "'bú' (不) is written 'bú' only before a fourth tone, so write 'bù' here"]
    assert check("我一个人去。", "wǒ yí gè rén qù.", go) == []
    assert check("我一个人去。", "wǒ yī gè rén qù.", go) == [
        "'yī' (一) counts with 个 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    assert check("我一个人去。", "wǒ yì gè rén qù.", go) == [
        "'yì' (一) comes before the fourth tone of 'gè', so it is written 'yí'"]
    assert check("我是第一个。", "wǒ shì dì-yī gè.", card("是", "shì", "shi4")) == []
    # A decimal is read digit by digit, and its 一 keeps the first tone (style sheet point 6).
    assert check("它是三点一四。", "tā shì sān diǎn yí sì.", card("三", "sān", "san1")) == [
        "'yí' (一) is a digit of a decimal number, which is read digit by digit, so it keeps its first tone 'yī'"]
    # 一 counts before every measure word of the lists and before 百, 千, 万 and 亿, and it keeps "yī"
    # after 第 or a numeral.
    year = card("年", "nián", "nian2")
    assert check("一年有十二个月。", "yì nián yǒu shí'èr gè yuè.", year) == []
    assert check("一年有十二个月。", "yī nián yǒu shí'èr gè yuè.", year) == [
        "'yī' (一) counts with 年 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    assert check("两块钱一斤。", "liǎng kuài qián yī jīn.", card("两", "liǎng", "liang3")) == [
        "'yī' (一) counts with 斤 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    assert check("我有一千元。", "wǒ yǒu yīqiān yuán.", card("千", "qiān", "qian1")) == [
        "'yī' (一) counts with 千 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    assert check("我是第一次去。", "wǒ shì dì-yí cì qù.", card("第", "dì", "di4")) == [
        "'yí' (一) follows 第, so it is part of a number, an ordinal or a weekday and keeps its first tone 'yī'"]
    assert check("我有十一个。", "wǒ yǒu shíyí gè.", card("有", "yǒu", "you3")) == [
        "'yí' (一) follows 十, so it is part of a number, an ordinal or a weekday and keeps its first tone 'yī'"]
    # A neutral bu or yi only in a doubled word, a potential complement or a word that shows it.
    assert check("我不去。", "wǒ bu qù.", go) == [
        "'bu' (不) is in the neutral tone, which the style sheet keeps for a doubled word ('kàn yi kàn', "
        "'hǎo bu hǎo'), a potential complement ('zhǎo bu dào') and the words that a card or the public list "
        "writes so ('duìbuqǐ')"]
    assert len(check("我是一个学生。", "wǒ shì yi gè xuésheng.", card("是", "shì", "shi4"))) == 1
    assert check("你看一看。", "nǐ kàn yi kàn.", card("看", "kàn", "kan4")) == []
    assert check("他找不到家。", "tā zhǎo bu dào jiā.", card("到", "dào", "dao4")) == []
    assert check("差不多两块。", "chàbuduō liǎng kuài.", card("两", "liǎng", "liang3")) == []
    assert check("我们一起去。", "wǒmen yìqǐ qù.", go) == []


def test_what_points_1_and_2_write_as_one_word():
    person = card("人", "rén", "ren2")
    assert check("这个人很好。", "zhège rén hěn hǎo.", person) == []
    assert check("这个人很好。", "zhè gè rén hěn hǎo.", person) == [
        "这个 is written as one word (point 1 of the style sheet), but the line has 'zhè gè'"]
    # The card 个 keeps its "gè", so its sentence may write 这个 apart.
    assert check("这个人很好。", "zhè gè rén hěn hǎo.", card("个", "gè", "ge4")) == []
    now = card("现在", "xiànzài", "xian4 zai4")
    assert check("现在是十月。", "xiànzài shì shíyuè.", now) == []
    assert check("现在是十月。", "xiànzài shì shí yuè.", now) == [
        "十月 is written as one word (point 2 of the style sheet), but the line has 'shí yuè'"]
    today = card("今天", "jīntiān", "jin1 tian1")
    assert check("今天是八月九日。", "jīntiān shì bāyuè jiǔ rì.", today) == []
    assert check("今天星期五。", "jīntiān xīngqī wǔ.", today) == [
        "星期五 is written as one word (point 2 of the style sheet), but the line has 'xīngqī wǔ'"]


def test_the_headword_is_written_as_on_its_card():
    assert check("他在打电话呢。", "tā zài dǎ diànhuā ne.") == [
        "'huā' is not a reading of 话; its readings are huà",
        "the headword 打电话 must be written 'dǎ diànhuà' as on its card, but the line has 'dǎ diànhuā'"]
    assert check("他在打电话呢。", "tā zài dǎdiànhuà ne.") == [
        "the headword 打电话 must be written 'dǎ diànhuà' as on its card, but the line has 'dǎdiànhuà'"]
    # Only a 一 or 不 at the end of the headword may show its tone change.
    assert check("我不是学生。", "wǒ bú shì xuésheng.", card("学生", "xuésheng", "xue2 sheng5")) == []
    assert check("我不是学生。", "wǒ bú shì xuéshēng.", card("学生", "xuésheng", "xue2 sheng5")) == [
        "the headword 学生 must be written 'xuésheng' as on its card, but the line has 'xuéshēng'"]
    # The message quotes the line as written, apostrophe included.
    assert check("我在哪儿？", "wǒ zài nǎ'ér?", card("哪儿", "nǎr", "na3 r5")) == [
        "the headword 哪儿 must be written 'nǎr' as on its card, but the line has 'nǎ'ér'"]


def test_all_pinyin_is_in_lower_case():
    # The user's decision of 2026-09-29: no capital letter anywhere, not at the start of a sentence, not
    # after a colon and not on a name. Latin letters of the sentence keep their own capitals ("IT").
    assert check("他在打电话呢。", "tā zài dǎ diànhuà ne.") == []
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà ne.") == ["'Tā' (他) has a capital letter, but all pinyin is in lower case, the start of a sentence and names included"]
    assert check("他在打电话呢。", "tā zài dǎ diànhuà Ne.") == ["'Ne' (呢) has a capital letter, but all pinyin is in lower case, the start of a sentence and names included"]
    assert check("我爱北京。", "wǒ ài běijīng.", card("爱", "ài", "ai4")) == []
    assert check("我爱北京。", "wǒ ài Běijīng.", card("爱", "ài", "ai4")) == ["'Běijīng' (北京) has a capital letter, but all pinyin is in lower case, the start of a sentence and names included"]
    assert check("喂，李老师在吗？", "wèi, Lǐ lǎoshī zài ma?", card("喂", "wèi", "wei4")) == ["'Lǐ' (李) has a capital letter, but all pinyin is in lower case, the start of a sentence and names included"]
    assert check("他说：“你看。”", 'tā shuō: "Nǐ kàn."', card("说", "shuō", "shuo1")) == ["'Nǐ' (你) has a capital letter, but all pinyin is in lower case, the start of a sentence and names included"]
    assert check("他在打电话呢。", "tā zài dǎ diànHuà ne.") == ["'diànHuà' (电话) has a capital letter, but all pinyin is in lower case, the start of a sentence and names included"]
    assert check("要花一两个月。", "yào huā yì-Liǎng gè yuè.", card("要", "yào", "yao4")) == ["'Liǎng' (两) has a capital letter, but all pinyin is in lower case, the start of a sentence and names included"]
    assert check("这是IT工作。", "zhè shì IT gōngzuò.", card("工作", "gōngzuò", "gong1 zuo4")) == []
    names = {**NAMES, "小李": (["小", "李"], [True, True]), "李明": (["李", "明"], [True, True])}
    assert check("小李明天来。", "xiǎo lǐ míngtiān lái.", card("来", "lái", "lai2"), names) == []
    assert check("李明在北京。", "lǐ míng zài běijīng.", card("在", "zài", "zai4"), names) == []


def test_numbers_are_spaced_as_point_6_says():
    now = card("现在", "xiànzài", "xian4 zai4")
    assert check("现在十二点了。", "xiànzài shí'èr diǎn le.", now) == []
    assert check("现在十二点了。", "xiànzài shí èr diǎn le.", now) == [
        "the number 十二点 is written 'shí'èr diǎn' (point 6 of the style sheet), but the line has 'shí èr diǎn'"]
    assert check("我有一千元。", "wǒ yǒu yì qiān yuán.", card("有", "yǒu", "you3")) == [
        "the number 一千元 is written 'yìqiān yuán' (point 6 of the style sheet), but the line has 'yì qiān yuán'"]
    begin = card("开始", "kāishǐ", "kai1 shi3")
    assert check("从第十课开始。", "cóng dì-shí kè kāishǐ.", begin) == []
    assert check("从第十课开始。", "cóng dìshí kè kāishǐ.", begin) == [
        "the number 第十 is written 'dì-shí' (point 6 of the style sheet), but the line has 'dìshí'"]
    assert check("从第十课开始。", "cóng dì shí kè kāishǐ.", begin) == [
        "the number 第十 is written 'dì-shí' (point 6 of the style sheet), but the line has 'dì shí'"]
    less = card("少", "shǎo", "shao3")
    assert check("少了三分之一。", "shǎole sān fēn zhī yī.", less) == []
    assert check("少了三分之一。", "shǎole sānfēnzhīyī.", less) == [
        "the number 三分之一 is written 'sān fēn zhī yī' (point 6 of the style sheet), but the line has 'sānfēnzhīyī'"]
    assert check("我是一个学生。", "wǒ shì yígè xuésheng.", card("是", "shì", "shi4")) == [
        "the number 一个 is written 'yí gè' (point 6 of the style sheet), but the line has 'yígè'"]
    # The digits of a year are read one by one, 〇 included (GB/T 16159-2012 6.1.5.1).
    go = card("去", "qù", "qu4")
    assert check("二〇〇八年我去北京。", "èr líng líng bā nián wǒ qù běijīng.", go) == []
    assert check("二〇〇八年我去北京。", "èrlínglíngbā nián wǒ qù běijīng.", go) == [
        "the number 二〇〇八年 is written 'èr líng líng bā nián' (point 6 of the style sheet), but the line has "
        "'èrlínglíngbā nián'"]


def test_a_final_le_is_a_word_of_its_own():
    rain = card("了", "le", "le5")
    assert check("昨天下雨了。", "zuótiān xià yǔ le.", rain) == []
    assert check("昨天下雨了。", "zuótiān xià yǔle.", rain) == [
        "the 了 that ends a sentence or a clause is a word of its own ('xià yǔ le.', point 3 of the style sheet), "
        "but the line has 'yǔle'"]
    assert check("我去了北京。", "wǒ qùle běijīng.", card("去", "qù", "qu4")) == []


def test_the_zero_of_years_is_a_chinese_character():
    # 〇 (U+3007) is not in the main block of Chinese characters, but it lines up with "líng" like one.
    go = card("去", "qù", "qu4")
    assert check("我在二〇〇八年去北京。", "wǒ zài èr líng líng bā nián qù běijīng.", go) == []
    assert check("我在二〇〇八年去北京。", "wǒ zài èr 〇 〇 bā nián qù běijīng.", go) == [
        "the line holds Chinese characters (〇〇); write only pinyin"]
    assert known_readings({}, [])("〇") == {"ling2"}


def test_punctuation_digits_and_latin_letters_stay_as_they_are():
    assert check("他在打电话呢。", "tā zài dǎ diànhuà ne") == [
        "the sentence has the punctuation . but the line has none"]
    assert check("他在打电话呢。", "tā zài dǎ diànhuà ne!") == [
        "the sentence has the punctuation . but the line has !"]
    assert check("他在打电话呢。", "tā zài dǎ diànhuà ne .") == [
        "a space stands before '.', which is written right after the word before it"]
    today = card("今天", "jīntiān", "jin1 tian1")
    assert check("今天是2012年8月9日。", "jīntiān shì 2013 nián 8 yuè 9 rì.", today) == [
        "'2013' in the line is not in the sentence",
        "the digits or Latin letters '2012' of the sentence are missing or changed in the line"]
    assert check("这是IT工作。", "zhè shì It gōngzuò.", card("工作", "gōngzuò", "gong1 zuo4")) == [
        "the digits or Latin letters 'IT' of the sentence are missing or changed in the line"]
    assert check("他在打电话呢。", "tā zài dǎ diànhuà 呢.") == ["the line holds Chinese characters (呢); write only pinyin"]


def test_apostrophes_and_the_er_ending():
    daughter = card("女儿", "nǚ'ér", "nü3 er2")
    assert check("她是我的女儿。", "tā shì wǒ de nǚér.", daughter) == [
        "an apostrophe is missing before 'ér' in 'nǚér'"]
    assert segmentations("xī'ān") == [(["xī", "ān"], [])]
    assert segmentations("zhèr") == [(["zhè", "r"], [])]
    assert segmentations("Tiān'ānmén")[0] == (["Tiān", "ān", "mén"], [])
    assert line_items('tā shuō: "nǐ kàn." yì-liǎng') == [
        ("word", "tā", True), ("word", "shuō", True), ("mark", ":", False), ("mark", '"', True), ("word", "nǐ", False),
        ("word", "kàn", True), ("mark", ".", False), ("mark", '"', False), ("word", "yì", True), ("joint", "-", False),
        ("word", "liǎng", False)]


def test_the_characters_must_stay_as_given():
    given = {"id": "w0001", "sentence": "他在打电话呢。"}
    readings = lambda ch: READ.get(ch, set())
    assert check_answer(given, {"sentence": "他在打电话呢。", "py": "tā zài dǎ diànhuà ne."}, CALL, readings, NAMES,
                        FACTS) == []
    assert check_answer(given, {"sentence": "她在打电话呢。", "py": "tā zài dǎ diànhuà ne."}, CALL, readings, NAMES,
                        FACTS) == ["the Chinese sentence was changed at character 1, so copy it exactly as given"]
    assert check_answer(given, {"sentence": "他在打电话呢。", "py": " "}, CALL, readings, NAMES, FACTS) == [
        "the pinyin is empty"]


def test_known_readings_and_names():
    readings = known_readings({"银行": [{"py": "yín háng", "num": "yin2 hang2"}], "他": [{"py": "tā", "num": "ta1"}]},
                              [{"hz": "行", "pyNum": "xing2"}, {"hz": "受不了", "py": "shòubuliǎo", "pyNum": "shou4 bu4 liao3"}])
    assert {"xing2", "hang2"} <= readings("行") and {"er2", "r5"} <= readings("儿")
    # The list's own readings of 他 leave out pypinyin's rare tuo2. A character the list lacks takes pypinyin's.
    assert readings("他") == {"ta1"} and {"shi4", "ti2"} <= readings("是")
    assert readings("一") == {"yi1", "yi2", "yi4", "yi5"} and readings("不") == {"bu4", "bu2", "bu5"}
    # Since 2026-09-29 every card is in lower case, so the names whose words the checker spaces come
    # only from data/manual/capitals, from its rows with a Y.
    cards = [{"hz": "中国", "py": "zhōngguó"}, {"hz": "正月", "py": "zhēngyuè"}]
    table = {"李老师": (["李", "老师"], [True, False]), "美元": (["美元"], [False]), "北京": (["北京"], [True])}
    assert names_of(table, cards) == {"李老师": (["李", "老师"], [True, False]), "北京": (["北京"], [True])}
    # word_facts: measure words have the label m. (the public list's q), and 月 is left out because
    # month names are one word. A card shows its tone changes, a public-list word its neutral bu.
    assert {"个", "年", "斤", "次", "点", "元"} <= FACTS["measure"] and "月" not in FACTS["measure"]
    assert {"百", "千", "万", "亿"} <= FACTS["counted"] and "v." in FACTS["pos"]["找"]
    assert FACTS["shown"] == {"一": {("一起", 0, "yi4")}, "不": {("差不多", 1, "bu5")}}


def test_match_answers():
    inputs = [{"id": "w1"}, {"id": "w2"}, {"id": "w3"}]
    outputs = [{"id": "w1", "py": "a"}, {"id": "w2", "py": "b"}, {"id": "w2", "py": "c"}, {"id": "w9", "py": "d"}]
    got, problems = match_answers(inputs, outputs)
    assert list(got) == ["w1"] and problems == ["w9: not in the input", "w2: answered 2 times"]


def test_a_card_word_written_as_its_card_keeps_its_tone_change():
    # Known open item 3: a card that prints a tone change (一会儿 "yíhuìr") keeps it where the line
    # writes that card as its card does. Written as other words ("yào bu yào"), the card does not bind.
    come = card("来", "lái", "lai2")
    assert check("我一会儿就来。", "wǒ yíhuìr jiù lái.", come, facts=MORE_FACTS) == []
    assert check("我一会儿就来。", "wǒ yīhuìr jiù lái.", come, facts=MORE_FACTS) == [
        "'yī' (一) is part of 一会儿, which its card writes 'yíhuìr', so it is written 'yí'"]
    assert check("你要不要去？", "nǐ yào bu yào qù?", card("去", "qù", "qu4"), facts=MORE_FACTS) == []
    assert check("你要不去吗？", "nǐ yàobu qù ma?", card("去", "qù", "qu4"), facts=MORE_FACTS) == [
        "'bu' (不) is part of 要不, which its card writes 'yàobù', so it is written 'bù'"]


def test_a_potential_complement_may_have_a_neutral_bu():
    # Style sheet point 5 writes "zhǎo bu dào", but no rule of the sheet decides which verb + 不 + word
    # is a potential complement, so the checker allows the neutral bu there and does not require it.
    home = card("家", "jiā", "jia1")
    assert check("他找不到家。", "tā zhǎo bu dào jiā.", home, facts=MORE_FACTS) == []
    assert check("他找不到家。", "tā zhǎo bú dào jiā.", home, facts=MORE_FACTS) == []
    assert check("他考试不及格。", "tā kǎoshì bù jígé.", card("考试", "kǎoshì", "kao3 shi4"), facts=MORE_FACTS) == []

def test_yi_counts_before_a_measure_word_of_two_characters():
    # Known open item 3: 公斤 is a measure word of the public list, so 一公斤 is "yì gōngjīn".
    buy = card("买", "mǎi", "mai3")
    assert check("我买了一公斤。", "wǒ mǎile yì gōngjīn.", buy, facts=MORE_FACTS) == []
    assert check("我买了一公斤。", "wǒ mǎile yī gōngjīn.", buy, facts=MORE_FACTS) == [
        "'yī' (一) counts with 公斤 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before "
        "the other tones"]


def test_the_words_of_a_name_are_spaced_as_the_capitals_file_gives_them():
    # Known open item 5 and style sheet point 7: "lǐ lǎoshī" and "shāndōng shěng", each word of the name apart.
    hello = card("喂", "wèi", "wei4")
    assert check("喂，李老师在吗？", "wèi, lǐ lǎoshī zài ma?", hello) == []
    assert check("喂，李老师在吗？", "wèi, lǐlǎoshī zài ma?", hello) == [
        "the name 李老师 is written as the words 李 老师 (point 7 of the style sheet), but the line has 'lǐlǎoshī'"]
    me = card("我", "wǒ", "wo3")
    assert check("我来自山东省。", "wǒ láizì shāndōngshěng.", me) == [
        "the name 山东省 is written as the words 山东 省 (point 7 of the style sheet), but the line has "
        "'shāndōngshěng'"]
    assert check("我来自山东省。", "wǒ láizì shān dōng shěng.", me) == [
        "the name 山东省 is written as the words 山东 省 (point 7 of the style sheet), but the line has "
        "'shān dōng shěng'"]


def test_a_numeral_stands_apart_from_a_measure_word_of_two_characters():
    # Known open item 5 and style sheet point 6: "sān gōngjīn", as "sān gè".
    buy = card("买", "mǎi", "mai3")
    assert check("我买了三公斤。", "wǒ mǎile sān gōngjīn.", buy, facts=MORE_FACTS) == []
    assert check("我买了三公斤。", "wǒ mǎile sāngōngjīn.", buy, facts=MORE_FACTS) == [
        "the number 三公斤 is written 'sān gōngjīn' (point 6 of the style sheet), but the line has 'sāngōngjīn'"]


# Verbs of wishing, thinking and deciding, before which a 不 is a plain "not", and a card that ends in 不.
DECIDE_READ = {"希": {"xi1"}, "望": {"wang4"}, "觉": {"jue2", "jiao4"}, "得": {"de2", "de5", "dei3"},
               "够": {"gou4"}, "怕": {"pa4"}, "同": {"tong2"}, "意": {"yi4"}, "决": {"jue2"}, "定": {"ding4"},
               "出": {"chu1"}, "算": {"suan4"}, "回": {"hui2"}}
DECIDE_FACTS = word_facts([{"simplified": hz, "pos": tags} for hz, tags in
                           [("希望", ["v"]), ("觉得", ["v"]), ("怕", ["v"]), ("同意", ["v"]), ("决定", ["v"]),
                            ("打算", ["v"]), ("下", ["v"]), ("够", ["v"]), ("去", ["v"]), ("出去", ["v"]),
                            ("回去", ["v"]), ("找", ["v"]), ("到", ["v"])]],
                          {},
                          [{"hz": "不得不", "py": "bùdébù", "pyNum": "bu4 de2 bu4"}])


def decide(sentence, line, head):
    readings = lambda ch: READ.get(ch, set()) or MORE_READ.get(ch, set()) or DECIDE_READ.get(ch, set())
    return check_line(sentence, line, head, readings, NAMES, DECIDE_FACTS)


def test_a_bu_after_a_verb_of_wishing_or_deciding_keeps_its_full_tone():
    # No rule of the style sheet tells "cannot do" (找不到) from "decides not to" (决定不去), so the
    # checker does not require a neutral bu after a verb; it only allows one in a potential complement.
    me, he = card("我", "wǒ", "wo3"), card("他", "tā", "ta1")
    good = [("我希望不下雨。", "wǒ xīwàng bú xià yǔ.", me), ("我觉得不够。", "wǒ juéde bú gòu.", me),
            ("我怕不够。", "wǒ pà bú gòu.", me), ("他同意不去。", "tā tóngyì bú qù.", he),
            ("我决定不出去了。", "wǒ juédìng bù chūqu le.", me), ("我打算不回去。", "wǒ dǎsuàn bù huíqu.", me)]
    assert [decide(s, line, head) for s, line, head in good] == [[]] * len(good)
    assert decide("他找不到家。", "tā zhǎo bu dào jiā.", card("家", "jiā", "jia1")) == []


def test_a_card_that_ends_in_bu_may_show_its_tone_change():
    go = card("去", "qù", "qu4")
    assert decide("我不得不去。", "wǒ bùdébù qù.", go) == []
    assert decide("我不得不去。", "wǒ bùdébú qù.", go) == []
    assert decide("我不得不去。", "wǒ búdébú qù.", go) == [
        "'bú' (不) is part of 不得不, which its card writes 'bùdébù', so it is written 'bù'"]


# The user's decision of 2026-09-29 (Decision 2): 一 before a following syllable shows its spoken tone
# change, except in an ordinal or counting use, a number read digit by digit and at the end of a word.
YI_FACTS = word_facts([{"simplified": hz, "pos": tags} for hz, tags in
                       [("看", ["v"]), ("听", ["v"]), ("个", ["q"]), ("同一", ["b"]), ("年", ["qt", "n"]),
                        ("楼", ["n"]), ("点", ["q", "n"])]],
                      {}, [{"hz": "一起", "py": "yìqǐ", "pyNum": "yi1 qi3"},
                           {"hz": "统一", "py": "tǒngyī", "pyNum": "tong3 yi1"}])
YI_CHANGE = "so it shows its spoken tone change, 'yí' before a fourth tone and 'yì' before the other tones"


def test_yi_shows_its_tone_change_before_every_following_syllable():
    come = card("来", "lái", "lai2")
    yi = lambda sentence, line, head=come: check(sentence, line, head, facts=YI_FACTS)
    assert yi("他一看就来。", "tā yí kàn jiù lái.") == []
    assert yi("他一看就来。", "tā yī kàn jiù lái.") == [f"'yī' (一) comes before 'kàn', {YI_CHANGE}"]
    assert yi("他一听就来。", "tā yì tīng jiù lái.") == []
    assert yi("他一听就来。", "tā yī tīng jiù lái.") == [f"'yī' (一) comes before 'tīng', {YI_CHANGE}"]
    assert yi("我们一起来。", "wǒmen yìqǐ lái.") == []
    assert yi("我一个人来。", "wǒ yí gè rén lái.") == []
    assert yi("我一个人来。", "wǒ yī gè rén lái.") == [
        "'yī' (一) counts with 个 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    # The card 一 shows the tone change too where a syllable follows it in its own sentence.
    assert yi("他一看就来。", "tā yí kàn jiù lái.", card("一", "yī", "yi1")) == []
    assert yi("他一看就来。", "tā yī kàn jiù lái.", card("一", "yī", "yi1")) == [
        f"'yī' (一) comes before 'kàn', {YI_CHANGE}"]


def test_yi_keeps_its_first_tone_where_it_is_an_ordinal_a_digit_or_ends_a_word():
    come = card("来", "lái", "lai2")
    yi = lambda sentence, line, head=come: check(sentence, line, head, facts=YI_FACTS)
    # Ordinals and numbers, as point 6 writes 一百一十 "yìbǎi yīshí".
    assert yi("第一个来。", "dì-yī gè lái.") == []
    assert yi("十一个来。", "shíyī gè lái.") == []
    assert yi("一百一十个来。", "yìbǎi yīshí gè lái.") == []
    assert yi("一百一十个来。", "yìbǎi yìshí gè lái.") == [
        "'yì' (一) follows 百, so it is part of a number, an ordinal or a weekday and keeps its first tone 'yī'"]
    # A year or another number read digit by digit keeps "yī".
    assert yi("一九九八年来。", "yī jiǔ jiǔ bā nián lái.") == []
    assert yi("一九九八年来。", "yì jiǔ jiǔ bā nián lái.") == [
        "'yì' (一) is read digit by digit before 九, so it keeps its first tone 'yī'"]
    # A 一 at the end of a card or of a word of the public list may keep "yī" before the next word.
    assert yi("统一来。", "tǒngyī lái.", card("统一", "tǒngyī", "tong3 yi1")) == []
    assert yi("同一个人来。", "tóngyī gè rén lái.") == []
    # An ordinal or a date (一楼 "the first floor") and 一点 (one o'clock) leave the tone open.
    assert yi("一楼来。", "yī lóu lái.") == [] and yi("一楼来。", "yì lóu lái.") == []
    # A 一 that no syllable follows keeps "yī".
    assert yi("第一。", "dì-yī.", card("第", "dì", "di4")) == []


def test_yi_keeps_its_first_tone_in_arithmetic_and_in_month_names():
    come = card("来", "lái", "lai2")
    reads = {**READ, **MORE_READ, "加": {"jia1"}, "等": {"deng3"}, "于": {"yu2"}, "冷": {"leng3"}, "再": {"zai4"}}
    yi = lambda sentence, line, head=come: check_line(sentence, line, head, lambda ch: reads.get(ch, set()), NAMES,
                                                     YI_FACTS)
    two = card("二", "èr", "er4")
    assert yi("一加一等于二。", "yī jiā yī děngyú èr.", two) == []
    assert yi("一加一等于二。", "yì jiā yī děngyú èr.", two) == [
        "'yì' (一) is a number in arithmetic next to 加, so it keeps its first tone 'yī'"]
    assert yi("再加一个人来。", "zài jiā yí gè rén lái.") == []
    # 加 that starts a longer word of the line (加班 "jiābān") is not arithmetic (decision of 2026-09-29),
    # while 除以 and 乘以 are arithmetic words of their own.
    reads.update({"班": {"ban1"}, "除": {"chu2"}, "以": {"yi3"}})
    assert yi("他一加班就来。", "tā yì jiābān jiù lái.") == []
    assert yi("他一加班就来。", "tā yī jiābān jiù lái.") == [
        "'yī' (一) comes before 'jiā', so it shows its spoken tone change, 'yí' before a fourth tone and 'yì' "
        "before the other tones"]
    assert yi("一除以二等于二。", "yī chúyǐ èr děngyú èr.", two) == []
    cold = card("冷", "lěng", "leng3")
    assert yi("一月很冷。", "yīyuè hěn lěng.", cold) == []
    assert yi("十一月很冷。", "shíyīyuè hěn lěng.", cold) == []


def test_the_draft_and_the_checker_agree_on_yi():
    # The draft (sentpinyin.syllables with pinyin_text.tone_change) writes each line so the checker accepts it.
    from sentpinyin import render, syllables, word_joints
    table = {"他": ["ta1"], "一": ["yi1"], "看": ["kan4"], "就": ["jiu4"], "来": ["lai2"], "听": ["ting1"],
             "我": ["wo3"], "个": ["ge4"], "人": ["ren2"], "一口气": ["yi1", "kou3", "qi4"], "跑": ["pao3"],
             "一月": ["yi1", "yue4"], "十一月": ["shi2", "yi1", "yue4"], "很": ["hen3"], "冷": ["leng3"],
             "加": ["jia1"], "等于": ["deng3", "yu2"], "二": ["er4"], "是": ["shi4"], "第一": ["di4", "yi1"],
             "我们": ["wo3", "men5"], "统一": ["tong3", "yi1"], "去": ["qu4"], "一百": ["yi1", "bai3"],
             "一十": ["yi1", "shi2"], "九": ["jiu3"], "八": ["ba1"], "年": ["nian2"], "加班": ["jia1", "ban1"],
             "除以": ["chu2", "yi3"]}
    reads = {**READ, **MORE_READ, "加": {"jia1"}, "等": {"deng3"}, "于": {"yu2"}, "冷": {"leng3"}, "口": {"kou3"},
             "气": {"qi4"}, "跑": {"pao3"}, "班": {"ban1"}, "除": {"chu2"}, "以": {"yi3"}}
    samples = [("他一看就来。", ["他", "一", "看", "就", "来", "。"], "tā yí kàn jiù lái."),
               ("他一听就来。", ["他", "一", "听", "就", "来", "。"], "tā yì tīng jiù lái."),
               ("我一个人来。", ["我", "一", "个", "人", "来", "。"], "wǒ yí gè rén lái."),
               ("他一口气跑来。", ["他", "一口气", "跑", "来", "。"], "tā yìkǒuqì pǎo lái."),
               ("一月很冷。", ["一月", "很", "冷", "。"], "yīyuè hěn lěng."),
               ("十一月很冷。", ["十一月", "很", "冷", "。"], "shíyīyuè hěn lěng."),
               ("一加一等于二。", ["一", "加", "一", "等于", "二", "。"], "yī jiā yī děngyú èr."),
               ("他一加班就来。", ["他", "一", "加班", "就", "来", "。"], "tā yì jiābān jiù lái."),
               ("一除以二等于二。", ["一", "除以", "二", "等于", "二", "。"], "yī chúyǐ èr děngyú èr."),
               ("他是第一。", ["他", "是", "第一", "。"], "tā shì dì-yī."),
               ("我们统一去。", ["我们", "统一", "去", "。"], "wǒmen tǒngyī qù."),
               ("一百一十个人来。", ["一百", "一十", "个", "人", "来", "。"], "yìbǎi yīshí gè rén lái."),
               ("一九九八年来。", ["一", "九", "九", "八", "年", "来", "。"], "yī jiǔ jiǔ bā nián lái.")]
    head = card("来", "lái", "lai2")
    for sentence, words, want in samples:
        h = head if "来" in sentence else card("是", "shì", "shi4") if "是" in sentence else \
            card("很", "hěn", "hen3") if "很" in sentence else card("二", "èr", "er4") if "二" in sentence else \
            card("去", "qù", "qu4")
        sylls = syllables(sentence, words, lambda w: table[w], h["hz"], h["pyNum"].split(), counted=YI_FACTS["counted"])
        line = render(sentence, words, sylls, joints_of=lambda w: word_joints(w, {}))
        assert (sentence, line) == (sentence, want)
        assert (sentence, check_line(sentence, line, h, lambda ch: reads.get(ch, set()), NAMES, YI_FACTS)) == \
            (sentence, [])
