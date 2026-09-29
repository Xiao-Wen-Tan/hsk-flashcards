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
             "试": {"shi4"}, "及": {"ji2"}, "格": {"ge2"}, "福": {"fu2"}, "建": {"jian4"}, "统": {"tong3"}}
MORE_FACTS = word_facts([{"simplified": hz, "pos": tags} for hz, tags in
                         [("找", ["v"]), ("到", ["v"]), ("去", ["v"]), ("个", ["q"]), ("公斤", ["q"]),
                          ("考试", ["v", "n"]), ("试", ["v"]), ("及格", ["v"]), ("要", ["v"])]],
                        {},
                        [{"hz": "一会儿", "py": "yíhuìr", "pyNum": "yi1 hui4 r5"},
                         {"hz": "要不", "py": "yàobù", "pyNum": "yao4 bu4"},
                         {"hz": "一起", "py": "yìqǐ", "pyNum": "yi1 qi3"}])


def test_lines_that_follow_the_style_sheet_pass():
    good = [("他在打电话呢。", "Tā zài dǎ diànhuà ne.", CALL),
            ("我不是学生。", "Wǒ bú shì xuésheng.", card("不", "bù", "bu4")),
            ("这个人在哪儿？", "Zhège rén zài nǎr?", card("这", "zhè", "zhe4")),
            ("喂，李老师在吗？", "Wèi, Lǐ lǎoshī zài ma?", card("老师", "lǎoshī", "lao3 shi1")),
            ("我来自山东省。", "Wǒ láizì Shāndōng Shěng.", card("省", "shěng", "sheng3")),
            ("他说：“你看。”", 'Tā shuō: "Nǐ kàn."', card("说", "shuō", "shuo1")),
            ("今天是2012年8月9日。", "Jīntiān shì 2012 nián 8 yuè 9 rì.", card("今天", "jīntiān", "jin1 tian1")),
            ("它是三点一四。", "Tā shì sān diǎn yī sì.", card("三", "sān", "san1")),
            ("她是我的女儿。", "Tā shì wǒ de nǚ'ér.", card("女儿", "nǚ'ér", "nü3 er2")),
            ("我去过几十个国家。", "Wǒ qùguo jǐshí gè guójiā.", card("几", "jǐ", "ji3")),
            ("我有一点儿钱。", "Wǒ yǒu yìdiǎnr qián.", card("一点儿", "yìdiǎnr", "yi1 dian3 r5")),
            ("这是IT工作。", "Zhè shì IT gōngzuò.", card("工作", "gōngzuò", "gong1 zuo4")),
            ("他找不到家。", "Tā zhǎo bu dào jiā.", card("找", "zhǎo", "zhao3")),
            ("我爱北京。", "Wǒ ài Běijīng.", card("爱", "ài", "ai4")),
            ("虽然下雨了，但是我去。", "Suīrán xià yǔ le, dànshì wǒ qù.", card("虽然…但是…", "suīrán…dànshì…", "sui1 ran2 dan4 shi4"))]
    assert [check(s, line, head) for s, line, head in good] == [[]] * len(good)


def test_each_character_needs_one_syllable():
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà.") == [
        "the 6 characters 他在打电话呢 do not line up with the 5 syllables of 'Tā zài dǎ diànhuà'"]
    assert check("他在打电话呢。", "Tā zài zài dǎ diànhuà ne.") == [
        "the 6 characters 他在打电话呢 do not line up with the 7 syllables of 'Tā zài zài dǎ diànhuà ne'"]
    assert check("我有一点儿钱。", "Wǒ yǒu yìdiǎn r qián.", card("一点儿", "yìdiǎnr", "yi1 dian3 r5")) == [
        "'r' cannot be divided into pinyin syllables"]


def test_each_syllable_is_a_reading_of_its_character():
    assert check("他在打电话呢。", "Tā zhài dǎ diànhuà ne.") == ["'zhài' is not a reading of 在; its readings are zài"]
    assert check("很好。", "Hěn haǒ.", card("很", "hěn", "hen3")) == [
        "'haǒ' needs one tone mark on the right vowel, or none for the neutral tone"]


def test_tones_count_and_rare_readings_do_not():
    listed = {"他": [{"py": "tā", "num": "ta1"}], "是": [{"py": "shì", "num": "shi4"}],
              "在": [{"py": "zài", "num": "zai4"}], "学生": [{"py": "xué sheng", "num": "xue2 sheng5"}]}
    readings = known_readings(listed, [CALL])
    student = card("学生", "xuésheng", "xue2 sheng5")
    assert check_line("他是学生。", "Tā shì xuésheng.", student, readings, NAMES, FACTS) == []
    # pypinyin also knows 他 tuó and 是 tí, but the public list has only tā and shì.
    assert check_line("他是学生。", "Tuó tí xuésheng.", student, readings, NAMES, FACTS) == [
        "'Tuó' is not a reading of 他; its readings are tā", "'tí' is not a reading of 是; its readings are shì"]
    assert check_line("他在打电话呢。", "Tā zāi dǎ diànhuà ne.", CALL, readings, NAMES, FACTS) == [
        "'zāi' is not a reading of 在; its readings are zài"]
    # A neutral tone counts only inside a word ("xuésheng"), not at the start of one.
    assert check_line("他在打电话呢。", "Tā zai dǎ diànhuà ne.", CALL, readings, NAMES, FACTS) == [
        "'zai' is not a reading of 在 at the start of a word; its readings are zài"]


def test_the_tone_changes_of_yi_and_bu():
    go = card("去", "qù", "qu4")
    assert check("我不去。", "Wǒ bú qù.", go) == []
    assert check("我不去。", "Wǒ bù qù.", go) == ["'bù' (不) comes before the fourth tone of 'qù', so it is written 'bú'"]
    assert check("我不好。", "Wǒ bú hǎo.", card("好", "hǎo", "hao3")) == [
        "'bú' (不) is written 'bú' only before a fourth tone, so write 'bù' here"]
    assert check("我一个人去。", "Wǒ yí gè rén qù.", go) == []
    assert check("我一个人去。", "Wǒ yī gè rén qù.", go) == [
        "'yī' (一) counts with 个 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    assert check("我一个人去。", "Wǒ yì gè rén qù.", go) == [
        "'yì' (一) comes before the fourth tone of 'gè', so it is written 'yí'"]
    assert check("我是第一个。", "Wǒ shì dì-yī gè.", card("是", "shì", "shi4")) == []
    # A decimal is read digit by digit, and its 一 keeps the first tone (style sheet point 6).
    assert check("它是三点一四。", "Tā shì sān diǎn yí sì.", card("三", "sān", "san1")) == [
        "'yí' (一) is a digit of a decimal number, which is read digit by digit, so it keeps its first tone 'yī'"]
    # 一 counts before every measure word of the lists and before 百, 千, 万 and 亿, and it keeps "yī"
    # after 第 or a numeral.
    year = card("年", "nián", "nian2")
    assert check("一年有十二个月。", "Yì nián yǒu shí'èr gè yuè.", year) == []
    assert check("一年有十二个月。", "Yī nián yǒu shí'èr gè yuè.", year) == [
        "'Yī' (一) counts with 年 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    assert check("两块钱一斤。", "Liǎng kuài qián yī jīn.", card("两", "liǎng", "liang3")) == [
        "'yī' (一) counts with 斤 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    assert check("我有一千元。", "Wǒ yǒu yīqiān yuán.", card("千", "qiān", "qian1")) == [
        "'yī' (一) counts with 千 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before the "
        "other tones"]
    assert check("我是第一次去。", "Wǒ shì dì-yí cì qù.", card("第", "dì", "di4")) == [
        "'yí' (一) follows 第, so it is part of a number, an ordinal or a weekday and keeps its first tone 'yī'"]
    assert check("我有十一个。", "Wǒ yǒu shíyí gè.", card("有", "yǒu", "you3")) == [
        "'yí' (一) follows 十, so it is part of a number, an ordinal or a weekday and keeps its first tone 'yī'"]
    # A neutral bu or yi only in a doubled word, a potential complement or a word that shows it.
    assert check("我不去。", "Wǒ bu qù.", go) == [
        "'bu' (不) is in the neutral tone, which the style sheet keeps for a doubled word ('kàn yi kàn', "
        "'hǎo bu hǎo'), a potential complement ('zhǎo bu dào') and the words that a card or the public list "
        "writes so ('duìbuqǐ')"]
    assert len(check("我是一个学生。", "Wǒ shì yi gè xuésheng.", card("是", "shì", "shi4"))) == 1
    assert check("你看一看。", "Nǐ kàn yi kàn.", card("看", "kàn", "kan4")) == []
    assert check("他找不到家。", "Tā zhǎo bu dào jiā.", card("到", "dào", "dao4")) == []
    assert check("差不多两块。", "Chàbuduō liǎng kuài.", card("两", "liǎng", "liang3")) == []
    assert check("我们一起去。", "Wǒmen yìqǐ qù.", go) == []


def test_what_points_1_and_2_write_as_one_word():
    person = card("人", "rén", "ren2")
    assert check("这个人很好。", "Zhège rén hěn hǎo.", person) == []
    assert check("这个人很好。", "Zhè gè rén hěn hǎo.", person) == [
        "这个 is written as one word (point 1 of the style sheet), but the line has 'Zhè gè'"]
    # The card 个 keeps its "gè", so its sentence may write 这个 apart.
    assert check("这个人很好。", "Zhè gè rén hěn hǎo.", card("个", "gè", "ge4")) == []
    now = card("现在", "xiànzài", "xian4 zai4")
    assert check("现在是十月。", "Xiànzài shì shíyuè.", now) == []
    assert check("现在是十月。", "Xiànzài shì shí yuè.", now) == [
        "十月 is written as one word (point 2 of the style sheet), but the line has 'shí yuè'"]
    today = card("今天", "jīntiān", "jin1 tian1")
    assert check("今天是八月九日。", "Jīntiān shì bāyuè jiǔ rì.", today) == []
    assert check("今天星期五。", "Jīntiān xīngqī wǔ.", today) == [
        "星期五 is written as one word (point 2 of the style sheet), but the line has 'xīngqī wǔ'"]


def test_the_headword_is_written_as_on_its_card():
    assert check("他在打电话呢。", "Tā zài dǎ diànhuā ne.") == [
        "'huā' is not a reading of 话; its readings are huà",
        "the headword 打电话 must be written 'dǎ diànhuà' as on its card, but the line has 'dǎ diànhuā'"]
    assert check("他在打电话呢。", "Tā zài dǎdiànhuà ne.") == [
        "the headword 打电话 must be written 'dǎ diànhuà' as on its card, but the line has 'dǎdiànhuà'"]
    # Only a 一 or 不 at the end of the headword may show its tone change.
    assert check("我不是学生。", "Wǒ bú shì xuésheng.", card("学生", "xuésheng", "xue2 sheng5")) == []
    assert check("我不是学生。", "Wǒ bú shì xuéshēng.", card("学生", "xuésheng", "xue2 sheng5")) == [
        "the headword 学生 must be written 'xuésheng' as on its card, but the line has 'xuéshēng'"]
    # The message quotes the line as written, apostrophe included.
    assert check("我在哪儿？", "Wǒ zài nǎ'ér?", card("哪儿", "nǎr", "na3 r5")) == [
        "the headword 哪儿 must be written 'nǎr' as on its card, but the line has 'nǎ'ér'"]


def test_capitals_only_where_the_style_sheet_allows_them():
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà Ne.") == [
        "'Ne' (呢) starts with a capital, but the style sheet allows one only at the start of a sentence or of a "
        "quotation after a colon, and on a name that the cards or data/manual/capitals write with a capital"]
    assert check("他在打电话呢。", "tā zài dǎ diànhuà ne.") == ["'tā' (他) needs a capital, because it starts a sentence"]
    assert check("我爱北京。", "Wǒ ài běijīng.", card("爱", "ài", "ai4")) == [
        "'běijīng' (北京) needs a capital, because it starts the name 北京"]
    assert check("喂，李老师在吗？", "Wèi, Lǐ Lǎoshī zài ma?", card("喂", "wèi", "wei4")) == [
        "'Lǎoshī' (老师) starts with a capital, but the style sheet allows one only at the start of a sentence or of "
        "a quotation after a colon, and on a name that the cards or data/manual/capitals write with a capital"]
    assert check("他在打电话呢。", "Tā zài dǎ diànHuà ne.") == ["'diànHuà' has a capital letter inside the word"]
    # A name needs its capitals only where the line writes it as a name. In 小李明天来 the 明 of the
    # name 李明 starts the word 明天, so 明天 stays in lower case.
    names = {**NAMES, "小李": (["小", "李"], [True, True]), "李明": (["李", "明"], [True, True])}
    come = card("来", "lái", "lai2")
    assert check("小李明天来。", "Xiǎo Lǐ míngtiān lái.", come, names) == []
    assert check("小李明天来。", "Xiǎo Lǐ Míngtiān lái.", come, names) == [
        "'Míngtiān' (明天) starts with a capital, but the style sheet allows one only at the start of a sentence or "
        "of a quotation after a colon, and on a name that the cards or data/manual/capitals write with a capital"]
    assert check("李明在北京。", "Lǐ míng zài Běijīng.", card("在", "zài", "zai4"), names) == [
        "'míng' (明) needs a capital, because it starts the name 李明"]


def test_numbers_are_spaced_as_point_6_says():
    now = card("现在", "xiànzài", "xian4 zai4")
    assert check("现在十二点了。", "Xiànzài shí'èr diǎn le.", now) == []
    assert check("现在十二点了。", "Xiànzài shí èr diǎn le.", now) == [
        "the number 十二点 is written 'shí'èr diǎn' (point 6 of the style sheet), but the line has 'shí èr diǎn'"]
    assert check("我有一千元。", "Wǒ yǒu yì qiān yuán.", card("有", "yǒu", "you3")) == [
        "the number 一千元 is written 'yìqiān yuán' (point 6 of the style sheet), but the line has 'yì qiān yuán'"]
    begin = card("开始", "kāishǐ", "kai1 shi3")
    assert check("从第十课开始。", "Cóng dì-shí kè kāishǐ.", begin) == []
    assert check("从第十课开始。", "Cóng dìshí kè kāishǐ.", begin) == [
        "the number 第十 is written 'dì-shí' (point 6 of the style sheet), but the line has 'dìshí'"]
    assert check("从第十课开始。", "Cóng dì shí kè kāishǐ.", begin) == [
        "the number 第十 is written 'dì-shí' (point 6 of the style sheet), but the line has 'dì shí'"]
    less = card("少", "shǎo", "shao3")
    assert check("少了三分之一。", "Shǎole sān fēn zhī yī.", less) == []
    assert check("少了三分之一。", "Shǎole sānfēnzhīyī.", less) == [
        "the number 三分之一 is written 'sān fēn zhī yī' (point 6 of the style sheet), but the line has 'sānfēnzhīyī'"]
    assert check("我是一个学生。", "Wǒ shì yígè xuésheng.", card("是", "shì", "shi4")) == [
        "the number 一个 is written 'yí gè' (point 6 of the style sheet), but the line has 'yígè'"]
    # The digits of a year are read one by one, 〇 included (GB/T 16159-2012 6.1.5.1).
    go = card("去", "qù", "qu4")
    assert check("二〇〇八年我去北京。", "Èr líng líng bā nián wǒ qù Běijīng.", go) == []
    assert check("二〇〇八年我去北京。", "Èrlínglíngbā nián wǒ qù Běijīng.", go) == [
        "the number 二〇〇八年 is written 'Èr líng líng bā nián' (point 6 of the style sheet), but the line has "
        "'Èrlínglíngbā nián'"]


def test_a_final_le_is_a_word_of_its_own():
    rain = card("了", "le", "le5")
    assert check("昨天下雨了。", "Zuótiān xià yǔ le.", rain) == []
    assert check("昨天下雨了。", "Zuótiān xià yǔle.", rain) == [
        "the 了 that ends a sentence or a clause is a word of its own ('xià yǔ le.', point 3 of the style sheet), "
        "but the line has 'yǔle'"]
    assert check("我去了北京。", "Wǒ qùle Běijīng.", card("去", "qù", "qu4")) == []


def test_the_zero_of_years_is_a_chinese_character():
    # 〇 (U+3007) is not in the main block of Chinese characters, but it lines up with "líng" like one.
    go = card("去", "qù", "qu4")
    assert check("我在二〇〇八年去北京。", "Wǒ zài èr líng líng bā nián qù Běijīng.", go) == []
    assert check("我在二〇〇八年去北京。", "Wǒ zài èr 〇 〇 bā nián qù Běijīng.", go) == [
        "the line holds Chinese characters (〇〇); write only pinyin"]
    assert known_readings({}, [])("〇") == {"ling2"}


def test_punctuation_digits_and_latin_letters_stay_as_they_are():
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà ne") == [
        "the sentence has the punctuation . but the line has none"]
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà ne!") == [
        "the sentence has the punctuation . but the line has !"]
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà ne .") == [
        "a space stands before '.', which is written right after the word before it"]
    today = card("今天", "jīntiān", "jin1 tian1")
    assert check("今天是2012年8月9日。", "Jīntiān shì 2013 nián 8 yuè 9 rì.", today) == [
        "'2013' in the line is not in the sentence",
        "the digits or Latin letters '2012' of the sentence are missing or changed in the line"]
    assert check("这是IT工作。", "Zhè shì It gōngzuò.", card("工作", "gōngzuò", "gong1 zuo4")) == [
        "the digits or Latin letters 'IT' of the sentence are missing or changed in the line"]
    assert check("他在打电话呢。", "Tā zài dǎ diànhuà 呢.") == ["the line holds Chinese characters (呢); write only pinyin"]


def test_apostrophes_and_the_er_ending():
    daughter = card("女儿", "nǚ'ér", "nü3 er2")
    assert check("她是我的女儿。", "Tā shì wǒ de nǚér.", daughter) == [
        "an apostrophe is missing before 'ér' in 'nǚér'"]
    assert segmentations("xī'ān") == [(["xī", "ān"], [])]
    assert segmentations("zhèr") == [(["zhè", "r"], [])]
    assert segmentations("Tiān'ānmén")[0] == (["Tiān", "ān", "mén"], [])
    assert line_items('Tā shuō: "Nǐ kàn." yì-liǎng') == [
        ("word", "Tā", True), ("word", "shuō", True), ("mark", ":", False), ("mark", '"', True), ("word", "Nǐ", False),
        ("word", "kàn", True), ("mark", ".", False), ("mark", '"', False), ("word", "yì", True), ("joint", "-", False),
        ("word", "liǎng", False)]


def test_the_characters_must_stay_as_given():
    given = {"id": "w0001", "sentence": "他在打电话呢。"}
    readings = lambda ch: READ.get(ch, set())
    assert check_answer(given, {"sentence": "他在打电话呢。", "py": "Tā zài dǎ diànhuà ne."}, CALL, readings, NAMES,
                        FACTS) == []
    assert check_answer(given, {"sentence": "她在打电话呢。", "py": "Tā zài dǎ diànhuà ne."}, CALL, readings, NAMES,
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
    cards = [{"hz": "中国", "py": "Zhōngguó"}, {"hz": "正月", "py": "zhēngyuè"}]
    table = {"李老师": (["李", "老师"], [True, False]), "美元": (["美元"], [False])}
    assert names_of(table, cards) == {"李老师": (["李", "老师"], [True, False]), "中国": (["中国"], [True])}
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
    assert check("我一会儿就来。", "Wǒ yíhuìr jiù lái.", come, facts=MORE_FACTS) == []
    assert check("我一会儿就来。", "Wǒ yīhuìr jiù lái.", come, facts=MORE_FACTS) == [
        "'yī' (一) is part of 一会儿, which its card writes 'yíhuìr', so it is written 'yí'"]
    assert check("你要不要去？", "Nǐ yào bu yào qù?", card("去", "qù", "qu4"), facts=MORE_FACTS) == []
    assert check("你要不去吗？", "Nǐ yàobu qù ma?", card("去", "qù", "qu4"), facts=MORE_FACTS) == [
        "'bu' (不) is part of 要不, which its card writes 'yàobù', so it is written 'bù'"]


def test_a_potential_complement_may_have_a_neutral_bu():
    # Style sheet point 5 writes "zhǎo bu dào", but no rule of the sheet decides which verb + 不 + word
    # is a potential complement, so the checker allows the neutral bu there and does not require it.
    home = card("家", "jiā", "jia1")
    assert check("他找不到家。", "Tā zhǎo bu dào jiā.", home, facts=MORE_FACTS) == []
    assert check("他找不到家。", "Tā zhǎo bú dào jiā.", home, facts=MORE_FACTS) == []
    assert check("他考试不及格。", "Tā kǎoshì bù jígé.", card("考试", "kǎoshì", "kao3 shi4"), facts=MORE_FACTS) == []

def test_yi_counts_before_a_measure_word_of_two_characters():
    # Known open item 3: 公斤 is a measure word of the public list, so 一公斤 is "yì gōngjīn".
    buy = card("买", "mǎi", "mai3")
    assert check("我买了一公斤。", "Wǒ mǎile yì gōngjīn.", buy, facts=MORE_FACTS) == []
    assert check("我买了一公斤。", "Wǒ mǎile yī gōngjīn.", buy, facts=MORE_FACTS) == [
        "'yī' (一) counts with 公斤 here, so it shows its tone change, 'yí' before a fourth tone and 'yì' before "
        "the other tones"]


def test_the_words_of_a_name_are_spaced_as_the_capitals_file_gives_them():
    # Known open item 5 and style sheet point 7: "Lǐ lǎoshī" and "Shāndōng Shěng", each word of the name apart.
    hello = card("喂", "wèi", "wei4")
    assert check("喂，李老师在吗？", "Wèi, Lǐ lǎoshī zài ma?", hello) == []
    assert check("喂，李老师在吗？", "Wèi, Lǐlǎoshī zài ma?", hello) == [
        "the name 李老师 is written as the words 李 老师 (point 7 of the style sheet), but the line has 'Lǐlǎoshī'"]
    me = card("我", "wǒ", "wo3")
    assert check("我来自山东省。", "Wǒ láizì Shāndōngshěng.", me) == [
        "the name 山东省 is written as the words 山东 省 (point 7 of the style sheet), but the line has "
        "'Shāndōngshěng'"]
    assert check("我来自山东省。", "Wǒ láizì Shān dōng Shěng.", me) == [
        "the name 山东省 is written as the words 山东 省 (point 7 of the style sheet), but the line has "
        "'Shān dōng Shěng'"]


def test_a_numeral_stands_apart_from_a_measure_word_of_two_characters():
    # Known open item 5 and style sheet point 6: "sān gōngjīn", as "sān gè".
    buy = card("买", "mǎi", "mai3")
    assert check("我买了三公斤。", "Wǒ mǎile sān gōngjīn.", buy, facts=MORE_FACTS) == []
    assert check("我买了三公斤。", "Wǒ mǎile sāngōngjīn.", buy, facts=MORE_FACTS) == [
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
    good = [("我希望不下雨。", "Wǒ xīwàng bú xià yǔ.", me), ("我觉得不够。", "Wǒ juéde bú gòu.", me),
            ("我怕不够。", "Wǒ pà bú gòu.", me), ("他同意不去。", "Tā tóngyì bú qù.", he),
            ("我决定不出去了。", "Wǒ juédìng bù chūqu le.", me), ("我打算不回去。", "Wǒ dǎsuàn bù huíqu.", me)]
    assert [decide(s, line, head) for s, line, head in good] == [[]] * len(good)
    assert decide("他找不到家。", "Tā zhǎo bu dào jiā.", card("家", "jiā", "jia1")) == []


def test_a_card_that_ends_in_bu_may_show_its_tone_change():
    go = card("去", "qù", "qu4")
    assert decide("我不得不去。", "Wǒ bùdébù qù.", go) == []
    assert decide("我不得不去。", "Wǒ bùdébú qù.", go) == []
    assert decide("我不得不去。", "Wǒ búdébú qù.", go) == [
        "'bú' (不) is part of 不得不, which its card writes 'bùdébù', so it is written 'bù'"]
