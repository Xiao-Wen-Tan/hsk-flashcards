import pinyin_text
from pinyin_text import (IDIOM_JOINTS, card_py, check_form_answers, form_joints, form_rows,
                         headword_joints, join_erhua, joints_of_py, marked_to_num, name_rows, num_to_marked, pdf_pinyin,
                         printed_pinyin, py_base, py_problems, syllable_count, syllables_of_py, tone_change)


def test_marked_to_num():
    assert marked_to_num("Běi jīng") == "bei3 jing1"
    assert marked_to_num("gàn huó r") == "gan4 huo2 r5"
    assert marked_to_num("lǜ") == "lü4"
    assert marked_to_num("cè lu:è") == "ce4 lüe4"
    assert marked_to_num("duì bu qǐ") == "dui4 bu5 qi3"


def test_num_to_marked_places_the_tone_mark():
    assert [num_to_marked(s) for s in ["guo3", "liu2", "gui4", "zhou1", "lüe4", "er2", "ma5"]] == \
        ["guǒ", "liú", "guì", "zhōu", "lüè", "ér", "ma"]


def test_tone_change_of_bu_and_yi():
    assert tone_change("不客气", ["bu4", "ke4", "qi5"]) == ["bu2", "ke4", "qi5"]
    assert tone_change("一下", ["yi1", "xia4"]) == ["yi2", "xia4"]
    assert tone_change("一起", ["yi1", "qi3"]) == ["yi4", "qi3"]
    assert tone_change("一模一样", ["yi1", "mu2", "yi1", "yang4"]) == ["yi4", "mu2", "yi2", "yang4"]


def test_tone_change_leaves_these_alone():
    assert tone_change("统一", ["tong3", "yi1"]) == ["tong3", "yi1"]
    assert tone_change("第一", ["di4", "yi1"]) == ["di4", "yi1"]
    assert tone_change("一月", ["yi1", "yue4"]) == ["yi1", "yue4"]
    assert tone_change("对不起", ["dui4", "bu5", "qi3"]) == ["dui4", "bu5", "qi3"]
    assert tone_change("统一中国", ["tong3", "yi1", "zhong1", "guo2"], keep={1}) == \
        ["tong3", "yi1", "zhong1", "guo2"]
    assert tone_change("二零一二", ["er4", "ling2", "yi1", "er4"]) == ["er4", "ling2", "yi1", "er4"]


def test_reduplication_makes_yi_and_bu_neutral():
    assert tone_change("看一看", ["kan4", "yi1", "kan4"]) == ["kan4", "yi5", "kan4"]
    assert tone_change("好不好", ["hao3", "bu4", "hao3"]) == ["hao3", "bu5", "hao3"]


def test_card_py_word_spacing():
    assert card_py(["bu2", "ke4", "qi5"], [" ", ""]) == "bú kèqi"
    assert card_py(["ba2", "miao2", "zhu4", "zhang3"], IDIOM_JOINTS) == "bámiáo-zhùzhǎng"
    assert card_py(["yi4", "dian3", "r5"], ["", ""]) == "yìdiǎnr"
    assert card_py(["gan4", "huo2", "r5"]) == "gànhuór"
    assert card_py(["sui1", "ran2", "dan4", "shi4"], ["", "…", ""]) == "suīrán…dànshì…"


def test_card_py_apostrophes_and_lower_case_names():
    assert card_py(["xi1", "an1"]) == "xī'ān"
    assert card_py(["nü3", "er2"]) == "nǚ'ér"
    assert card_py(["bu2", "dan4", "er2", "qie3"], ["", "…", ""]) == "búdàn…érqiě…"
    # The user's decision of 2026-09-29: all pinyin is in lower case, names included. The words of a
    # name keep their spacing, so a surname stays apart from a given name and a title stays apart.
    assert card_py(["bei3", "jing1"]) == "běijīng"
    assert card_py(["huang2", "he2"], [" "]) == "huáng hé"
    assert card_py(["li3", "lao3", "shi1"], [" ", ""]) == "lǐ lǎoshī"
    assert "capitalise" not in vars(pinyin_text)


def test_pdf_pinyin_reads_the_textbook_spacing():
    assert pdf_pinyin(" bú kèqi You’re welcome. ", "不客气", ["bu4", "ke4", "qi5"]) == (["bu2", "ke4", "qi5"], [" ", ""])
    assert pdf_pinyin(" dǎ diànhuà make a phone call ", "打电话", ["da3", "dian4", "hua4"])[1] == [" ", ""]
    assert pdf_pinyin(" nǚ’ér n. daughter ", "女儿", ["nü3", "er2"]) == (["nü3", "er2"], [""])
    assert pdf_pinyin(" yìdiǎnr nm. a little ", "一点儿", ["yi1", "dian3", "r5"]) == (["yi4", "dian3", "r5"], ["", ""])
    assert pdf_pinyin(" dì-yī num. first ", "第一", ["di4", "yi1"]) == (["di4", "yi1"], ["-"])
    assert pdf_pinyin(" shòubuliǎo can’t bear ", "受不了", ["shou4", "bu4", "liao3"])[0] == ["shou4", "bu5", "liao3"]
    assert pdf_pinyin("yīnwèi…suǒyǐ… conj. on account of", "因为…所以…", ["yin1", "wei4", "suo3", "yi3"]) == \
        (["yin1", "wei4", "suo3", "yi3"], ["", "…", ""])
    assert pdf_pinyin(" àiv. love ", "爱", ["ai4"]) == (["ai4"], [])


def test_pdf_pinyin_rejects_other_readings():
    assert pdf_pinyin(" chuāng curtain ", "窗帘", ["chuang1", "lian2"]) is None
    assert pdf_pinyin(" zhǎng v. grow ", "长", ["chang2"]) is None
    assert pdf_pinyin(" yǐxià once ", "一下", ["yi1", "xia4"]) is None
    assert pdf_pinyin(" hǎo adj. good ", "好", ["hao4"]) is None


def test_printed_pinyin_reads_the_first_print_that_fits():
    net = ["hu4", "lian2", "wang3"]
    assert printed_pinyin([" hùliánwǎng n. the Internet "], "互联网", net) == (net, ["", ""])
    assert card_py(net, ["", ""]) == "hùliánwǎng"
    # A printed capital does not reach the card, which is in lower case (decision of 2026-09-29).
    assert printed_pinyin([" Běi n. north ", " Běijīng n. Beijing "], "北京", ["bei3", "jing1"]) == \
        (["bei3", "jing1"], [""])
    assert printed_pinyin([" zhǎng v. grow "], "长", ["chang2"]) is None


def test_join_erhua():
    assert join_erhua("纽扣儿", ["niu3", "kou4", "er5"]) == ["niu3", "kou4", "r5"]
    assert card_py(join_erhua("纽扣儿", ["niu3", "kou4", "er5"])) == "niǔkòur"
    assert join_erhua("女儿", ["nü3", "er2"]) == ["nü3", "er2"]
    assert join_erhua("儿", ["er2"]) == ["er2"]
    assert join_erhua("一点儿", ["yi1", "dian3", "r5"]) == ["yi1", "dian3", "r5"]


def test_headword_joints():
    whole = lambda hz: [hz]
    cut = {"系领带": ["系", "领带"], "素食主义": ["素食", "主义"], "报到": ["报", "到"]}.get
    assert headword_joints("拔苗助长", whole, ("idiom", [])) == IDIOM_JOINTS
    assert headword_joints("二氧化碳", whole, ("joined", [])) == ["", "", ""]
    assert headword_joints("通货膨胀", whole, ("words", ["通货", "膨胀"])) == ["", " ", ""]
    assert headword_joints("素食主义", cut) == ["", " ", ""]
    assert headword_joints("系领带", cut) == [" ", ""]
    assert headword_joints("报到", cut) == [""]
    assert headword_joints("干活儿", whole) == ["", ""]
    assert headword_joints("一大早儿", whole) == ["", "", ""]
    assert headword_joints("虽然…但是…", whole) == ["", "…", ""]


def test_form_joints():
    assert form_joints("idiom", []) == IDIOM_JOINTS
    assert form_joints("joined", []) == ["", "", ""]
    assert form_joints("words", ["叹", "一", "口", "气"]) == [" ", " ", " "]
    assert card_py(["tong1", "huo4", "peng2", "zhang4"], form_joints("words", ["通货", "膨胀"])) == "tōnghuò péngzhàng"


def test_form_rows():
    rows = [{"hz": "二氧化碳", "form": "joined", "words": ""}, {"hz": "通货膨胀", "form": " Words ", "words": "通货 膨胀"},
            {"hz": "市场经济", "form": "words", "words": "市场 经"}, {"hz": "迄今为止", "form": "maybe", "words": ""},
            {"hz": "拔苗助长", "form": "idiom", "words": "拔苗 助长"}, {"hz": "二氧化碳", "form": "idiom", "words": ""}]
    assert form_rows(rows) == ({"二氧化碳": ("joined", []), "通货膨胀": ("words", ["通货", "膨胀"])}, [
        "市场经济: words '市场 经' do not fit the form words",
        "迄今为止: form 'maybe' is not idiom, words or joined, or hz is not four characters",
        "拔苗助长: words '拔苗 助长' do not fit the form idiom", "二氧化碳: listed twice"])


def test_check_form_answers():
    batch = [{"hz": "通货膨胀"}, {"hz": "二氧化碳"}]
    good = [{"hz": "通货膨胀", "form": "words", "words": "通货 膨胀"}, {"hz": "二氧化碳", "form": "joined", "words": ""}]
    assert check_form_answers(batch, good) == ([], [["通货膨胀", "words", "通货 膨胀"], ["二氧化碳", "joined", ""]])
    problems, rows = check_form_answers(batch, [good[0], good[0], {"hz": "烟花爆竹", "form": "words", "words": "烟花 爆竹"}])
    assert problems == ["烟花爆竹: not in the input", "通货膨胀: answered 2 times", "二氧化碳: missing"]


def test_name_rows():
    rows = [{"hz": "欧洲", "words": "", "capital": "Y"}, {"hz": "李老师", "words": "李 老师", "capital": "y n"},
            {"hz": "王建国", "words": "王 建国", "capital": "Y"}, {"hz": "除夕", "words": "", "capital": "N"},
            {"hz": "李华", "words": "李 华", "capital": "Y N N"}, {"hz": "小王", "words": "小 李", "capital": "Y"},
            {"hz": "欧洲", "words": "", "capital": "Y"}]
    assert name_rows(rows) == ({"欧洲": (["欧洲"], [True]), "李老师": (["李", "老师"], [True, False]),
                                "王建国": (["王", "建国"], [True, True]), "除夕": (["除夕"], [False])}, [
        "李华: capital is 'Y N N', not one Y or N, or one per word", "小王: words '小 李' do not spell it",
        "欧洲: listed twice"])


def test_joints_of_py():
    assert joints_of_py("bú kèqi", ["bu4", "ke4", "qi5"]) == [" ", ""]
    assert joints_of_py("bámiáo-zhùzhǎng", ["ba2", "miao2", "zhu4", "zhang3"]) == IDIOM_JOINTS
    assert joints_of_py("xī'ān", ["xi1", "an1"]) == [""]
    assert joints_of_py("kèqi", ["ke4"]) is None
    assert syllables_of_py("shòubuliǎo", ["shou4", "bu4", "liao3"]) == ["shou4", "bu5", "liao3"]
    assert syllables_of_py("Běijīng", ["bei3", "jing1"]) == ["bei3", "jing1"]
    assert syllables_of_py("kèqi", ["ke4"]) is None


def test_py_problems_accepts_textbook_pinyin():
    good = [("不客气", "bú kèqi", "bu4 ke4 qi5"), ("拔苗助长", "bámiáo-zhùzhǎng", "ba2 miao2 zhu4 zhang3"),
            ("一点儿", "yìdiǎnr", "yi1 dian3 r5"), ("女儿", "nǚ'ér", "nü3 er2"), ("北京", "Běijīng", "bei3 jing1"),
            ("受不了", "shòubuliǎo", "shou4 bu4 liao3"), ("第一", "dì-yī", "di4 yi1"), ("打电话", "dǎ diànhuà", "da3 dian4 hua4"),
            ("虽然…但是…", "suīrán…dànshì…", "sui1 ran2 dan4 shi4"), ("黄河", "Huáng Hé", "huang2 he2")]
    assert [py_problems(*row) for row in good] == [[]] * len(good)


def test_py_problems_finds_each_kind():
    assert py_problems("爱", "ài.", "ai4") == ["py 'ài.' holds '.'; only letters, spaces, hyphens and apostrophes are allowed"]
    assert py_problems("不客气", "bú  kèqi", "bu4 ke4 qi5") == \
        ["py 'bú  kèqi' has a space, hyphen or apostrophe at an end or two in a row"]
    assert py_problems("苹果", "pínguǒ", "ping2 guo3") == ["py 'pínguǒ' does not spell pyNum 'ping2 guo3'"]
    assert py_problems("一下", "yǐxià", "yi1 xia4") == ["syllable 1 of py is yi3 but pyNum has yi1"]
    assert py_problems("西安", "xīān", "xi1 an1") == ["an apostrophe is missing before syllable 2 'ān'"]
    assert py_problems("爱人", "ài'rén", "ai4 ren2") == ["an apostrophe stands before syllable 2 'rén'"]


def test_base_and_syllable_count():
    assert py_base(["nü3", "er2"]) == "nüer"
    assert py_base(["gan4", "huo2", "r5"]) == "ganhuor"
    assert syllable_count(["gan4", "huo2", "r5"]) == 2


def test_card_pinyin_follows_the_style_sheet():
    # Point 5: a card that is a potential complement keeps the joined form the PDFs print or the
    # public list gives, with its neutral bu, even where jieba would cut it.
    cut = {"看不起": ["看", "不起"], "来得及": ["来得", "及"]}.get
    assert headword_joints("看不起", cut) == ["", ""] and headword_joints("来得及", cut) == ["", ""]
    assert card_py(tone_change("看不起", ["kan4", "bu5", "qi3"]), headword_joints("看不起", cut)) == "kànbuqǐ"
    assert pdf_pinyin(" láibují v. haven't enough time ", "来不及", ["lai2", "bu5", "ji2"]) == \
        (["lai2", "bu5", "ji2"], ["", ""])
    # Point 6: numbers. HSK 4 prints 百分之 "bǎifēnzhī", 第一 keeps its hyphen, 一 keeps its tone after
    # a numeral, and an approximate number takes a hyphen.
    assert pdf_pinyin(" bǎifēnzhī percent ", "百分之", ["bai3", "fen1", "zhi1"]) == (["bai3", "fen1", "zhi1"], ["", ""])
    assert card_py(tone_change("十一", ["shi2", "yi1"])) == "shíyī"
    assert card_py(tone_change("一两", ["yi1", "liang3"]), ["-"]) == "yì-liǎng"
    # Point 7: since 2026-09-29 names are in lower case too, and their words keep their spacing, so the
    # kind of a place and a title stand apart.
    assert card_py(["fu2", "jian4", "sheng3"], ["", " "]) == "fújiàn shěng"
    assert card_py(["wang2", "xian1", "sheng5"], [" ", ""]) == "wáng xiānsheng"
    assert card_py(["zheng1", "yue4"]) == "zhēngyuè"
    # Point 8: the tone changes of 一 and 不 as they are spoken, and neutral tones as in the dictionary.
    spoken = [("一起", ["yi1", "qi3"]), ("一下", ["yi1", "xia4"]), ("不是", ["bu4", "shi4"]), ("唯一", ["wei2", "yi1"]),
              ("不客气", ["bu4", "ke4", "qi5"])]
    assert [card_py(tone_change(hz, nums)) for hz, nums in spoken] == ["yìqǐ", "yíxià", "búshì", "wéiyī", "búkèqi"]
