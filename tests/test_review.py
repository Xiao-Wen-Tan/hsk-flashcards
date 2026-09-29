from review import check_review, check_theme_list

WORDS = {"w1": {"hz": "爱"}, "w2": {"hz": "八"}}
GENERATED = [{"id": "w1", "hz": "爱", "theme_no": "20", "theme_name": "Feelings"},
             {"id": "w2", "hz": "八", "theme_no": "3", "theme_name": "Numbers & Measure Words"}]


def test_an_unchanged_or_moved_sheet_is_accepted():
    assert check_review(WORDS, GENERATED, [dict(r) for r in GENERATED]) == ([], {"w1": 20, "w2": 3})
    moved = [dict(GENERATED[0], theme_no="22"), dict(GENERATED[1])]
    assert check_review(WORDS, GENERATED, moved) == ([], {"w1": 22, "w2": 3})


def test_review_problems():
    reviewed = [dict(GENERATED[0], hz="?"), dict(GENERATED[1], theme_no="31"),
                dict(GENERATED[0], theme_name="Food & Drink")]
    problems, _ = check_review(WORDS, GENERATED, reviewed)
    assert problems == ["w1: characters read as '?', so the file was not saved as CSV UTF-8",
                        "w2: theme_no '31' is not 1 to 30",
                        "w1: theme_name was changed but theme_no was not; change theme_no to move a word",
                        "w1: appears 2 times"]
    problems, _ = check_review(WORDS, GENERATED, [dict(GENERATED[0])])
    assert problems == ["w2: missing from the sheet"]


def test_theme_list():
    rows = [{"theme_no": str(n), "order": str(31 - n), "name": f"T{n}"} for n in range(1, 31)]
    problems, order, names = check_theme_list(rows)
    assert problems == [] and order[:3] == [30, 29, 28] and names[1] == "T1"
    problems, _, _ = check_theme_list(rows[:29] + [{"theme_no": "30", "order": "5", "name": ""}])
    assert problems == ["order must use 1 to 30, each once", "theme 30 has no name"]
