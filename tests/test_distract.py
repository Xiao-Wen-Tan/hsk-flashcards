from distract import meaning_keys, no_distract, sound, usable_choices


def test_meaning_keys():
    assert meaning_keys("to love; like doing sth.", "to love") == {"love", "like doing sth"}
    assert meaning_keys("happy (feeling); glad", "happy") == {"happy", "glad"}


def test_no_distract_links_overlapping_meanings_both_ways():
    words = [{"id": "w1", "en": "happy; glad", "enShort": "happy"}, {"id": "w2", "en": "happy", "enShort": "happy"},
             {"id": "w3", "en": "sad", "enShort": "sad"}]
    assert no_distract(words) == {"w1": ["w2"], "w2": ["w1"], "w3": []}


def W(wid, py, num, short, nd=()):
    return {"id": wid, "py": py, "pyNum": num, "enShort": short, "noDistract": list(nd)}


def test_usable_choices_per_quiz():
    ta = W("w1", "tā", "ta1", "he")
    pool = [ta, W("w2", "tā", "ta1", "she"), W("w3", "tā", "ta1", "it"), W("w4", "tǎ", "ta3", "tower"),
            W("w5", "hǎo", "hao3", "good", ["w1"]), W("w6", "hē", "he1", "he")]
    assert [w["id"] for w in usable_choices(ta, pool, "listen")] == ["w4"]
    assert [w["id"] for w in usable_choices(ta, pool, "pinyin")] == ["w4", "w6"]


def test_sound_uses_the_spoken_tones():
    assert sound({"py": "bú kèqi", "pyNum": "bu4 ke4 qi5"}) == "búkèqi"
    assert sound({"py": "Nǚ'ér", "pyNum": "nü3 er2"}) == "nǚér"
    assert sound({"py": "bámiáo-zhùzhǎng", "pyNum": "ba2 miao2 zhu4 zhang3"}) == "bámiáozhùzhǎng"
