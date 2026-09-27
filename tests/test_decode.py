from decode import body_text, build_index, candidates, coverage, solve


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
