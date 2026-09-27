import random
from pathlib import Path

import matplotlib.image as mpimg
import pytest

from glyphsheets import (check_glyph_reads, check_verify, choose_planted, draw_sheet, draw_verify_sheet,
                         find_cjk_font, glyph_outlines, radical_table)

PDF = Path("../HSK 词汇 6本/HSK1 词汇.pdf")

# 妈 好 她 share the radical 女, 吃 喝 叫 share 口, 。 has no radical.
FWD = {1: "妈", 2: "好", 3: "她", 4: "吃", 5: "喝", 6: "叫", 7: "。"}
RADICAL = {"妈": "女", "好": "女", "她": "女", "吃": "口", "喝": "口", "叫": "口"}


def test_radical_table_keeps_single_characters_only():
    words = [{"simplified": "妈", "radical": "女"}, {"simplified": "妈妈", "radical": "女"},
             {"simplified": "吗", "radical": ""}, {"simplified": "了"}]
    assert radical_table(words) == {"妈": "女"}


def test_choose_planted_prefers_same_radical():
    planted = choose_planted(sorted(FWD), FWD, RADICAL, 1.0, random.Random(1))
    for cid in (1, 2, 3, 4, 5, 6):
        assert planted[cid] != FWD[cid]
        assert RADICAL[planted[cid]] == RADICAL[FWD[cid]]


def test_choose_planted_falls_back_to_any_other_decoded_character():
    fwd = {1: "。", 2: "妈", 3: "吃"}
    for seed in range(20):
        planted = choose_planted([1, 2, 3], fwd, RADICAL, 1.0, random.Random(seed))
        assert set(planted) == {1, 2, 3}
        for cid, shown in planted.items():
            assert shown != fwd[cid] and shown in fwd.values()


def test_choose_planted_never_shows_the_true_character():
    fwd = {cid: chr(0x4E00 + cid) for cid in range(200)}
    radical = {ch: "r%d" % (cid % 7) for cid, ch in fwd.items()}
    for seed in range(20):
        planted = choose_planted(sorted(fwd), fwd, radical, 0.3, random.Random(seed))
        assert planted and all(shown != fwd[cid] for cid, shown in planted.items())


def test_choose_planted_is_deterministic_for_a_seeded_rng():
    first = choose_planted(sorted(FWD), FWD, RADICAL, 0.5, random.Random(13))
    second = choose_planted(sorted(FWD), FWD, RADICAL, 0.5, random.Random(13))
    assert first == second


def test_choose_planted_count_is_near_the_rate():
    fwd = {cid: chr(0x4E00 + cid) for cid in range(1000)}
    assert 45 <= len(choose_planted(sorted(fwd), fwd, {}, 0.05, random.Random(13))) <= 55
    assert len(choose_planted(list(range(60)), fwd, {}, 0.05, random.Random(13))) == 3
    assert len(choose_planted(list(range(10)), fwd, {}, 0.05, random.Random(13))) == 1
    assert choose_planted([], fwd, {}, 0.05, random.Random(13)) == {}


KEY = [{"cell": "1", "cid": "100", "control": "0", "known_char": ""},
       {"cell": "2", "cid": "200", "control": "1", "known_char": "爱"},
       {"cell": "3", "cid": "300", "control": "0", "known_char": ""},
       {"cell": "4", "cid": "400", "control": "0", "known_char": ""}]


def test_check_glyph_reads_seeds_readings_and_ignores_question_marks():
    seed, failures = check_glyph_reads(KEY, {1: " 的 ", 2: "爱", 3: "?"})
    assert seed == {100: "的"}
    assert failures == []


def test_check_glyph_reads_controls_must_match():
    seed, failures = check_glyph_reads(KEY, {1: "的", 2: "受"})
    assert failures == [(2, "受", "爱")]
    assert seed == {100: "的"}
    _, failures = check_glyph_reads(KEY, {1: "的", 2: "?"})
    assert failures == [(2, "?", "爱")]
    _, failures = check_glyph_reads(KEY, {1: "的"})
    assert failures == [(2, "?", "爱")]


VERIFY_KEY = [{"cell": str(n), "cid": str(100 * n), "shown_char": s, "true_char": t, "planted": p}
              for n, s, t, p in [(1, "爱", "爱", "0"), (2, "她", "妈", "1"), (3, "好", "好", "0"),
                                 (4, "喝", "吃", "1"), (5, "叫", "叫", "0")]]


def test_check_verify_finds_missed_planted_cells_and_suspects():
    missed, suspects = check_verify(VERIFY_KEY, {2, 3})
    assert missed == [4]
    assert suspects == [(300, "好")]


def test_check_verify_all_planted_caught():
    assert check_verify(VERIFY_KEY, {2, 4}) == ([], [])
    assert check_verify(VERIFY_KEY, {1, 2, 4, 5}) == ([], [(100, "爱"), (500, "叫")])


def test_find_cjk_font_returns_an_existing_file():
    assert Path(find_cjk_font()).is_file()


def test_find_cjk_font_raises_when_no_family_is_installed():
    with pytest.raises(RuntimeError):
        find_cjk_font(("No Such Font Family 123",))


def _longest_dark_row_run(png):
    """Height in pixels of the tallest band of rows that contain dark (ink) pixels."""
    img = mpimg.imread(png)
    dark = (img[:, :, :3].mean(axis=2) < 0.3).any(axis=1)
    best = run = 0
    for d in dark:
        run = run + 1 if d else 0
        best = max(best, run)
    return best


@pytest.mark.skipif(not PDF.exists(), reason="vocabulary PDF not found")
def test_glyph_outlines_and_sheets_draw(tmp_path):
    outlines = glyph_outlines({4541, 822, 1239, 65000}, [PDF])  # 爱, 。, ～ and a code the font lacks
    assert set(outlines) == {4541, 822, 1239}
    assert outlines[4541].get_extents().height > 800

    verify = tmp_path / "sheet_01.png"
    draw_verify_sheet([(1, 4541, "爱"), (2, 822, "。"), (3, 1239, "口")], outlines, find_cjk_font(), verify)
    assert verify.is_file()
    assert _longest_dark_row_run(verify) >= 80  # characters at least about 80 pixels tall

    unknown = tmp_path / "unknown_01.png"
    draw_sheet([(1, 4541), (2, 822), (3, 65000)], outlines, unknown)
    assert unknown.is_file()
