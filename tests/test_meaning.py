from meaning import (LEFTOVER_LABEL, cedict_senses, clean_gloss, en_short, fit_en, public_pos, senses_of,
                     split_pos, unknown_words, vocabulary)


def test_split_pos():
    assert split_pos("v. like doing sth. ") == (["v."], "like doing sth.")
    assert split_pos("nm.copy; issue") == (["m."], "copy; issue")
    assert split_pos(" adj theyoungest ") == (["adj."], "theyoungest")
    assert split_pos("'sa. expressing emphasis ") == (["part."], "expressing emphasis")
    assert split_pos(" protect; care; cherish ") == ([], "protect; care; cherish")
    assert split_pos("part") == ([], "part")
    assert split_pos(" n. & v. plan ") == (["n.", "v."], "plan")


def test_split_pos_separable_verbs_and_a_leading_slash():
    assert split_pos(" sv. dance ") == (["v."], "dance")
    assert split_pos("sv.give your name; enroll ") == (["v."], "give your name; enroll")
    assert split_pos("/vm. number of times") == (["m."], "number of times")


def test_split_pos_turns_a_colon_between_senses_into_a_semicolon():
    assert split_pos(" on the contrary; instead:fjdk ") == ([], "on the contrary; instead; fjdk")
    assert split_pos(" gamble; gambling: ") == ([], "gamble; gambling")


def test_leftover_label():
    assert LEFTOVER_LABEL.match("sv. dance") and LEFTOVER_LABEL.match("/vm. number of times")
    assert not LEFTOVER_LABEL.match("dance") and not LEFTOVER_LABEL.match("Mr.; sir")


def test_public_pos():
    assert public_pos(["v", "vn", "b"]) == ["v."]
    assert public_pos(["r", "c"]) == ["pron.", "conj."]
    assert public_pos(["i"]) == []


def test_clean_gloss_and_senses():
    assert clean_gloss(" copy; issue (used for counting books 'and other bound items)") == \
        "copy; issue (used for counting books and other bound items)"
    assert clean_gloss("though;but; however ") == "though; but; however"
    assert clean_gloss("restaurant,eatery; (large) hotel") == "restaurant, eatery; (large) hotel"
    assert clean_gloss("classifier for cloth: bolt") == "classifier for cloth: bolt"
    assert clean_gloss("? pause") == "pause" and clean_gloss(". of course; naturally") == "of course; naturally"
    assert senses_of(["love", "like; Love"]) == ["love", "like"]


def test_senses_that_differ_only_in_spaces_count_once():
    assert senses_of(["you (used to address someone withrespect)", "you (used to address someone with respect)"]) == \
        ["you (used to address someone with respect)"]
    assert senses_of(["have nothing; can't compare with others", "have nothing; can't compare withothers"]) == \
        ["have nothing", "can't compare with others"]


def test_unknown_words():
    vocab = vocabulary(["to take", "an interest in sth", "honor; center"])
    assert unknown_words("take aninterest in", vocab) == ["aninterest"]
    assert unknown_words("takes an interest", vocab) == []
    assert unknown_words("honour; centre", vocab) == []


def test_fit_en_keeps_three_senses_and_80_characters():
    assert fit_en(["a", "b", "c", "d"]) == "a; b; c"
    assert fit_en(["copy", "x" * 74]) == "copy; " + "x" * 74
    assert fit_en(["copy", "x" * 75]) == "copy"
    assert len(fit_en(["x" * 50, "y" * 40])) <= 80


def test_en_short():
    assert en_short(["to love", "to like"]) == "to love"
    assert en_short(["issue (used for counting books and other bound items)"]) == "issue"
    assert en_short(["a very long meaning that has no brackets at all here"]) == "a very long meaning that has…"
    assert en_short([]) == ""


def test_cedict_senses():
    assert cedict_senses(["surname Wang", "king; ruler", "CL:個|个[ge4]"]) == ["king", "ruler"]
    assert cedict_senses(["seems as if; rather like; Taiwan pr. [shi4 shi5]"]) == ["seems as if", "rather like"]
    assert cedict_senses(["to see off", "see 送[song4]"]) == ["to see off"]


def test_cedict_senses_drop_sound_notes_and_chinese_characters():
    assert cedict_senses(["to be", "to act as", "(onom.) dong"]) == ["to be", "to act as"]
    assert cedict_senses(["blood", "colloquial pr. [xie3]"]) == ["blood"]
    assert cedict_senses(["abbr. for 哈萨克斯坦[Ha1 sa4 ke4 si1 tan3], Kazakhstan"]) == []
    assert cedict_senses(["(interj.) ha!", "(onom. for laughter)"]) == ["(interj.) ha!", "(onom. for laughter)"]
    assert cedict_senses(["high speed", "expressway (abbr. for 高速公路[gao1 su4 gong1 lu4])"]) == \
        ["high speed", "expressway"]
    assert cedict_senses(["first of the ten Heavenly Stems 十天干[shi2 tian1 gan1]", "armor"]) == \
        ["first of the ten Heavenly Stems", "armor"]
    assert cedict_senses(["basin", "unit of volume equal to 12 斗[dou3] and 8 升[sheng1]"]) == ["basin"]
    assert cedict_senses(["copper (chemistry)", "see also 紅銅|红铜[hong2 tong2]"]) == ["copper (chemistry)"]
    assert cedict_senses(["variant of 記錄|记录[ji4 lu4] (but in Taiwan, not for the verb sense)"]) == []


def test_cedict_senses_register_labels():
    assert cedict_senses(["to kick", "to play (e.g. soccer)", "(slang) butch (in a lesbian relationship)"]) == \
        ["to kick", "to play (e.g. soccer)"]
    assert cedict_senses(["(coll.) mother's mother", "maternal grandmother"]) == \
        ["mother's mother", "maternal grandmother"]
    assert cedict_senses(["currency", "(old) exchange of goods"]) == ["currency"]
    assert cedict_senses(["(literary) to be deficient in", "to owe"]) == ["to owe", "(literary) to be deficient in"]
