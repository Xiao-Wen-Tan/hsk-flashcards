from decode import (body_text, build_index, candidates, complete_as_public, coverage, effective_bans, match_head,
                    solve)


def W(hz, py, level):
    return {"simplified": hz, "hsk": level, "forms": [{"transcriptions": {"pinyin": py}}]}


INDEX = build_index([W("八", "bā", 1), W("帮", "bāng", 3), W("吧", "ba", 2), W("不客气", "bù kè qi", 1),
                     W("他", "tā", 1), W("她", "tā", 1), W("他们", "tā men", 1), W("爱", "ài", 1),
                     W("啊", "a", 3)])


def test_longest_exact_pinyin_wins():
    assert candidates(1, " bāng v. help ", 3, INDEX) == ["帮"]
    assert candidates(1, " bā num. eight ", 1, INDEX) == ["八"]


def test_no_space_between_pinyin_and_part_of_speech():
    assert candidates(1, " àiv. love ", 1, INDEX) == ["爱"]


def test_tone_change_falls_back_to_toneless():
    assert candidates(3, " bú kèqi You’re welcome. ", 1, INDEX) == ["不客气"]


def test_homophones_stay_ambiguous():
    assert candidates(1, " tā pron. he ", 1, INDEX) == ["他", "她"]


def test_level_rule_falls_back_when_nothing_fits_the_file_level():
    assert candidates(1, " bāng v. help ", 1, INDEX) == ["帮"]


def test_solve_propagates_from_unique_entries():
    items = [([1], ["他", "她"]), ([1, 2], ["他们"]), ([3], ["他", "她"])]
    fwd, conflicts = solve(items, {})
    assert fwd == {1: "他", 2: "们", 3: "她"}
    assert conflicts == {}


def test_solve_repeated_code_in_one_word():
    fwd, _ = solve([([7, 7], ["爸爸"])], {})
    assert fwd == {7: "爸"}


def test_solve_majority_vote_records_conflict():
    fwd, conflicts = solve([([5], ["好"]), ([5], ["好"]), ([5], ["号"])], {})
    assert fwd[5] == "好"
    assert conflicts[5] == {"好": 2, "号": 1}


def test_solve_keeps_seed_and_stops_when_two_codes_want_one_character():
    fwd, conflicts = solve([([1], ["水"]), ([2], ["水"])], {9: "火"})
    assert fwd[9] == "火"
    assert list(fwd.values()).count("水") == 1
    assert 1 in conflicts or 2 in conflicts


def test_coverage_and_body_text():
    entry = {"file": 1, "n": 1, "head": [1],
             "tokens": [["c", [835, 1, 836]], ["l", " tā pron. he "], ["c", [1, 2, 822]]]}
    per_file, body_total, body_ok, unresolved, example, all_cids = coverage([entry], {1: "他", 822: "。"})
    assert per_file[1]["heads_ok"] == 1
    assert (body_total, body_ok) == (3, 2)
    assert unresolved == {2: 1}
    assert example[2] == "HSK1 #1"
    assert body_text(entry, {1: "他", 822: "。"}) == "他□。"


# Words whose pinyin runs on into the part of speech or the English, as in the real list.
TRAPS = build_index([W("八", "bā", 1), W("班", "bān", 2), W("一", "yī", 1), W("阴", "yīn", 3),
                     W("家", "jiā", 1), W("煎", "jiān", 5), W("啊", "ā", 3), W("馋", "chán", 6),
                     W("长", "cháng", 6), W("发言", "fā yán", 5), W("发扬", "fā yáng", 6),
                     W("爱", "ài", 1), W("策略", "cè lu:è", 6), W("了", "le", 1), W("的", "de", 1),
                     W("胖", "pàng", 3), W("打交道", "dǎ jiāo dào", 5), W("慌忙", "huāng máng", 6),
                     W("小心翼翼", "xiǎo xīn yì yì", 6)])


def test_match_must_end_at_a_word_boundary():
    assert candidates(1, " bā num. eight ", 1, TRAPS) == ["八"]
    assert candidates(1, " yī num. one ", 1, TRAPS) == ["一"]
    assert candidates(1, " chán greedy; gluttonous ", 6, TRAPS) == ["馋"]
    assert candidates(2, " fā yán give a speech ", 5, TRAPS) == ["发言"]
    assert candidates(1, " ān adj. safe ", 1, TRAPS) == []


def test_part_of_speech_stuck_to_the_pinyin_is_a_boundary():
    assert candidates(1, " jiān. home; family ", 1, TRAPS) == ["家"]
    assert candidates(1, " àiv. love ", 1, TRAPS) == ["爱"]
    assert candidates(1, " bān n. class ", 2, TRAPS) == ["班"]


def test_u_colon_in_public_list_matches_pdf_u_umlaut():
    assert candidates(2, " cè lüè tactful;strategy;tactics ", 6, TRAPS) == ["策略"]


def test_other_part_of_speech_spellings_seen_in_the_pdfs():
    assert candidates(1, " lemp. used at the end of a sentence ", 3, TRAPS) == ["了"]
    assert candidates(1, " desa. of (marker of attributive) ", 3, TRAPS) == ["的"]
    assert candidates(1, " pàngadj fat ", 3, TRAPS) == ["胖"]


def test_english_stuck_to_the_pinyin_still_matches_when_nothing_else_does():
    assert candidates(3, " dǎ jiāodaohave dealings with ", 5, TRAPS) == ["打交道"]
    assert candidates(2, " huāng mángin a great rush ", 6, TRAPS) == ["慌忙"]
    assert candidates(4, " xiǎo xīn yì yìcautiously ", 6, TRAPS) == ["小心翼翼"]


# 号 is level 2 in the public list but sits in the HSK 1 PDF, and 好 also has a hào reading.
LEVELS = build_index([{"simplified": "好", "hsk": 1, "forms": [{"transcriptions": {"pinyin": "hǎo"}},
                                                              {"transcriptions": {"pinyin": "hào"}}]},
                      W("号", "hào", 2), W("你好", "nǐ hǎo", 1), W("他", "tā", 1), W("她", "tā", 1),
                      W("它", "tā", 2), W("他们", "tā men", 1)])


def test_level_rule_can_be_switched_off():
    assert candidates(1, " hào n. date ", 1, LEVELS) == ["好"]
    assert candidates(1, " hào n. date ", 1, LEVELS, use_level=False) == ["号", "好"]


def test_level_preference_only_settles_what_the_level_free_pass_leaves():
    entries = [([1], " hào n. date ", 1), ([2, 3], " nǐ hǎo hello ", 1), ([4], " tā pron. he ", 1),
               ([4, 5], " tā men pron. they ", 1), ([6], " tā pron. she ", 1)]
    loose = [(h, candidates(len(h), t, f, LEVELS, use_level=False)) for h, t, f in entries]
    strict = [(h, candidates(len(h), t, f, LEVELS)) for h, t, f in entries]
    fwd, conflicts = solve(loose, {}, fallback=strict)
    assert fwd == {1: "号", 2: "你", 3: "好", 4: "他", 5: "们", 6: "她"}
    assert conflicts == {}


# The complete list (data/public/hsk_complete_vNNN.json) tags each word with levels such as
# "old-2" (HSK 2.0), "new-1" (HSK 3.0 of 2021) and "newest-1", and has no "hsk" field.
def CW(hz, py, levels, radical="一"):
    return {"simplified": hz, "radical": radical, "level": levels,
            "forms": [{"transcriptions": {"pinyin": py}}]}


def test_complete_as_public_takes_lowest_old_level_then_lowest_new_level_else_9():
    words = [CW("天", "tiān", ["newest-1", "new-1"], radical="大"), CW("甜", "tián", ["new-3", "old-2"]),
             CW("阿拉伯语", "ā lā bó yǔ", ["newest-7"]), CW("班", "bān", ["new-1", "old-3"]),
             CW("本", "běn", ["old-4", "old-2"]), CW("爱", "ài", ["newest-1", "new-2"])]
    out = complete_as_public(words)
    assert [w["hsk"] for w in out] == [1, 2, 9, 3, 2, 2]
    assert out[0]["radical"] == "大" and out[0]["level"] == ["newest-1", "new-1"]
    assert all("hsk" not in w for w in words)  # the input words are copied, not changed


OLD = build_index([W("甜", "tián", 3), W("八", "bā", 1)])
COMPLETE = build_index(complete_as_public([CW("天", "tiān", ["newest-1", "new-1"]),
                                           CW("甜", "tián", ["new-3", "old-3"]),
                                           CW("八", "bā", ["new-1", "old-1"]), CW("巴", "bā", ["new-5"]),
                                           CW("说", "shuō", ["newest-1", "new-1"])]))


def test_exact_match_in_complete_list_beats_toneless_match_in_old_list():
    assert candidates(1, " tiān n. sky ", 1, OLD) == ["甜"]
    assert candidates(1, " tiān n. sky ", 1, [OLD, COMPLETE]) == ["天"]


def test_earlier_index_wins_when_both_match_equally_well():
    assert candidates(1, " bā num. eight ", 1, [OLD, COMPLETE]) == ["八"]
    assert candidates(1, " bā num. eight ", 1, [COMPLETE], use_level=False) == ["八", "巴"]


def test_word_missing_from_old_list_is_found_in_complete_list():
    assert candidates(1, " shuō v. speak ", 1, OLD) == []
    assert candidates(1, " shuō v. speak ", 1, [OLD, COMPLETE]) == ["说"]


def test_banned_pair_is_never_learned():
    assert solve([([1], ["他"])], {}, banned={(1, "他")}) == ({}, {})
    fwd, _ = solve([([1], ["他", "她"])], {}, banned={(1, "他")})
    assert fwd == {1: "她"}


def test_banned_does_not_touch_seeds():
    assert solve([], {1: "他"}, banned={(1, "他")}) == ({1: "他"}, {})
    fwd, _ = solve([([2], ["他"])], {1: "他"}, banned={(1, "他")})
    assert fwd == {1: "他"}


def test_banned_also_applies_to_the_fallback_pass():
    assert solve([], {}, fallback=[([1], ["他"])]) == ({1: "他"}, {})
    assert solve([], {}, fallback=[([1], ["他"])], banned={(1, "他")}) == ({}, {})
    assert solve([([1], ["他"])], {}, fallback=[], banned={(1, "他")}) == ({}, {})


# HSK 1 to 4 entry #142 prints its headword as 这（这儿）: codes 6959, 1153 （, 6959, 1583 儿, 1154 ）.
def test_match_head_stops_at_the_opening_bracket():
    assert match_head([6959, 1153, 6959, 1583, 1154]) == [6959]
    assert match_head([7054, 1153, 7054, 1583, 1154]) == [7054]
    assert match_head([4545, 4545]) == [4545, 4545]
    assert match_head([]) == []


def test_bracketed_variant_decodes_through_match_head():
    index = build_index([W("这", "zhè", 1), W("那", "nà", 1)])
    head = [6959, 1153, 6959, 1583, 1154]
    assert candidates(len(head), " zhè pron. this ", 1, index) == []
    hzs = candidates(len(match_head(head)), " zhè pron. this ", 1, index)
    assert hzs == ["这"]
    fwd, _ = solve([(match_head(head), hzs)], {1153: "（", 1154: "）"})
    assert fwd[6959] == "这"


# The PDFs write the 儿 ending as a separate "er"; both public lists write "r".
ERHUA = build_index([W("干活儿", "gàn huó r", 5), W("大伙儿", "dà huǒ r", 6), W("玩意儿", "wán yì r", 6),
                     W("竖", "shù", 6), W("干活", "gàn huó", 5)])


def test_erhua_er_is_retried_as_r():
    assert candidates(3, " gàn huó er do manual labour ", 5, ERHUA) == ["干活儿"]
    assert candidates(3, "dà huǒ er everybody ", 6, ERHUA) == ["大伙儿"]
    assert candidates(3, " wán yì er, thing;toy ", 6, ERHUA) == ["玩意儿"]
    assert candidates(3, " wán yì er", 6, ERHUA) == ["玩意儿"]


def test_erhua_retry_leaves_other_er_alone():
    assert candidates(1, " shù erect; stand ", 6, ERHUA) == ["竖"]
    assert candidates(3, " gàn huó error ", 5, ERHUA) == []
    assert candidates(3, " gàn huó er2 ", 5, ERHUA) == []


def test_effective_bans_converts_cids_and_drops_pairs_the_glyph_seed_confirms():
    banned = {("6959", "这"), ("7054", "那"), (15, ",")}
    assert effective_bans(banned, {6959: "这", 7054: "哪"}) == {(7054, "那"), (15, ",")}
    assert effective_bans([], {1: "他"}) == set()
    assert effective_bans([("1", "他")], {}) == {(1, "他")}
