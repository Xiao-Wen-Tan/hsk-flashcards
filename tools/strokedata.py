"""Vendoring Hanzi Writer and its stroke data into docs/ (copying them into the site).

Hanzi Writer (MIT licence) animates stroke order, and hanzi-writer-data (Arphic Public
License) holds one small JSON file of strokes per character. Both are fetched once from the
npm registry as pinned versions, checked against the registry's published checksum, and
unpacked. The app then loads them from its own site, so stroke order works offline.

A stroke file is named by the character's code point in hexadecimal, in a folder named by its first two
digits: 爱 (U+7231) is "72/7231.json". docs/js/strokes.js uses the same names.
"""
import base64
import hashlib
import io
import tarfile
import urllib.request
from pathlib import Path

HANZI_WRITER = {
    "name": "hanzi-writer",
    "version": "3.7.3",
    "integrity": "sha512-fdOFrb1cXWL/pV/oplJkcdziCvjJzhhf+qoIBm5IpVGxPBZEu4eLB6ZG5RJDbKXyNbNlyx8oIpa3XrcUBcSXpg==",
}
HANZI_WRITER_DATA = {
    "name": "hanzi-writer-data",
    "version": "2.0.1",
    "integrity": "sha512-nbQwM+MaryGoq7pBMIZLCd3lFq03nXuJuwku1+6UbjL58uU+9OULVcMkoNvNuJSoIV7f1bbPRfD4D/LQa5S7qg==",
}
# What the app needs from the Hanzi Writer package: {path inside the package: path under docs/}.
WRITER_FILES = {
    "package/dist/index.esm.js": "vendor/hanzi-writer-3.7.3.esm.js",
    "package/LICENSE": "vendor/hanzi-writer-LICENSE.txt",
}
DATA_LICENSE = ("package/ARPHICPL.TXT", "strokes/ARPHICPL.TXT")

# Unicode blocks of the Han script, the same set as /\p{Script=Han}/ in strokes.js for
# every character the word list can hold.
_HAN = [(0x2E80, 0x2FDF), (0x3005, 0x3005), (0x3007, 0x3007), (0x3021, 0x3029), (0x3038, 0x303B),
        (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF), (0x20000, 0x3FFFF)]


def tarball_url(pkg):
    """tarball_url(HANZI_WRITER) gives https://registry.npmjs.org/hanzi-writer/-/hanzi-writer-3.7.3.tgz."""
    return f"https://registry.npmjs.org/{pkg['name']}/-/{pkg['name']}-{pkg['version']}.tgz"


def check_integrity(data, integrity):
    """Raise ValueError unless data matches an npm integrity string such as "sha512-<base64>"."""
    algo, expected = integrity.split("-", 1)
    got = base64.b64encode(hashlib.new(algo, data).digest()).decode("ascii")
    if got != expected:
        raise ValueError(f"checksum mismatch: expected {algo}-{expected}, got {algo}-{got}")


def download(pkg):
    """The package's .tgz bytes, checked against its pinned checksum."""
    with urllib.request.urlopen(tarball_url(pkg), timeout=120) as res:
        data = res.read()
    check_integrity(data, pkg["integrity"])
    return data


def read_members(tgz, names):
    """{name: bytes} for the wanted names that the .tgz holds. Missing names are left out."""
    wanted = set(names)
    out = {}
    with tarfile.open(fileobj=io.BytesIO(tgz), mode="r:gz") as tar:
        for member in tar:
            if member.isfile() and member.name in wanted:
                out[member.name] = tar.extractfile(member).read()
    return out


def is_han(ch):
    return any(lo <= ord(ch) <= hi for lo, hi in _HAN)


def han_chars(words):
    """The distinct Chinese characters of the headwords, sorted. A pattern word's "…" is skipped."""
    return sorted({ch for w in words for ch in w["hz"] if is_han(ch)})


def stroke_name(ch):
    """stroke_name("爱") gives "72/7231.json": the folder is the first two hex digits of the code point, so
    no folder holds more than a few dozen of the 2,637 files. docs/js/strokes.js strokeUrl makes the same name."""
    code = f"{ord(ch):x}"
    return f"{code[:2]}/{code}.json"


def write_same_or_new(path, data):
    """Write bytes to a new file. An existing file with the same bytes is kept ("same").
    An existing file with other bytes is never replaced: that raises FileExistsError."""
    path = Path(path)
    if path.exists():
        if path.read_bytes() == data:
            return "same"
        raise FileExistsError(f"{path} exists with other content. It is never overwritten.")
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "xb") as f:
        f.write(data)
    return "new"


def vendor(docs, words, writer_tgz, data_tgz):
    """Write the library, its licence, and the stroke data of every character of `words`
    (with the data licence) under the docs folder. Returns {"new": n, "same": n, "missing": [chars]}."""
    docs = Path(docs)
    tally = {"new": 0, "same": 0, "missing": []}
    got = read_members(writer_tgz, WRITER_FILES)
    for inside, target in WRITER_FILES.items():
        tally[write_same_or_new(docs / target, got[inside])] += 1
    chars = han_chars(words)
    if not chars:
        return tally
    names = {f"package/{ch}.json": ch for ch in chars}
    got = read_members(data_tgz, [*names, DATA_LICENSE[0]])
    tally[write_same_or_new(docs / DATA_LICENSE[1], got[DATA_LICENSE[0]])] += 1
    for inside, ch in names.items():
        if inside not in got:
            tally["missing"].append(ch)
            continue
        tally[write_same_or_new(docs / "strokes" / stroke_name(ch), got[inside])] += 1
    return tally
