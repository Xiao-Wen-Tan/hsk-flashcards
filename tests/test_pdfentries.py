from pdfentries import group_entries, head_of, latin_of
from pdfread import Run


def L(x, text, y=100.0, page=0):
    return Run(page, x, y, "l", text=text)


def C(x, cids, y=100.0, page=0):
    return Run(page, x, y, "c", cids=cids)


def test_groups_entries_and_merges_adjacent_tokens():
    runs = [L(248, "HSk 1 Vocabulary", 36),
            L(10, "1 ", 140), C(20, [835, 4541, 836], 140), L(59, " ", 140), L(70, "à", 140),
            L(80, "i v. love ", 140), C(113, [3183, 1239], 140), C(10, [822], 150),
            L(10, "2 ", 179), C(20, [835, 1603, 836], 179), L(59, " bā num. eight ", 179)]
    entries = group_entries(runs)
    assert [e["n"] for e in entries] == [1, 2]
    assert entries[0]["tokens"] == [["c", [835, 4541, 836]], ["l", " ài v. love "], ["c", [3183, 1239, 822]]]
    assert head_of(entries[0]) == [4541]
    assert latin_of(entries[1]) == " bā num. eight "


def test_ignores_out_of_sequence_numbers_and_noise():
    runs = [L(10, "1 ", 10), C(20, [4541, 822], 10), L(40, " ài love ", 10),
            L(10, "B", 20),                                                   # section letter
            C(10, [2855, 1897], 30), L(36, " ", 30), C(39, [6575, 4068], 30),  # column titles
            L(10, "7 ", 40),                                                  # not the next number
            L(200, "2020/1/7 ", 50),                                          # footer date
            L(10, "2 ", 60), C(20, [1603], 60)]
    entries = group_entries(runs)
    assert [e["n"] for e in entries] == [1, 2]
    assert head_of(entries[0]) == [4541]
    assert entries[0]["tokens"] == [["c", [4541, 822]], ["l", " ài love 7 "]]


def test_missing_parts_give_empty_values():
    entry = {"n": 1, "page": 0, "tokens": [["l", " ài love "]]}
    assert head_of(entry) == []
    assert latin_of(entry) == ""


def test_entry_number_printed_with_inner_space():
    # HSK 5 prints entry 318 as "31 8 " and HSK 6 prints 810 as "81 0 "
    runs = [L(10, "31 7 ", 10), C(20, [4541], 10), L(40, " ài love ", 10),
            L(10, "31 8 ", 20), C(20, [1603], 20), L(40, " bā eight ", 20)]
    entries = group_entries([L(10, str(n) + " ", n) for n in range(1, 317)] + runs)
    assert [e["n"] for e in entries][-2:] == [317, 318]
    assert latin_of(entries[-2]) == " ài love "
    assert head_of(entries[-1]) == [1603]


def test_one_missing_number_is_skipped_and_recorded():
    # the HSK 4 file jumps from 676 to 678; entry 677 is not printed anywhere
    runs = [L(10, "1 ", 10), C(20, [3200], 10), L(40, " dài wear ", 10),
            L(10, "3 ", 20), C(20, [2926], 20), L(40, " dāngshí at that time ", 20),
            L(10, "4 ", 30), C(20, [1679], 30), L(40, " dāo knife ", 30)]
    entries = group_entries(runs)
    assert [e["n"] for e in entries] == [1, 3, 4]
    assert entries[1]["skipped"] == [2]
    assert "skipped" not in entries[0] and "skipped" not in entries[2]
    assert latin_of(entries[0]) == " dài wear "


def test_headword_split_by_space_or_ellipsis():
    # HSK 6 #27 draws the headword as two Chinese runs with a lone space between them
    runs = [L(10, "1 ", 10), C(20, [3281], 10), L(30, " ", 10), C(35, [5959], 10),
            L(50, " bá miáo help the shoots grow ", 10), C(200, [3281, 5959, 822], 10),
            # the pattern words wrap "……" between the parts of the headword
            L(10, "2 ", 20), C(20, [835, 6257, 4496], 20), L(40, "……", 20), C(50, [1429, 3598], 20),
            L(70, "……", 20), C(80, [836], 20), L(90, " suīrán…dànshì… conj. although ", 20),
            C(200, [1239, 822], 20)]
    entries = group_entries(runs)
    assert head_of(entries[0]) == [3281, 5959]
    assert latin_of(entries[0]) == " bá miáo help the shoots grow "
    assert entries[0]["tokens"][2] == ["c", [3281, 5959, 822]]
    assert head_of(entries[1]) == [6257, 4496, 1429, 3598]
    assert latin_of(entries[1]) == " suīrán…dànshì… conj. although "
    assert entries[1]["tokens"][2] == ["c", [1239, 822]]
