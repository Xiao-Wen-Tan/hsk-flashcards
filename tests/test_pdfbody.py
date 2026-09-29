from pdfbody import (contains_head, fill_placeholder, inline_text, is_inline, sentence_candidates, sentences_of,
                     split_senses)

FWD = {1: "妈", 2: "我", 3: "～", 4: "你", 5: "。", 6: "吃", 7: "米", 8: "饭", 12: "好", 13: "，"}


def test_split_senses_on_glosses_but_not_on_inline_text():
    tokens = [["c", [835, 99, 836]], ["l", " àiv. love "], ["c", [1, 1, 13, 2, 3, 4, 5]],
              ["l", "v. like doing sth. "], ["c", [2, 3, 6]], ["l", " 10 "], ["c", [7, 8, 5]]]
    assert split_senses(tokens, FWD) == [("àiv. love", "妈妈，我～你。"), ("v. like doing sth.", "我～吃10米饭。")]


def test_ascii_tilde_and_acronyms_stay_in_the_sentence():
    tokens = [["c", [99]], ["l", " xiǎo adj. small "], ["c", [2]], ["l", "~"], ["c", [5]],
              ["l", " DNA "], ["c", [12, 5]]]
    assert split_senses(tokens, FWD) == [("xiǎo adj. small", "我～。DNA好。")]


def test_is_inline_and_inline_text():
    assert is_inline("  ") and is_inline(" 300 ") and is_inline("?") and is_inline(" CEO ")
    assert not is_inline("ok; please ") and not is_inline("nàr") and not is_inline(" entrust ")
    assert inline_text(" 10 ") == "10" and inline_text("~") == "～" and inline_text("?") == "？"
    assert inline_text(" 3.5 ") == "3.5" and inline_text("'") == ""


def test_sentences_of_drops_fragments_and_leading_semicolons():
    assert sentences_of("～个人是我的同学。我能坐在～儿吗？") == ["～个人是我的同学。", "我能坐在～儿吗？"]
    assert sentences_of("；；游客挨了宰，") == []
    assert sentences_of("；这个版本的字典已售完了。") == ["这个版本的字典已售完了。"]
    assert sentences_of("他说：“好！”") == ["他说：“好！”"]


def test_sentence_candidates_add_the_joined_form():
    assert sentence_candidates("哇！这些照片真漂亮！") == ["哇！", "这些照片真漂亮！", "哇！这些照片真漂亮！"]
    assert sentence_candidates("我～吃米饭。") == ["我～吃米饭。"]


def test_fill_placeholder():
    assert fill_placeholder("妈妈，我～你。", "爱") == "妈妈，我爱你。"
    assert fill_placeholder("我能坐在～儿吗？", "这") == "我能坐在这儿吗？"
    assert fill_placeholder("～下雨了，～我们还是想去看电影。", "虽然…但是…") == "虽然下雨了，但是我们还是想去看电影。"
    assert fill_placeholder("～下雨了。", "虽然…但是…") is None


def test_contains_head():
    assert contains_head("虽然下雨了，但是我们还是去了。", "虽然…但是…")
    assert not contains_head("但是下雨了，虽然我们还是去了。", "虽然…但是…")
    assert contains_head("我爱你。", "爱") and not contains_head("我喜欢你。", "爱")
