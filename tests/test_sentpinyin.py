from pinyin_text import IDIOM_JOINTS
from sentpinyin import (POINTING_WORDS, attached, check_polyphone_answers, decimal_digits, decimal_positions,
                        head_positions, make_lookup, name_words, number_words, potential_readings, public_word_readings,
                        regroup, render, segment, spot_checks, split_words, syllables, word_joints)

TABLE = {"我": ["wo3"], "爱": ["ai4"], "的": ["de5"], "家": ["jia1"], "你好": ["ni3", "hao3"], "他": ["ta1"],
         "说": ["shuo1"], "不": ["bu4"], "去": ["qu4"], "统一": ["tong3", "yi1"], "中国": ["zhong1", "guo2"],
         "一": ["yi1"], "个": ["ge4"], "人": ["ren2"], "北京": ["bei3", "jing1"], "长": ["chang2"], "大": ["da4"],
         "了": ["le5"], "不客气": ["bu4", "ke4", "qi5"], "拔苗助长": ["ba2", "miao2", "zhu4", "zhang3"], "好": ["hao3"],
         "看": ["kan4"], "足球": ["zu2", "qiu2"], "比赛": ["bi3", "sai4"], "黄河": ["huang2", "he2"],
         "父亲": ["fu4", "qin5"], "今年": ["jin1", "nian2"], "八十三": ["ba1", "shi2", "san1"], "岁": ["sui4"],
         "是": ["shi4"], "二": ["er4"], "零": ["ling2"], "年": ["nian2"], "要": ["yao4"], "花": ["hua1"],
         "一两": ["yi1", "liang3"], "月": ["yue4"], "喂": ["wei4"], "李": ["li3"], "老师": ["lao3", "shi1"],
         "在": ["zai4"], "吗": ["ma5"], "指": ["zhi3"], "着": ["zhe5"], "你": ["ni3"], "小": ["xiao3"],
         "王": ["wang2"], "来": ["lai2"], "汽车": ["qi4", "che1"], "停": ["ting2"], "下来": ["xia4", "lai5"],
         "从": ["cong2"], "第十": ["di4", "shi2"], "课": ["ke4"], "开始": ["kai1", "shi3"], "我们": ["wo3", "men5"],
         "用": ["yong4"], "两": ["liang3"], "小时": ["xiao3", "shi2"], "睡": ["shui4"]}
CARDS = {"不客气": [" ", ""], "拔苗助长": IDIOM_JOINTS, "比赛": [""], "三": [], "分之": [""], "一": [], "科学": [""],
         "黄河": [" "], "千万": [""]}
KNOWN = set(CARDS) | {"足球", "科学家", "个", "很", "多", "本", "书", "坐", "在", "看", "去", "过", "同学", "们", "别",
                      "忘", "了", "这", "点", "不", "但", "十", "百", "千", "万", "亿", "零", "两", "二", "八", "九",
                      "七", "五", "岁", "家", "名", "页", "课", "年", "市场", "经济", "通货", "膨胀", "几", "节", "西",
                      "班", "牙", "日", "桃", "子", "企业", "我", "国", "篇", "文章", "张", "开", "睡", "记", "清楚",
                      "找", "到"}
POS = {"一": ["num."], "三": ["num."], "个": ["m."], "很": ["adv."], "多": ["adj."], "本": ["pron.", "m."],
       "书": ["n."], "坐": ["v."], "在": ["prep.", "v."], "看": ["v."], "去": ["v."], "别": ["adv."], "忘": ["v."],
       "这": ["pron."], "点": ["m."], "不": ["adv."], "但": ["conj."], "八": ["num."], "七": ["num."], "岁": ["m."],
       "名": ["m."], "家": ["n.", "m."], "年": ["m.", "n."], "几": ["num."], "节": ["n.", "m."], "班": ["n.", "m."],
       "日": ["n.", "m."], "子": ["m."], "企业": ["n."], "我": ["pron."], "国": ["n."], "篇": ["m."], "文章": ["n."],
       "张": ["m.", "v."], "开": ["v."], "用": ["v.", "prep."], "见": ["v."], "要": ["v."], "来": ["v."],
       "睡": ["v."], "记": ["v."], "找": ["v."], "说": ["v."], "到": ["v.", "prep."], "他": ["pron."], "买": ["v."]}
FORMS = {"市场经济": ("words", ["市场", "经济"]), "土生土长": ("idiom", []), "二氧化碳": ("joined", [])}


def lookup(word):
    return TABLE[word]


def pinyin(sentence, words, hz, head_nums, caps=(), fixes=None, joints_of=None):
    return render(sentence, words, syllables(sentence, words, lookup, hz, head_nums, fixes), caps, joints_of)


def test_plain_sentence():
    assert pinyin("我爱我的家。", ["我", "爱", "我", "的", "家", "。"], "爱", ["ai4"]) == "wǒ ài wǒ de jiā."


def test_quotes_and_names_in_lower_case():
    # The user decided on 2026-09-29 that all pinyin is in lower case, the start of a sentence and names included.
    assert pinyin("“你好”他说。", ["“", "你好", "”", "他", "说", "。"], "说", ["shuo1"]) == '"nǐhǎo" tā shuō.'
    assert pinyin("我爱北京。", ["我", "爱", "北京", "。"], "北京", ["bei3", "jing1"], caps={2}) == "wǒ ài běijīng."
    spaced = lambda word: word_joints(word, CARDS)
    assert pinyin("我看黄河。", ["我", "看", "黄河", "。"], "看", ["kan4"], caps={2}, joints_of=spaced) == \
        "wǒ kàn huáng hé."


def test_a_quotation_after_a_colon_is_in_lower_case_and_names_are_written_apart():
    sentence = "他指着前面，高兴地说：“你看，小王来了。”"
    jieba_words = ["他", "指", "着", "前面", "，", "高兴", "地", "说", "：", "“", "你", "看", "，", "小王", "来", "了", "。",
                   "”"]
    words, caps = name_words(sentence, jieba_words, {"小王": (["小", "王"], [True, True])})
    assert caps == {15, 16}
    table = {**TABLE, "前面": ["qian2", "mian4"], "高兴": ["gao1", "xing4"], "地": ["de5"]}
    sylls = syllables(sentence, words, lambda w: table[w], "指", ["zhi3"])
    attach = attached(words, {**POS, "指": ["v."]})
    assert render(sentence, words, sylls, caps, attach=attach) == \
        'tā zhǐzhe qiánmiàn, gāoxìng de shuō: "nǐ kàn, xiǎo wáng lái le."'


def test_a_surname_and_a_given_name_are_two_words_and_a_title_stands_apart():
    names = {"李老师": (["李", "老师"], [True, False]), "张先生": (["张", "先生"], [True, False]),
             "李明": (["李", "明"], [True, True])}
    words, caps = name_words("喂，李老师在吗？", ["喂", "，", "李老师", "在", "吗", "？"], names)
    assert (words, caps) == (["喂", "，", "李", "老师", "在", "吗", "？"], {2})
    assert pinyin("喂，李老师在吗？", words, "喂", ["wei4"], caps=caps) == "wèi, lǐ lǎoshī zài ma?"
    assert name_words("遇到了张先生。", ["遇到", "了", "张", "先生", "。"], names)[1] == {3}
    assert name_words("我叫李明。", ["我", "叫", "李明", "。"], names) == (["我", "叫", "李", "明", "。"], {2, 3})
    assert name_words("这是李子。", ["这", "是", "李子", "。"], names)[1] == set()


def test_tone_changes_cross_words_but_respect_word_ends():
    assert pinyin("我不去。统一中国！", ["我", "不", "去", "。", "统一", "中国", "！"], "统一", ["tong3", "yi1"]) == \
        "wǒ bú qù. tǒngyī zhōngguó!"
    assert pinyin("一个人长大了。", ["一", "个", "人", "长", "大", "了", "。"], "一", ["yi1"]) == "yí gè rén cháng dà le."


def test_headword_reading_is_forced_and_fixes_apply_last():
    words = ["一", "个", "人", "长", "大", "了", "。"]
    assert pinyin("一个人长大了。", words, "长", ["zhang3"]) == "yí gè rén zhǎng dà le."
    assert pinyin("一个人长大了。", words, "一", ["yi1"], fixes={3: "zhang3"}) == "yí gè rén zhǎng dà le."
    table = {**TABLE, "开心": ["kai1", "xin1"], "得": ["de5"], "不得了": ["bu4", "de2", "liao3"]}
    words = ["开心", "得", "不得了", "。"]
    sylls = syllables("开心得不得了。", words, lambda w: table[w], "不得了", ["bu4", "de2", "liao3"])
    assert render("开心得不得了。", words, sylls) == "kāixīn de bùdéliǎo."


def test_words_are_spaced_like_the_cards():
    spaced = lambda word: word_joints(word, CARDS)
    assert pinyin("他说不客气。", ["他", "说", "不客气", "。"], "说", ["shuo1"], joints_of=spaced) == "tā shuō bú kèqi."
    assert pinyin("拔苗助长不好。", ["拔苗助长", "不", "好", "。"], "好", ["hao3"], joints_of=spaced) == \
        "bámiáo-zhùzhǎng bù hǎo."
    words = split_words(["我", "看", "足球比赛", "。"], KNOWN, POS)
    assert pinyin("我看足球比赛。", words, "看", ["kan4"], joints_of=spaced) == "wǒ kàn zúqiú bǐsài."


def test_split_words():
    assert split_words(["一个", "很多", "本书", "坐在", "这点儿"], KNOWN, POS) == \
        ["一", "个", "很", "多", "本", "书", "坐", "在", "这点儿"]
    # A fraction is written syllable by syllable ("sān fēn zhī yī"), as GB/T 16159-2012 6.1.5.1 writes 二分之一.
    assert split_words(["足球比赛", "三分之一", "科学家", "英国"], KNOWN, POS) == \
        ["足球", "比赛", "三", "分", "之", "一", "科学家", "英国"]
    assert split_words(["三", "分之", "一"], KNOWN, POS) == ["三", "分", "之", "一"]
    assert split_words(["三", "分之", "一"], KNOWN, POS, keep={"分之"}) == ["三", "分之", "一"]
    assert split_words(["看书", "看看", "去过", "同学们", "别忘了", "看"], KNOWN, POS) == \
        ["看书", "看看", "去过", "同学们", "别", "忘了", "看"]
    assert split_words(["不但"], KNOWN, POS, keep={"不但"}) == ["不但"]
    # Names and words with a suffix stay whole, even when a piece can be a measure word (班, 本, 子, 家).
    # 我 stands apart from a noun, as the rules write 我校 "wǒ xiào".
    assert split_words(["西班牙", "日本", "桃子", "企业家", "我国", "五一节"], KNOWN, POS) == \
        ["西班牙", "日本", "桃子", "企业家", "我", "国", "五一节"]
    # A measure word is apart from its noun only after a number or a word such as 这.
    assert split_words(["一", "篇文章", "他", "张开"], KNOWN, POS) == ["一", "篇", "文章", "他", "张开"]


def test_short_words_that_are_one_word_stay_whole():
    known = KNOWN | {"歌唱", "面", "孔", "有", "差", "热", "天", "体育", "迷", "喝", "杯", "茶", "买"}
    pos = {**POS, "歌唱": ["v."], "面": ["n.", "m.", "v."], "孔": ["n.", "m."], "有": ["v."], "差": ["adj.", "v."],
           "热": ["adj.", "n.", "v."], "天": ["m.", "n."], "体育": ["n."], "迷": ["v."], "喝": ["v."], "杯": ["m."],
           "茶": ["n."]}
    # 家, 迷 and 品 stay in the word of a noun or verb of two characters, and a first piece that is
    # first a noun or an adjective (面, 热) is not read as a verb with a measure word after it.
    assert split_words(["歌唱家", "面孔", "有点", "差点", "热天", "体育迷"], known, pos) == \
        ["歌唱家", "面孔", "有点", "差点", "热天", "体育迷"]
    # A verb of one character still stands apart from a measure word or 点 after it, and 把 from a noun.
    known |= {"把", "门"}
    pos.update({"把": ["prep.", "m.", "v."], "门": ["n.", "m."]})
    assert split_words(["喝杯", "茶", "买点儿", "把门", "关上"], known, pos) == \
        ["喝", "杯", "茶", "买", "点儿", "把", "门", "关上"]


def test_four_character_words_take_their_form():
    words = split_words(["积极", "的", "市场经济", "是", "中国", "土生土长", "的"], KNOWN, POS, forms=FORMS)
    assert words == ["积极", "的", "市场", "经济", "是", "中国", "土生土长", "的"]
    fixed = {**CARDS, "土生土长": IDIOM_JOINTS, "二氧化碳": ["", "", ""]}
    assert [word_joints(w, fixed) for w in ["土生土长", "二氧化碳"]] == [IDIOM_JOINTS, ["", "", ""]]


def test_number_words():
    assert number_words("三十三") == ["三十三"]
    assert number_words("九亿七万二千三百五十六") == ["九亿", "七万", "二千", "三百", "五十六"]
    assert number_words("一百零一") == ["一百", "零", "一"]
    assert number_words("二十亿") == ["二十", "亿"]
    assert number_words("十万") == ["十万"]
    assert number_words("二零一二") == ["二", "零", "一", "二"]
    assert number_words("两三") == ["两三"]
    assert [number_words("十几"), number_words("几十")] == [["十几"], ["几十"]]


def test_numbers_in_real_sentences():
    # 我父亲今年八十三岁了。 他现在拥有九百七十家连锁食品店。 这部辞典将扩充到一千五百页。 我们从第十课开始学习。
    assert split_words(["我", "父亲", "今年", "八十三岁", "了", "。"], KNOWN, POS) == \
        ["我", "父亲", "今年", "八十三", "岁", "了", "。"]
    assert split_words(["九百", "七十家"], KNOWN, POS) == ["九百", "七十", "家"]
    assert split_words(["一千五百", "页"], KNOWN, POS) == ["一千", "五百", "页"]
    assert split_words(["从", "第十课"], KNOWN, POS) == ["从", "第十", "课"]
    assert split_words(["超过", "二十亿", "人"], KNOWN, POS) == ["超过", "二十", "亿", "人"]
    assert split_words(["千万", "别", "忘"], KNOWN, POS) == ["千万", "别", "忘"]
    words = split_words(["我", "父亲", "今年", "八十三岁", "了", "。"], KNOWN, POS)
    assert pinyin("我父亲今年八十三岁了。", words, "父亲", ["fu4", "qin5"]) == "wǒ fùqin jīnnián bāshísān suì le."
    words = split_words(["今年", "是", "二零", "一二年", "。"], KNOWN, POS)
    assert words == ["今年", "是", "二", "零", "一", "二", "年", "。"]
    assert pinyin("今年是二零一二年。", words, "零", ["ling2"]) == "jīnnián shì èr líng yī èr nián."
    spaced = lambda word: word_joints(word, CARDS)
    words = split_words(["要", "花", "一两个", "月", "。"], KNOWN, POS)
    assert pinyin("要花一两个月。", words, "花", ["hua1"], joints_of=spaced) == "yào huā yì-liǎng gè yuè."
    words = split_words(["我们", "从", "第十课", "开始", "。"], KNOWN, POS)
    assert pinyin("我们从第十课开始。", words, "开始", ["kai1", "shi3"], joints_of=spaced) == \
        "wǒmen cóng dì-shí kè kāishǐ."
    # 我爱旅游，去过几十个国家。 这个火车有十几节车厢。
    assert split_words(["去过", "几十个", "国家"], KNOWN, POS) == ["去过", "几十", "个", "国家"]
    assert split_words(["有", "十几节", "车厢"], KNOWN, POS) == ["有", "十几", "节", "车厢"]


def test_decimals_rough_numbers_and_the_dash():
    known = KNOWN | {"四", "米", "刻", "好"}
    pos = {**POS, "四": ["num."], "米": ["m."], "刻": ["m."]}
    table = {**TABLE, "三": ["san1"], "点": ["dian3"], "四": ["si4"], "米": ["mi3"], "刻": ["ke4"]}
    look = lambda w: table[w]
    # A decimal is read digit by digit, and its 一 keeps the first tone ("sān diǎn yī sì", "líng diǎn yī mǐ"),
    # while 三点一刻 is a time of day ("sān diǎn yí kè").
    words = split_words(["是", "三点", "一", "四", "。"], known, pos)
    assert words == ["是", "三", "点", "一", "四", "。"] and decimal_digits(words) == {1, 3, 4}
    assert render("是三点一四。", words, syllables("是三点一四。", words, look, "是", ["shi4"])) == "shì sān diǎn yī sì."
    words = split_words(["零点", "一米", "。"], known, pos)
    assert render("零点一米。", words, syllables("零点一米。", words, look, "零", ["ling2"])) == "líng diǎn yī mǐ."
    words = split_words(["是", "三点", "一刻", "。"], known, pos)
    assert words == ["是", "三", "点", "一", "刻", "。"] and decimal_digits(words) == set()
    assert render("是三点一刻。", words, syllables("是三点一刻。", words, look, "是", ["shi4"])) == "shì sān diǎn yí kè."
    # 几十 stays one number word after 好, as 十几 and 几十 do everywhere ("hǎo jǐshí gè rén").
    assert split_words(["来", "了", "好几十个", "人"], known | {"好几"}, pos) == ["来", "了", "好", "几十", "个", "人"]
    # The Chinese dash, two long dashes, is one mark "-", even when the segmenter cuts it in two.
    words = ["我", "\u2014", "\u2014", "你", "。"]
    sentence = "我\u2014\u2014你。"
    assert render(sentence, words, syllables(sentence, words, lookup, "你", ["ni3"])) == "wǒ - nǐ."


def test_month_and_weekday_names_and_pointing_words_are_one_word():
    table = {**TABLE, "今天": ["jin1", "tian1"], "八": ["ba1"], "九": ["jiu3"], "日": ["ri4"], "星期": ["xing1", "qi1"],
             "五": ["wu3"], "下午": ["xia4", "wu3"]}
    look = lambda w: table[w]
    # Point 2 of the style sheet: a month or weekday name is one word, and the day number stands apart.
    words = ["今天", "是", "八", "月", "九", "日", "。"]
    assert attached(words, POS) == {4}
    sylls = syllables("今天是八月九日。", words, look, "九", ["jiu3"])
    assert render("今天是八月九日。", words, sylls, attach=attached(words, POS)) == "jīntiān shì bāyuè jiǔ rì."
    words = ["今天", "星期", "五", "。"]  # the headword 五 cut jieba's 星期五
    sylls = syllables("今天星期五。", words, look, "五", ["wu3"])
    assert render("今天星期五。", words, sylls, attach=attached(words, POS)) == "jīntiān xīngqīwǔ."
    # The 一 of 星期一 keeps its first tone when the headword 星期 cuts it off.
    words = ["星期", "一", "下午", "。"]
    sylls = syllables("星期一下午。", words, look, "星期", ["xing1", "qi1"])
    assert render("星期一下午。", words, sylls, attach=attached(words, POS)) == "xīngqīyī xiàwǔ."
    assert attached(["三", "个", "月"], POS) == set() and attached(["几", "月"], POS) == set()
    # Point 1: step 8 adds 这个, 那个 and 哪个 to the known words, so they stay whole and are read "zhège".
    assert POINTING_WORDS["这个"] == "zhe4 ge5"
    assert split_words(["这个", "人"], KNOWN | set(POINTING_WORDS), POS) == ["这个", "人"]
    assert regroup("这个人。", ["这个", "人", "。"], "这", known=set(POINTING_WORDS)) == ["这个", "人", "。"]


def test_the_zero_of_years_is_read_ling():
    # 〇 (U+3007), the zero of years, lies outside the main block of Chinese characters, and jieba cuts it
    # off as a mark. It is read líng like any character, and the digits of a year stand apart, as
    # GB/T 16159-2012 6.1.5.1 writes 二〇〇八年 "èr líng líng bā nián".
    table = {**TABLE, "〇": ["ling2"], "八": ["ba1"]}
    words = split_words(["二", "〇", "〇", "八年", "。"], KNOWN, POS)
    assert words == ["二", "〇", "〇", "八", "年", "。"]
    sylls = syllables("二〇〇八年。", words, lambda w: table[w], "年", ["nian2"])
    assert render("二〇〇八年。", words, sylls) == "èr líng líng bā nián."


def test_decimal_positions_and_a_percent_sign():
    # The strict checker (Task 13) finds the digits of a decimal on the characters of a sentence.
    assert decimal_positions("它是三点一四。") == {2, 4, 5}
    assert decimal_positions("百分之三点一之间") == {3, 5}
    assert decimal_positions("是三点一刻。") == set()
    # A percent sign stays with its number, as in the sentence (jieba cuts 70% into 70 and %).
    table = {**TABLE, "地球": ["di4", "qiu2"], "上": ["shang4"], "面积": ["mian4", "ji1"], "海洋": ["hai3", "yang2"]}
    words = ["地球", "上", "70", "%", "的", "面积", "是", "海洋", "。"]
    sentence = "地球上70%的面积是海洋。"
    sylls = syllables(sentence, words, lambda w: table[w], "海洋", ["hai3", "yang2"])
    assert render(sentence, words, sylls) == "dìqiú shàng 70% de miànjī shì hǎiyáng."


def test_potential_complements():
    assert split_words(["我", "睡不着", "。"], KNOWN, POS) == ["我", "睡", "不", "着", "。"]
    assert split_words(["我", "记不清", "楚", "当时"], KNOWN, POS) == ["我", "记", "不", "清楚", "当时"]
    assert split_words(["找", "不到", "家"], KNOWN, POS) == ["找", "不", "到", "家"]
    words = ["我", "睡", "不", "着", "。"]
    assert potential_readings(words, POS) == {2: "bu5", 3: "zhao2"}
    sylls = syllables("我睡不着。", words, lookup, "睡", ["shui4"], potential_readings(words, POS))
    assert render("我睡不着。", words, sylls, attach=attached(words, POS)) == "wǒ shuì bu zháo."
    assert potential_readings(["他", "说", "不", "去", "。"], POS) == {}
    assert potential_readings(["他", "不", "到", "十", "岁"], POS) == {}
    # A result 来, and jieba's 不了 or 不过 after a verb (钱买不来幸福。 孩子跨不过这条沟。 我忍受不了他。).
    words = ["钱", "买", "不", "来", "幸福", "。"]
    assert potential_readings(words, POS) == {2: "bu5"}
    table = {**TABLE, "钱": ["qian2"], "买": ["mai3"], "幸福": ["xing4", "fu2"], "忍受": ["ren3", "shou4"], "跨": ["kua4"],
             "过": ["guo4"]}
    sylls = syllables("钱买不来幸福。", words, lambda w: table[w], "钱", ["qian2"], potential_readings(words, POS))
    assert render("钱买不来幸福。", words, sylls, attach=attached(words, POS)) == "qián mǎi bu lái xìngfú."
    pos = {**POS, "跨": ["v."], "忍受": ["v."]}
    assert split_words(["跨", "不过", "这"], KNOWN, pos) == ["跨", "不", "过", "这"]
    assert split_words(["他", "很", "好", "，", "不过", "我"], KNOWN, pos)[4] == "不过"
    words = split_words(["我", "忍受", "不了", "他", "。"], KNOWN, pos)
    assert words == ["我", "忍受", "不", "了", "他", "。"]
    sylls = syllables("我忍受不了他。", words, lambda w: table[w], "我", ["wo3"], potential_readings(words, pos))
    assert render("我忍受不了他。", words, sylls, attach=attached(words, pos)) == "wǒ rěnshòu bu liǎo tā."
    # A potential complement of the public list is split too, but a card keeps its card's spacing.
    known = KNOWN | {"赶不上", "受不了", "火车"}
    pos = {**pos, "赶": ["v."], "受": ["v."]}
    assert split_words(["赶不上", "火车", "受不了"], known, pos, cards={"受不了"}) == ["赶", "不", "上", "火车", "受不了"]


def test_particles_join_the_word_before_them():
    words = ["我", "用", "了", "两", "个", "小时", "。"]
    assert attached(words, POS) == {2}
    sylls = syllables("我用了两个小时。", words, lookup, "用", ["yong4"])
    assert render("我用了两个小时。", words, sylls, attach=attached(words, POS)) == "wǒ yòngle liǎng gè xiǎoshí."
    assert attached(["昨天", "下", "雨", "了", "。"], POS) == set()
    assert attached(["你", "来", "了", "吗", "？"], POS) == set()
    assert attached(["我", "见", "过", "他"], POS) == {2}
    assert attached(["要", "过", "春节", "了"], POS) == set()
    assert attached(["同学", "们", "睡", "不", "着"], POS) == {2}
    assert attached(["驾驶", "员", "回", "家"], POS) == {2}
    assert split_words(["衣服", "弄脏了", "。"], KNOWN, POS) == ["衣服", "弄脏", "了", "。"]


def test_a_particle_that_ends_a_sentence_stands_apart():
    known = KNOWN | {"咖啡", "喝", "杯", "算了"}
    pos = {**POS, "喝": ["v."], "杯": ["m."], "咖啡": ["n."]}
    assert split_words(["喝杯", "咖啡吧", "。"], known, pos) == ["喝", "杯", "咖啡", "吧", "。"]
    assert split_words(["算了吧", "，"], known, pos) == ["算了", "吧", "，"]
    # Inside a sentence jieba's 咖啡吧 is a coffee bar and stays whole.
    assert split_words(["咖啡吧", "很", "小"], known, pos) == ["咖啡吧", "很", "小"]


def test_a_one_character_verb_joins_a_one_character_result():
    pos = {**POS, "写": ["v."], "关": ["v.", "n."], "门": ["n.", "m."], "树": ["n.", "v."], "上": ["n.", "v."],
           "信": ["n.", "v."], "鸟": ["n."]}
    assert attached(["他", "写", "好", "了", "信", "。"], pos) == {2, 3}
    words = ["他", "关", "上", "了", "门", "。"]
    assert attached(words, pos) == {2, 3}
    table = {**TABLE, "关": ["guan1"], "上": ["shang4"], "门": ["men2"]}
    sylls = syllables("他关上了门。", words, lambda w: table[w], "关", ["guan1"])
    assert render("他关上了门。", words, sylls, attach=attached(words, pos)) == "tā guānshàngle mén."
    # 上 after a word that is first a noun is a place word, and 是, 有 and a verb of wanting take no result.
    assert attached(["鸟", "在", "树", "上", "。"], pos) == set()
    assert attached(["这", "是", "好", "人"], pos) == set()
    assert attached(["我", "要", "去"], pos) == set()


def test_segment_and_regroup_with_jieba():
    assert [w for w, _ in segment("天太黑了，我不敢一个人出去。")] == \
        ["天", "太", "黑", "了", "，", "我", "不敢", "一个", "人", "出去", "。"]
    sentence = "哥哥是一个很勇敢的人。"
    words = regroup(sentence, [w for w, _ in segment(sentence)], "勇敢", cut=lambda piece: [w for w, _ in segment(piece)])
    assert words[-4:] == ["勇敢", "的", "人", "。"]


def test_word_joints():
    fixed = {**CARDS, "动荡不安": IDIOM_JOINTS, "二氧化碳": ["", "", ""]}
    assert word_joints("不客气", fixed) == [" ", ""]
    assert word_joints("动荡不安", fixed) == IDIOM_JOINTS
    assert word_joints("二氧化碳", fixed) == ["", "", ""]
    assert word_joints("科学家", fixed) == ["", ""]
    assert word_joints("一大早儿", fixed) == ["", "", ""]
    assert word_joints("第二十", fixed) == ["-", ""]
    assert word_joints("两三", fixed) == ["-"]


def test_lookup_reads_cards_then_public_list_words_then_the_guess():
    guess = {"下来": ["xia4", "lai2"], "喜欢": ["xi3", "huan1"], "看看": ["kan4", "kan4"], "哪儿": ["na3", "er2"],
             "穿着": ["chuan1", "zhe5"], "出来": ["chu1", "lai2"], "身上": ["shen1", "shang4"]}.get
    listed = {"下来": [{"num": "xia4 lai5"}], "身上": [{"num": "shen1 shang5"}], "穿着": [{"num": "chuan1 zhuo2"}],
              "出来": [{"num": "chu1 lai2"}, {"num": "chu1 lai5"}], "城里": [{"num": "chengli3"}],
              "喜欢": [{"num": "xi3 huan5"}]}
    public_nums, word_readings = public_word_readings(listed, {"喜欢"}, guess)
    assert public_nums == {"下来": "xia4 lai5", "身上": "shen1 shang5", "穿着": "chuan1 zhuo2"}
    assert word_readings == {"穿着": ["chuan1 zhuo2", "chuan1 zhe5"], "出来": ["chu1 lai2", "chu1 lai5"]}
    look = make_lookup({"哪儿"}, {"喜欢": "xi3 huan5"}, public_nums, guess)
    assert [look(w) for w in ["喜欢", "下来", "看看", "哪儿"]] == \
        [["xi3", "huan5"], ["xia4", "lai5"], ["kan4", "kan4"], ["na3", "r5"]]
    words = ["汽车", "停", "了", "下来", "。"]
    sylls = syllables("汽车停了下来。", words, lambda w: TABLE.get(w) or look(w), "停", ["ting2"])
    assert render("汽车停了下来。", words, sylls, attach=attached(words, POS)) == "qìchē tíngle xiàlai."


def test_regroup_keeps_the_headword_whole_and_joins_a_lone_er():
    assert regroup("都市里很热闹。", ["都", "市里", "很", "热闹", "。"], "都市") == ["都市", "里", "很", "热闹", "。"]
    cut = {"了耸肩": ["了", "耸肩"], "里": ["里"]}.get
    assert regroup("他耸了耸肩。", ["他", "耸了耸肩", "。"], "耸", cut) == ["他", "耸", "了", "耸肩", "。"]
    assert regroup("有很多小摊儿。", ["有", "很多", "小摊", "儿", "。"], "有") == ["有", "很多", "小摊儿", "。"]
    words = ["虽然", "下雨", "了", "，", "但是", "我", "去", "。"]
    assert regroup("虽然下雨了，但是我去。", words, "虽然…但是…") == words


def test_regroup_keeps_a_known_word_that_holds_the_headword():
    known = {"男人", "春天", "外面", "下雨", "那个"}
    words = ["我", "不", "认识", "那个", "男人", "。"]
    assert regroup("我不认识那个男人。", words, "男", known=known) == words
    assert regroup("外面下雨了。", ["外面", "下雨", "了", "。"], "外", known=known) == ["外面", "下雨", "了", "。"]
    assert regroup("外面下雨了。", ["外面", "下雨", "了", "。"], "外") == ["外", "面", "下雨", "了", "。"]
    words = regroup("春天是一年的开始。", ["春天", "是", "一", "年", "的", "开始", "。"], "春", known=known)
    assert words[0] == "春天"
    table = {**TABLE, "春天": ["chun1", "tian1"], "的": ["de5"]}
    sylls = syllables("春天是一年的开始。", words, lambda w: table[w], "春", ["chun1"])
    assert render("春天是一年的开始。", words, sylls) == "chūntiān shì yì nián de kāishǐ."
    # A word that neither list has is still cut, so the headword stands as a word of its own.
    assert regroup("都市里很热闹。", ["都", "市里", "很", "热闹", "。"], "都市", known=known)[:2] == ["都市", "里"]


def test_pattern_word_positions():
    assert head_positions("虽然下雨了，但是我去。", "虽然…但是…") == [0, 1, 6, 7]
    assert head_positions("我去。", "虽然…但是…") == []


def test_spot_checks_single_characters_with_several_readings():
    words = ["一", "个", "人", "长", "大", "了", "。"]
    sylls = syllables("一个人长大了。", words, lookup, "人", ["ren2"])
    readings = {"长": ["chang2", "zhang3"], "大": ["da4", "dai4"], "了": ["le5", "liao3"], "一": ["yi1"],
                "个": ["ge4", "ge3"]}
    found = spot_checks("一个人长大了。", words, sylls, "人", lambda ch: readings.get(ch, ["x1"]), set(), {})
    assert found == [(3, "长", "chang2", "chang2/zhang3"), (4, "大", "da4", "da4/dai4")]


def test_spot_checks_words_that_neither_list_has():
    words = ["缝到", "衬衫", "上", "。"]
    sylls = ["feng2", "dao4", "chen4", "shan1", "shang4", None]
    readings = {"缝": ["feng2", "feng4"], "到": ["dao4"], "上": ["shang4", "shang3"], "衫": ["shan1", "shan4"]}
    found = spot_checks("缝到衬衫上。", words, sylls, "上", lambda ch: readings.get(ch, ["x1"]), {"衬衫"}, {})
    assert found == [(0, "缝", "feng2", "feng2/feng4"), (1, "到", "dao4", "dao4/dao5")]
    readings = {"睡": ["shui4"], "着": ["zhe5", "zhao2", "zhuo2"], "了": ["le5", "liao3"]}
    sylls = ["wo3", "shui4", "zhe5", "le5", None]
    found = spot_checks("我睡着了。", ["我", "睡着", "了", "。"], sylls, "我", lambda ch: readings[ch], set(), {})
    assert found == [(2, "着", "zhe5", "zhe5/zhao2/zhuo2")]


def test_spot_checks_public_words_with_several_readings():
    words = ["他", "穿着", "红", "鞋", "。"]
    sylls = ["ta1", "chuan1", "zhuo2", "hong2", "xie2", None]
    several = {"穿着": ["chuan1 zhuo2", "chuan1 zhe5"]}
    found = spot_checks("他穿着红鞋。", words, sylls, "鞋", lambda ch: ["x1"], {"下来"}, several)
    assert found == [(2, "着", "zhuo2", "zhuo2/zhe5")]


def test_spot_checks_an_unmarked_er_ending():
    words = ["我", "在", "哪儿", "。"]
    table = {"我": ["wo3"], "在": ["zai4"], "哪儿": ["na3", "er2"]}
    sylls = syllables("我在哪儿。", words, lambda w: table[w], "在", ["zai4"])
    assert spot_checks("我在哪儿。", words, sylls, "在", lambda ch: ["x1"], {"哪儿"}, {}) == [(3, "儿", "er2", "er2/r5")]


def test_check_polyphone_answers():
    given = [{"id": "w1", "index": "3", "char": "长", "given": "chang2"},
             {"id": "w2", "index": "0", "char": "行", "given": "xing2"}]
    answers = [{"id": "w1", "index": "3", "char": "长", "verdict": "FIX", "syllable": "zhang3"},
               {"id": "w2", "index": "0", "char": "行", "verdict": "OK", "syllable": ""}]
    assert check_polyphone_answers(given, answers) == ([], [("w1", 3, "长", "zhang3"), ("w2", 0, "行", "xing2")])
    problems, _ = check_polyphone_answers(given, [{"id": "w1", "index": "3", "char": "长", "verdict": "FIX",
                                                   "syllable": "zhang"}])
    assert problems == ["w1 at 3: verdict 'FIX' with syllable 'zhang'", "w2 at 0: missing"]
