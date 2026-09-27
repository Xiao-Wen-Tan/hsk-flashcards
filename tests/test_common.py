import pytest

from common import (latest_version_path, next_version_path, next_versions, read_csv, write_new_csv,
                    write_new_text)


def test_first_version_is_v001(tmp_path):
    p = next_version_path(tmp_path / "out" / "thing", ".csv")
    assert p == tmp_path / "out" / "thing_v001.csv"
    assert p.parent.is_dir()


def test_next_version_skips_existing(tmp_path):
    (tmp_path / "thing_v001.csv").write_text("a")
    (tmp_path / "thing_v002.csv").write_text("b")
    assert next_version_path(tmp_path / "thing", ".csv").name == "thing_v003.csv"


def test_other_stems_do_not_count(tmp_path):
    (tmp_path / "thing2_v005.csv").write_text("a")
    (tmp_path / "thing_key_v009.csv").write_text("a")
    assert next_version_path(tmp_path / "thing", ".csv").name == "thing_v001.csv"


def test_shared_version_across_outputs(tmp_path):
    (tmp_path / "a_v004.csv").write_text("x")
    paths = next_versions(a=(tmp_path / "a", ".csv"), b=(tmp_path / "b", ".txt"))
    assert paths["a"].name == "a_v005.csv"
    assert paths["b"].name == "b_v005.txt"


def test_folders_count_as_versions(tmp_path):
    (tmp_path / "sheets_v001").mkdir()
    assert next_version_path(tmp_path / "sheets", "").name == "sheets_v002"


def test_write_new_refuses_to_overwrite(tmp_path):
    p = tmp_path / "x_v001.txt"
    write_new_text(p, "first")
    with pytest.raises(FileExistsError):
        write_new_text(p, "second")
    assert p.read_text(encoding="utf-8") == "first"


def test_latest_version_path(tmp_path):
    (tmp_path / "t_v001.json").write_text("1")
    (tmp_path / "t_v002.json").write_text("2")
    assert latest_version_path(tmp_path / "t", ".json").name == "t_v002.json"
    with pytest.raises(FileNotFoundError):
        latest_version_path(tmp_path / "missing", ".json")


def test_csv_round_trip_with_excel_bom(tmp_path):
    p = tmp_path / "c_v001.csv"
    write_new_csv(p, ["hz", "py"], [["爱", "ài"]], excel=True)
    assert p.read_bytes().startswith(b"\xef\xbb\xbf")
    assert read_csv(p) == [{"hz": "爱", "py": "ài"}]
