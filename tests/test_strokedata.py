import base64
import hashlib
import io
import tarfile

import pytest

from strokedata import (HANZI_WRITER, check_integrity, han_chars, read_members, stroke_name,
                        tarball_url, vendor, write_same_or_new)


def make_tgz(files):
    """A small .tgz in memory with {name: bytes}."""
    buf = io.BytesIO()
    with tarfile.open(fileobj=buf, mode="w:gz") as tar:
        for name, data in files.items():
            info = tarfile.TarInfo(name)
            info.size = len(data)
            tar.addfile(info, io.BytesIO(data))
    return buf.getvalue()


def test_names_and_urls():
    assert stroke_name("爱") == "7231.json"
    assert stroke_name("苹") == "82f9.json"
    assert tarball_url(HANZI_WRITER) == "https://registry.npmjs.org/hanzi-writer/-/hanzi-writer-3.7.3.tgz"


def test_han_chars_skips_pattern_marks_and_letters():
    words = [{"hz": "虽然…但是…"}, {"hz": "卡拉OK"}, {"hz": "但是"}]
    assert han_chars(words) == sorted(["虽", "然", "但", "是", "卡", "拉"])


def test_check_integrity():
    data = b"hello"
    good = "sha512-" + base64.b64encode(hashlib.sha512(data).digest()).decode()
    check_integrity(data, good)
    with pytest.raises(ValueError, match="checksum mismatch"):
        check_integrity(b"other", good)


def test_read_members_keeps_only_wanted_files():
    tgz = make_tgz({"package/爱.json": b"{}", "package/README.md": b"x"})
    assert read_members(tgz, ["package/爱.json", "package/我.json"]) == {"package/爱.json": b"{}"}


def test_write_same_or_new_never_overwrites(tmp_path):
    p = tmp_path / "a" / "7231.json"
    assert write_same_or_new(p, b"1") == "new"
    assert write_same_or_new(p, b"1") == "same"
    with pytest.raises(FileExistsError):
        write_same_or_new(p, b"2")
    assert p.read_bytes() == b"1"


def test_vendor_writes_library_licences_and_strokes(tmp_path):
    writer = make_tgz({"package/dist/index.esm.js": b"export default 1;", "package/LICENSE": b"MIT"})
    data = make_tgz({"package/爱.json": b'{"strokes":[]}', "package/ARPHICPL.TXT": b"APL"})
    tally = vendor(tmp_path, [{"hz": "爱"}, {"hz": "嗯"}], writer, data)
    assert tally == {"new": 4, "same": 0, "missing": ["嗯"]}
    assert (tmp_path / "vendor" / "hanzi-writer-3.7.3.esm.js").read_bytes() == b"export default 1;"
    assert (tmp_path / "vendor" / "hanzi-writer-LICENSE.txt").read_bytes() == b"MIT"
    assert (tmp_path / "strokes" / "ARPHICPL.TXT").read_bytes() == b"APL"
    assert (tmp_path / "strokes" / "7231.json").read_bytes() == b'{"strokes":[]}'
    again = vendor(tmp_path, [{"hz": "爱"}], writer, data)
    assert again == {"new": 0, "same": 4, "missing": []}


def test_vendor_without_words_writes_only_the_library(tmp_path):
    writer = make_tgz({"package/dist/index.esm.js": b"x", "package/LICENSE": b"MIT"})
    assert vendor(tmp_path, [], writer, b"") == {"new": 2, "same": 0, "missing": []}
    assert not (tmp_path / "strokes").exists()
