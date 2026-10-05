# Plan 1: Repository Setup and PDF Unscrambling

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create the project repository and recover the scrambled Chinese characters in the six HSK vocabulary PDFs. The plan ends with a coverage report for the user's first checkpoint.

**Architecture:** Small, tested Python modules do the work (`tools/common.py`, `pinyin_norm.py`, `pdfread.py`, `pdfentries.py`, `decode.py`). Thin numbered scripts chain them (`01_...` to `04b_...`).
- Each script reads the latest versioned output of the step before it and writes new `_vNNN` files. It never overwrites.
- The PDFs store Chinese as raw glyph codes (CIDs) with no character table. We read those codes from the page content and match each entry's pinyin against a public HSK 2.0 list to learn which code is which character.
- Codes that appear only in sentences are drawn as images and read by eye. Hidden check glyphs verify the reading.

**Tech Stack:** Python 3.10, pypdf 6.14, fontTools 4.43, matplotlib 3.10, pytest 9. git 2.54 with the git database kept outside Box.

**Spec:** `.claude/specs/2026-09-27-hsk-flashcards-design.md`

**Roadmap (later plans, written after this checkpoint):**
- Plan 2: app logic (review schedule, daily queue, quiz choices, storage) with tests.
- Plan 3: word list, themes, sentences, pinyin, audio.
- Plan 4: screens and offline app.
- Plan 5: Google Sheet backup and deployment.

---

## Facts verified before writing this plan (2026-09-27)

- **Fonts.** Entry text uses two fonts.
  - `ArialMT` carries the Latin text. One variant has MacRoman encoding and no table (`\x88` = à). The other variant has a ToUnicode table for tone vowels, for example code `0x21` = ā.
  - `PingFangSC-Regular` (Type0, Identity-H, empty ToUnicode) carries the Chinese as 2-byte glyph codes.
  - The footer fonts are `.PingFangSC-Regular` (with a leading dot, and it has a table for 11 codes), `.SFUIText` and `vant-icon-*`.
- **Layout of each entry (HSK1 page 1).** Each text run has its own `Tm` position.
  - Entry numbers sit at x = 10.0 (`"1 "`).
  - The HSK 1 to 4 headwords are wrapped in codes 835/836, for example `[835, 4541, 836]`.
  - The Latin text follows, for example `" àiv. love "`, and then the sentence codes. Code 1239 stands in for the headword, and 822 is 。.
- **HSK 5 and 6 layout.** These files have no brackets, section letters at x = 10 (`"A"`), and a column-title line whose first cell is `[2855, 1897]`. Some headwords carry a trailing 822.
- **Shared code numbers.** The footer font's table shares code numbers with the main font: 1153 = （, 1154 = ）, 5973 = 英, 6575 = 词, 4068 = 汇.
- **Glyph outlines.** The embedded font is CFF `CIDFontType0C` with FontMatrix 0.001 (1000 units), and glyphs are named `cid07095`.
- **Public list.** It comes from `drkameleon/complete-hsk-vocabulary` at commit `7ac65bf1a6387d35f1ade478906172a19311c7f9`, under the MIT licence. The exclusive old-HSK counts are 150, 147, 298, 598, 1298 and 2500.
- **Git identity.** No global git user name or email is set.

## Revisions after the build review (2026-09-27, these override the task text below)

Independent reviewers tested Tasks 2 to 6 and 8 on the real PDFs and found the following. All of it is fixed, tested and committed:
- **Entry numbers with an inner space.** HSK5 and HSK6 print some numbers as "31 8".
- **A number missing from the source.** The HSK4 PDF has no entry 677, so it has 1,199 entries.
- **Split headwords.** Some headwords are split by " " or "……".
- **Pinyin running on into the part of speech or the English.** " bā num. eight " matched 搬.
- **The "u:" spelling.** The public list writes ü this way.
- **The level rule turning homophones into wrong single answers.** `candidates(use_level=False)` and `solve(..., fallback=)` were added to fix it.

The remaining work changes as follows.

- **R1. New Task 4b.**
  - `tools/01b_fetch_complete_list.py` downloads `complete.json` from the same repository and commit (MIT) to `data/public/hsk_complete_v001.json`.
  - The reason is that the old-HSK list lacks everyday words that the PDFs contain (说, 没有, 哪儿, 一点儿, 他们, 天, 饭店).
  - Checks: there must be exactly 11,470 words, and those seven words must be present.
- **R2. `tools/decode.py` gets two changes.**
  - `complete_as_public(words)` returns the complete list in the public list's shape. It adds `"hsk"`, taken as the lowest `old-N` level if the word has one, else the lowest `new-N` level, else 9. For example, `["newest-1","new-1"]` gives 1, `["new-3","old-2"]` gives 2, and `["newest-7"]` gives 9.
  - `candidates(..., index, ...)` also accepts a list of indexes. The search order is: boundary strength (strong, then weak), then tone mode (exact, then toneless), then index order. The first non-empty match set wins.
  - So an exact match in the complete list beats a tone-ignored match in the old list. With old = {甜 tián} and complete = {天 tiān, 甜 tián}, `candidates(1, " tiān n. sky ", 1, [old, complete]) == ["天"]`.
  - With old = {八 bā} and complete = {八 bā, 巴 bā}, `" bā num. eight "` gives `["八"]`.
  - `solve(items, seed, fallback=None, banned=None)`: a candidate is inconsistent if any of its (cid, char) pairs is in `banned`. For example, `solve([([1], ["他"])], {}, banned={(1, "他")})` learns nothing.
  - Seeds are never affected by `banned`.
- **R3. Task 7 changes.**
  - `EXPECTED[4] = 1199` and `KNOWN_GAPS = {4: [677]}`.
  - Each output row keeps the entry's `"skipped"` list (empty if none).
  - The script stops, writing nothing, if the gaps found in any file differ from `KNOWN_GAPS`.
  - The expected final line becomes `Wrote 5309 entries ...`.
- **R4. Task 9 changes.**
  - `03_decode_glyphs.py` builds `indexes = [build_index(old), build_index(complete_as_public(complete))]`. It calls `solve(free_items, seeds, fallback=level_items, banned=banned)`.
    - `free_items` use `candidates(..., indexes, use_level=False)`.
    - `level_items` use the default `use_level=True`.
    - `banned` comes from the latest `data/decode/suspects_vNNN.csv` if one exists, else it is empty.
  - The match table's status uses the level-preferred live candidates, falling back to the level-free ones.
  - The report adds a count of entries matched only through the complete list.
- **R5. Blind reading of unknown glyphs (Task 11 Step 2) is done by two independent readers per sheet.**
  - A reading is accepted when both agree.
  - A disagreement goes to a third reader. Its answer is kept only if it matches one of the first two; otherwise the cell gets "?".
  - The merged result is written to `data/manual/glyph_reads_vNNN.csv`.
- **R6. New Task 11b, a visual check of every decoded code.**
  - **`tools/04c_render_verify.py`.** For every code in the latest cidmap, it draws the PDF glyph on the left and the proposed character on the right.
    - The right side uses a Windows Chinese font found by family name through matplotlib's font manager (Microsoft YaHei, DengXian or SimHei; no absolute path).
    - There are 60 cells per sheet.
    - About 5% of cells are planted errors. They show a different decoded character with the same radical (the radical comes from the complete list), falling back to any other decoded character.
    - Outputs: `data/decode/verify_vNNN/sheet_NN.png` and `data/decode/verify_key_vNNN.csv` (cell, cid, shown_char, true_char, planted).
  - **Readers.** Two independent readers per sheet list every cell whose two sides are not the same character. The union of their flags is written to `data/manual/verify_reads_vNNN.csv` (cell, flagged_by).
  - **`tools/04d_check_verify.py`.** Every planted cell must be flagged; if one is missed, the script stops and the reading must be redone. Flagged cells that were not planted become suspects, written to `data/decode/suspects_vNNN.csv` (cid, char).
  - **Next run.** The next `03` run bans the suspects, so those codes become unknown and go through a blind-reading round (R5), which either confirms or corrects them.
- **R7. The checkpoint report adds:**
  - the planted-error catch rate;
  - the number of suspects and how many of them the blind reading changed;
  - the number of PDF words that are missing from both public lists.

## File map

| File | Responsibility |
|---|---|
| `.gitignore`, `.gitattributes`, `README.md` | Repository basics |
| `.claude/CLAUDE.md` | Project instructions for Claude sessions |
| `tools/requirements.txt` | Python packages |
| `tools/common.py` | Versioned output paths, never-overwrite writers, readers |
| `tools/pinyin_norm.py` | Pinyin normalisation for matching |
| `tools/pdfread.py` | Text runs from a PDF page (glyph codes or decoded Latin), footer-font seed table |
| `tools/pdfentries.py` | Group runs into numbered entries, drop noise, pull out headword and Latin text |
| `tools/decode.py` | Candidate matching, code-to-character solver, coverage counts |
| `tools/01_fetch_public_list.py` | Download the pinned public list |
| `tools/02_extract_pdfs.py` | PDFs to `data/extract/pdf_entries_vNNN.jsonl` |
| `tools/03_decode_glyphs.py` | Solve and write map, match table and report |
| `tools/04_render_glyphs.py` | Draw unknown glyphs plus hidden check glyphs as PNG sheets |
| `tools/04b_check_glyph_reads.py` | Check eye readings against the hidden check glyphs, write the glyph seed |
| `tests/conftest.py`, `tests/test_*.py` | pytest |

---

### Task 1: Repository skeleton

**Files:**
- Create: `.gitignore`, `.gitattributes`, `README.md`, `.claude/CLAUDE.md`, `tools/requirements.txt`, `tests/conftest.py`

- [ ] **Step 1: Confirm the git database folder does not exist yet**

Run: `ls -d ~/git/hsk-flashcards.git 2>/dev/null || echo free`
Expected: `free`

- [ ] **Step 2: Create the repository with its database outside Box**

Run (from project root): `git init -b main --separate-git-dir="~/git/hsk-flashcards.git"`
Expected: `Initialized empty Git repository in ~/git/hsk-flashcards.git/`. `.git` in the project is now a one-line text file.

- [ ] **Step 3: Set the repository's author identity to the name and email the user gave**

The user supplies both values before this task starts. Suggest their GitHub "noreply" address, because the repository will be public.

```bash
git config user.name "<name the user gave>"
git config user.email "<email the user gave>"
```

- [ ] **Step 4: Write `.gitignore`**

```
.claude/
.remember/
__pycache__/
.pytest_cache/
*.part
data/public/
data/extract/
data/decode/
data/build/
data/reports/
```

- [ ] **Step 5: Write `.gitattributes`**

```
* text=auto eol=lf
*.mp3 binary
*.png binary
*.pdf binary
```

- [ ] **Step 6: Write `README.md`**

```markdown
# HSK Flashcards

A daily Chinese vocabulary trainer for the HSK 2.0 word list, built as an installable web app.

Work in progress. Data sources and licences will be listed in ATTRIBUTION.md once the word list is built.
```

- [ ] **Step 7: Write `.claude/CLAUDE.md`**

```markdown
# HSK Flashcards project

Daily Chinese flashcard web app for one English-speaking beginner on an Android phone, hosted on GitHub Pages.

- Design: .claude/specs/2026-09-27-hsk-flashcards-design.md. Plans: .claude/plans/.
- The web root is docs/ and it is PUBLIC. Never put notes, specs or personal data there.
- Build scripts live in tools/ and run from the project root, for example `python tools/02_extract_pdfs.py`.
- Paths in scripts are relative. The source PDFs are read from ../HSK 词汇 6本/ and never copied.
- Outputs are never overwritten. Use common.next_versions or next_version_path; writers open files with mode "x".
- Tests: `python -m pytest tests -q`.
- The git database lives outside Box at ~/git/hsk-flashcards.git (.git here is a pointer file).
```

- [ ] **Step 8: Write `tools/requirements.txt`**

```
pypdf>=6.0
fonttools>=4.43
matplotlib>=3.8
pytest>=8
```

- [ ] **Step 9: Write `tests/conftest.py`**

```python
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "tools"))
```

- [ ] **Step 10: Commit**

```bash
git add .gitignore .gitattributes README.md tools/requirements.txt tests/conftest.py
git commit -m "chore: repository skeleton"
```

---

### Task 2: Versioned outputs (`tools/common.py`)

**Files:**
- Create: `tools/common.py`
- Test: `tests/test_common.py`

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_common.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'common'`

- [ ] **Step 3: Write `tools/common.py`**

```python
"""Shared helpers for the build scripts.

Run every script from the project root, for example `python tools/02_extract_pdfs.py`.
Outputs are never overwritten. Each run writes new `_vNNN` files, and writers open
files with mode "x" so an existing file can never be replaced.
"""
import csv
import json
import re
from pathlib import Path

_VERSION = re.compile(r"_v(\d{3})$")


def _existing_versions(stem):
    """Version numbers already used by files or folders named `<stem>_vNNN` plus any suffix."""
    stem = Path(stem)
    if not stem.parent.exists():
        return []
    found = set()
    for p in stem.parent.iterdir():
        base = p.name.split(".", 1)[0]
        m = _VERSION.search(base)
        if m and base[: m.start()] == stem.name:
            found.add(int(m.group(1)))
    return sorted(found)


def next_versions(**specs):
    """Reserve one shared version number for several outputs of the same run.

    Example, when the highest existing version of either stem is 2:
    next_versions(map=("data/decode/cidmap", ".csv"), report=("data/reports/decode", ".txt"))
    returns {"map": Path("data/decode/cidmap_v003.csv"), "report": Path("data/reports/decode_v003.txt")}.
    """
    n = 1 + max([0] + [v for stem, _ in specs.values() for v in _existing_versions(stem)])
    paths = {}
    for key, (stem, suffix) in specs.items():
        stem = Path(stem)
        stem.parent.mkdir(parents=True, exist_ok=True)
        paths[key] = stem.parent / f"{stem.name}_v{n:03d}{suffix}"
    return paths


def next_version_path(stem, suffix):
    return next_versions(only=(stem, suffix))["only"]


def all_version_paths(stem, suffix):
    """[(version, path)] for every existing `<stem>_vNNN<suffix>`, oldest first."""
    stem = Path(stem)
    out = []
    for v in _existing_versions(stem):
        p = stem.parent / f"{stem.name}_v{v:03d}{suffix}"
        if p.exists():
            out.append((v, p))
    return out


def latest_version_path(stem, suffix):
    found = all_version_paths(stem, suffix)
    if not found:
        raise FileNotFoundError(f"No {stem}_vNNN{suffix} yet. Run the earlier step first.")
    return found[-1][1]


def write_new_text(path, text):
    with open(path, "x", encoding="utf-8", newline="\n") as f:
        f.write(text)


def write_new_json(path, obj):
    write_new_text(path, json.dumps(obj, ensure_ascii=False, indent=1) + "\n")


def write_new_jsonl(path, rows):
    write_new_text(path, "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows))


def write_new_csv(path, header, rows, excel=False):
    """excel=True adds a byte-order mark so Excel shows Chinese correctly."""
    with open(path, "x", encoding="utf-8-sig" if excel else "utf-8", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(rows)


def read_json(path):
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def read_jsonl(path):
    with open(path, encoding="utf-8") as f:
        return [json.loads(line) for line in f if line.strip()]


def read_csv(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_common.py -q`
Expected: `8 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/common.py tests/test_common.py
git commit -m "feat: versioned never-overwrite output helpers"
```

---

### Task 3: Pinyin normalisation (`tools/pinyin_norm.py`)

**Files:**
- Create: `tools/pinyin_norm.py`
- Test: `tests/test_pinyin_norm.py`

- [ ] **Step 1: Write the failing tests**

```python
from pinyin_norm import norm, toneless


def test_norm_removes_spaces_apostrophes_and_case():
    assert norm("Běi jīng") == "běijīng"
    assert norm("duì bu qǐ") == "duìbuqǐ"
    assert norm("nǚ'ér") == "nǚér"
    assert norm("I’m sorry") == "imsorry"


def test_toneless_keeps_u_umlaut():
    assert toneless("Běijīng") == "beijing"
    assert toneless("lǜ sè") == "lüse"
    assert toneless("nǚ'ér") == "nüer"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_pinyin_norm.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'pinyin_norm'`

- [ ] **Step 3: Write `tools/pinyin_norm.py`**

```python
"""Pinyin clean-up used to match PDF entries with the public word list."""
import unicodedata

_DROP = str.maketrans("", "", " '’‘-·")
_TONE_MARKS = {"\u0304", "\u0301", "\u030c", "\u0300"}  # macron, acute, caron, grave


def norm(s):
    """Lower case, composed accents, no spaces or apostrophes. 'Běi jīng' becomes 'běijīng'."""
    return unicodedata.normalize("NFC", s).lower().translate(_DROP)


def toneless(s):
    """norm() without tone marks, keeping ü. 'lǜ sè' becomes 'lüse'."""
    decomposed = unicodedata.normalize("NFD", norm(s))
    kept = "".join(c for c in decomposed if c not in _TONE_MARKS)
    return unicodedata.normalize("NFC", kept)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_pinyin_norm.py -q`
Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/pinyin_norm.py tests/test_pinyin_norm.py
git commit -m "feat: pinyin normalisation for matching"
```

---

### Task 4: Download the public word list (`tools/01_fetch_public_list.py`)

**Files:**
- Create: `tools/01_fetch_public_list.py`
- Output: `data/public/hsk2_old_exclusive_v001.json`, `data/public/LICENSE_upstream_v001.txt`

- [ ] **Step 1: Write the script**

```python
"""Step 1. Download the public HSK 2.0 word list, pinned to one upstream commit.

Source: github.com/drkameleon/complete-hsk-vocabulary (MIT licence; meanings from CC-CEDICT, CC BY-SA 4.0).
Outputs: data/public/hsk2_old_exclusive_vNNN.json (every word with an added "hsk" level),
         data/public/LICENSE_upstream_vNNN.txt
"""
import json
import sys
import urllib.request

from common import next_versions, write_new_json, write_new_text

COMMIT = "7ac65bf1a6387d35f1ade478906172a19311c7f9"
BASE = f"https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/{COMMIT}/"
EXPECTED = {1: 150, 2: 147, 3: 298, 4: 598, 5: 1298, 6: 2500}


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read().decode("utf-8")


def main():
    words = []
    for level, count in EXPECTED.items():
        data = json.loads(fetch(f"{BASE}wordlists/exclusive/old/{level}.json"))
        if len(data) != count:
            sys.exit(f"HSK{level}: expected {count} words, got {len(data)}. Nothing written.")
        for w in data:
            w["hsk"] = level
            words.append(w)
    licence = fetch(BASE + "LICENSE")
    if not licence.startswith("MIT License"):
        sys.exit("The upstream licence is not MIT at this commit. Nothing written.")
    paths = next_versions(words=("data/public/hsk2_old_exclusive", ".json"),
                          licence=("data/public/LICENSE_upstream", ".txt"))
    write_new_json(paths["words"], words)
    write_new_text(paths["licence"], licence)
    print(f"{len(words)} words -> {paths['words']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `python tools/01_fetch_public_list.py`
Expected: `4991 words -> data\public\hsk2_old_exclusive_v001.json`

- [ ] **Step 3: Spot-check one entry**

Run: `python -c "import json;d=json.load(open('data/public/hsk2_old_exclusive_v001.json',encoding='utf-8'));print(d[2]['simplified'],d[2]['hsk'],d[2]['forms'][0]['transcriptions']['pinyin'])"`
Expected: `爸爸 1 bà ba`

- [ ] **Step 4: Commit**

```bash
git add tools/01_fetch_public_list.py
git commit -m "feat: fetch pinned public HSK 2.0 list"
```

---

### Task 5: Reading PDF text runs (`tools/pdfread.py`)

**Files:**
- Create: `tools/pdfread.py`
- Test: `tests/test_pdfread.py`

- [ ] **Step 1: Write the failing tests**

```python
from pathlib import Path

import pytest

from pdfread import body_runs, parse_tounicode, seed_table

PDF = Path("../HSK 词汇 6本/HSK1 词汇.pdf")


def test_parse_tounicode_bfchar_and_bfrange():
    data = b"""begincmap
2 beginbfchar
<21> <0101>
<0481> <FF08>
endbfchar
1 beginbfrange
<0030> <0032> <4E00>
endbfrange
endcmap"""
    assert parse_tounicode(data) == {0x21: "ā", 0x481: "（", 0x30: "一", 0x31: "丁", 0x32: "丂"}


@pytest.mark.skipif(not PDF.exists(), reason="vocabulary PDF not found")
def test_first_entry_of_hsk1():
    runs = list(body_runs(PDF))
    i = next(k for k, r in enumerate(runs) if r.kind == "l" and r.x < 12 and r.text.strip() == "1")
    head, latin = runs[i + 1], runs[i + 2]
    assert head.kind == "c" and head.cids == [835, 4541, 836]
    assert latin.kind == "l" and latin.text.startswith(" ài")


@pytest.mark.skipif(not PDF.exists(), reason="vocabulary PDF not found")
def test_body_runs_drop_footer_fonts():
    assert not any(r.font.startswith(".") or "sayninhao" in r.text for r in body_runs(PDF))


@pytest.mark.skipif(not PDF.exists(), reason="vocabulary PDF not found")
def test_seed_table_has_footer_characters():
    seed = seed_table(PDF)
    assert seed[5973] == "英" and seed[6575] == "词" and seed[1153] == "（"
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_pdfread.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'pdfread'`

- [ ] **Step 3: Write `tools/pdfread.py`**

```python
"""Low-level reading of the vocabulary PDFs.

The Chinese text uses a font with no character table, so we keep its raw glyph
codes (CIDs) instead of text. Latin text (pinyin, English) is decoded normally.
"""
import logging
import re
from dataclasses import dataclass, field

import pypdf
from pypdf.generic import ByteStringObject, ContentStream, TextStringObject

logging.getLogger("pypdf").setLevel(logging.ERROR)

BODY_FONTS = {"ArialMT", "PingFangSC-Regular"}  # other fonts only draw page headers and footers


@dataclass
class Run:
    page: int
    x: float
    y: float
    kind: str  # "c" for Chinese glyph codes, "l" for Latin text
    cids: list = field(default_factory=list)
    text: str = ""
    font: str = ""


def parse_tounicode(data):
    """Parse a ToUnicode CMap into {code: text}, from its bfchar and bfrange blocks."""
    table = {}
    for block in re.findall(rb"beginbfchar(.*?)endbfchar", data, re.S):
        for src, dst in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            table[int(src, 16)] = bytes.fromhex(dst.decode()).decode("utf-16-be")
    for block in re.findall(rb"beginbfrange(.*?)endbfrange", data, re.S):
        for lo, hi, dst in re.findall(rb"<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>", block):
            start, end, first = int(lo, 16), int(hi, 16), int(dst, 16)
            for code in range(start, end + 1):
                table[code] = chr(first + code - start)
    return table


class FontInfo:
    def __init__(self, fdict):
        self.base = str(fdict.get("/BaseFont", "")).lstrip("/").split("+")[-1]
        self.type0 = fdict.get("/Subtype") == "/Type0"
        tounicode = fdict.get("/ToUnicode")
        self.table = parse_tounicode(tounicode.get_object().get_data()) if tounicode is not None else {}
        self.encoding = "mac_roman" if fdict.get("/Encoding") == "/MacRomanEncoding" else "latin-1"

    def text(self, raw):
        return "".join(self.table.get(b, bytes([b]).decode(self.encoding)) for b in raw)

    @staticmethod
    def cids(raw):
        return [int.from_bytes(raw[i:i + 2], "big") for i in range(0, len(raw) - 1, 2)]


def _raw(item):
    if isinstance(item, TextStringObject):
        return item.get_original_bytes()
    if isinstance(item, (ByteStringObject, bytes)):
        return bytes(item)
    return None  # kerning numbers inside TJ arrays


def page_runs(reader, index):
    """Yield every text run on one page, in content-stream order."""
    page = reader.pages[index]
    contents = page.get_contents()
    if contents is None:
        return
    fonts = {str(k): FontInfo(v.get_object()) for k, v in page["/Resources"]["/Font"].items()}
    font, x, y = None, 0.0, 0.0
    for operands, op in ContentStream(contents, reader).operations:
        if op == b"Tf":
            font = fonts.get(str(operands[0]))
        elif op == b"Tm":
            x, y = float(operands[4]), float(operands[5])
        elif op in (b"Tj", b"TJ", b"'", b'"') and font is not None:
            items = operands[0] if op == b"TJ" else [operands[-1]]
            raw = b"".join(b for b in map(_raw, items) if b)
            if not raw:
                continue
            if font.type0:
                yield Run(index, x, y, "c", cids=FontInfo.cids(raw), font=font.base)
            else:
                yield Run(index, x, y, "l", text=font.text(raw), font=font.base)


def body_runs(path):
    """All runs of entry text in one PDF, without page headers and footers."""
    reader = pypdf.PdfReader(path)
    for i in range(len(reader.pages)):
        for run in page_runs(reader, i):
            if run.font in BODY_FONTS and "sayninhao" not in run.text:
                yield run


def seed_table(path):
    """Characters we get for free from the footer font, which does have a character table."""
    reader = pypdf.PdfReader(path)
    seed = {}
    for page in reader.pages:
        for f in page["/Resources"]["/Font"].values():
            f = f.get_object()
            if f.get("/Subtype") == "/Type0" and f.get("/ToUnicode") is not None:
                seed.update(parse_tounicode(f["/ToUnicode"].get_object().get_data()))
    return seed
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_pdfread.py -q`
Expected: `4 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/pdfread.py tests/test_pdfread.py
git commit -m "feat: read raw glyph codes and Latin text from the PDFs"
```

---

### Task 6: Grouping runs into entries (`tools/pdfentries.py`)

**Files:**
- Create: `tools/pdfentries.py`
- Test: `tests/test_pdfentries.py`

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_pdfentries.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'pdfentries'`

- [ ] **Step 3: Write `tools/pdfentries.py`**

```python
"""Group PDF text runs into numbered vocabulary entries."""
import re

ENTRY_X = 12.0                     # entry numbers and section letters sit at x = 10
TABLE_HEADER_FIRST = [2855, 1897]  # first cell of the column-title line in the HSK 5 and 6 files
BRACKETS = {835, 836}              # glyphs that wrap headwords in the HSK 1 to 4 files
FULL_STOP = 822                    # 。, sometimes stuck to the end of a headword
FOOTER = re.compile(r"sayninhao|\d{4}/\d{1,2}/\d{1,2}")


def drop_noise(runs):
    """Remove section letters (A, B...), the column-title line and stray footer text."""
    runs = list(runs)
    header_lines = {(r.page, r.y) for r in runs
                    if r.kind == "c" and r.x < ENTRY_X and r.cids == TABLE_HEADER_FIRST}
    for r in runs:
        if (r.page, r.y) in header_lines:
            continue
        if r.kind == "l" and r.x < ENTRY_X and re.fullmatch(r"[A-Z]", r.text.strip()):
            continue
        if r.kind == "l" and FOOTER.search(r.text):
            continue
        yield r


def group_entries(runs):
    """Split the runs into entries. An entry starts where the next expected number sits at the left margin.

    Neighbouring runs of the same kind are merged, so pinyin split across fonts
    (" b" + "ā" + " num. eight ") becomes one Latin token.
    """
    entries, current, expected = [], None, 1
    for r in drop_noise(runs):
        if r.kind == "l" and r.x < ENTRY_X and r.text.strip() == str(expected):
            current = {"n": expected, "page": r.page, "tokens": []}
            entries.append(current)
            expected += 1
            continue
        if current is None:
            continue  # page title before entry 1
        tokens = current["tokens"]
        if tokens and tokens[-1][0] == r.kind:
            if r.kind == "c":
                tokens[-1][1].extend(r.cids)
            else:
                tokens[-1][1] += r.text
        else:
            tokens.append(["c", list(r.cids)] if r.kind == "c" else ["l", r.text])
    return entries


def head_of(entry):
    """The headword's glyph codes, without wrapping brackets or a trailing full stop."""
    tokens = entry["tokens"]
    if not tokens or tokens[0][0] != "c":
        return []
    cids = [c for c in tokens[0][1] if c not in BRACKETS]
    while cids and cids[-1] == FULL_STOP:
        cids.pop()
    return cids


def latin_of(entry):
    """The Latin text right after the headword: pinyin, then part of speech and English."""
    tokens = entry["tokens"]
    return tokens[1][1] if len(tokens) > 1 and tokens[1][0] == "l" else ""
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_pdfentries.py -q`
Expected: `3 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/pdfentries.py tests/test_pdfentries.py
git commit -m "feat: group PDF runs into numbered entries"
```

---

### Task 7: Extract all six PDFs (`tools/02_extract_pdfs.py`)

**Files:**
- Create: `tools/02_extract_pdfs.py`
- Output: `data/extract/pdf_entries_v001.jsonl`, `data/extract/seed_cmap_v001.csv`

- [ ] **Step 1: Write the script**

```python
"""Step 2. Read the six vocabulary PDFs into entries that keep the raw glyph codes.

Input:   ../HSK 词汇 6本/HSK{1..6} 词汇.pdf (read only, never copied)
Outputs: data/extract/pdf_entries_vNNN.jsonl, one entry per line
         {"file", "n", "page", "head", "latin", "tokens"}
         data/extract/seed_cmap_vNNN.csv, codes the footer font already names
Nothing is written unless every file gives exactly the expected number of entries.
"""
import sys
from pathlib import Path

from common import next_versions, write_new_csv, write_new_jsonl
from pdfentries import group_entries, head_of, latin_of
from pdfread import body_runs, seed_table

PDF_DIR = Path("../HSK 词汇 6本")
EXPECTED = {1: 150, 2: 300, 3: 600, 4: 1200, 5: 437, 6: 2623}


def main():
    rows, seed, problems = [], {}, []
    for level, expected in EXPECTED.items():
        path = PDF_DIR / f"HSK{level} 词汇.pdf"
        entries = group_entries(body_runs(path))
        seed.update(seed_table(path))
        no_head = [e["n"] for e in entries if not head_of(e)]
        no_latin = [e["n"] for e in entries if not latin_of(e).strip()]
        print(f"HSK{level}: {len(entries)} entries (expected {expected}), "
              f"missing headword {len(no_head)}, missing pinyin {len(no_latin)}")
        if len(entries) != expected:
            last = entries[-1]["n"] if entries else 0
            problems.append(f"HSK{level}: stopped after entry {last}")
        if no_head or no_latin:
            problems.append(f"HSK{level}: no headword {no_head[:10]}, no pinyin {no_latin[:10]}")
        for e in entries:
            rows.append({"file": level, "n": e["n"], "page": e["page"],
                         "head": head_of(e), "latin": latin_of(e), "tokens": e["tokens"]})
    if problems:
        sys.exit("Stopped, nothing written:\n  " + "\n  ".join(problems))
    paths = next_versions(entries=("data/extract/pdf_entries", ".jsonl"),
                          seed=("data/extract/seed_cmap", ".csv"))
    write_new_jsonl(paths["entries"], rows)
    write_new_csv(paths["seed"], ["cid", "char"], sorted(seed.items()))
    print(f"Wrote {len(rows)} entries to {paths['entries']} and {len(seed)} free characters to {paths['seed']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `python tools/02_extract_pdfs.py`
Expected:
```
HSK1: 150 entries (expected 150), missing headword 0, missing pinyin 0
HSK2: 300 entries (expected 300), missing headword 0, missing pinyin 0
HSK3: 600 entries (expected 600), missing headword 0, missing pinyin 0
HSK4: 1200 entries (expected 1200), missing headword 0, missing pinyin 0
HSK5: 437 entries (expected 437), missing headword 0, missing pinyin 0
HSK6: 2623 entries (expected 2623), missing headword 0, missing pinyin 0
Wrote 5310 entries to data\extract\pdf_entries_v001.jsonl and 11 free characters to data\extract\seed_cmap_v001.csv
```

If a file stops early, the message names the last entry found. Dump the runs around it:

```bash
PYTHONIOENCODING=utf-8 python -c "
import sys; sys.path.insert(0,'tools')
from pdfread import body_runs
runs=list(body_runs('../HSK 词汇 6本/HSK4 词汇.pdf'))
k=next(i for i,r in enumerate(runs) if r.kind=='l' and r.x<12 and r.text.strip()=='676')
for r in runs[k:k+40]: print(round(r.x,1), round(r.y,1), r.kind, r.cids or repr(r.text))"
```

Replace `HSK4` and `676` with the file and the number that was found last. Fix the rule in `pdfentries.py` that misses the next number. Add a unit test in `tests/test_pdfentries.py` that reproduces the case with synthetic runs, then rerun Steps 1 and 2 of this task.

- [ ] **Step 3: Check the output for footer leftovers**

Run: `PYTHONIOENCODING=utf-8 python -c "import json;rows=[json.loads(l) for l in open('data/extract/pdf_entries_v001.jsonl',encoding='utf-8')];bad=[(r['file'],r['n'],t[1]) for r in rows for t in r['tokens'] if t[0]=='l' and ('页' in t[1] or 'http' in t[1] or 'HSk' in t[1])];print(len(bad),bad[:5])"`
Expected: `0 []`

- [ ] **Step 4: Commit**

```bash
git add tools/02_extract_pdfs.py tests/test_pdfentries.py tools/pdfentries.py
git commit -m "feat: extract all six vocabulary PDFs"
```

---

### Task 8: The code-to-character solver (`tools/decode.py`)

**Files:**
- Create: `tools/decode.py`
- Test: `tests/test_decode.py`

- [ ] **Step 1: Write the failing tests**

```python
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `python -m pytest tests/test_decode.py -q`
Expected: FAIL with `ModuleNotFoundError: No module named 'decode'`

- [ ] **Step 3: Write `tools/decode.py`**

```python
"""Work out which glyph code (CID) stands for which Chinese character.

Each PDF entry gives a headword as glyph codes plus readable pinyin. The public
list gives the same words as real characters. Matching the two on pinyin and
length tells us the characters behind the codes. For example, the entry with
codes [4545, 4545] and pinyin "bàba" can only be 爸爸, so code 4545 is 爸.
"""
from collections import Counter, defaultdict
from typing import NamedTuple

from pinyin_norm import norm, toneless

MISSING = "□"


class Cand(NamedTuple):
    hz: str
    py: str
    level: int
    py_norm: str
    py_toneless: str


def build_index(public_words):
    """Every reading of every public word, grouped by character count."""
    index = defaultdict(list)
    for w in public_words:
        for form in w["forms"]:
            py = form["transcriptions"]["pinyin"]
            index[len(w["simplified"])].append(Cand(w["simplified"], py, w["hsk"], norm(py), toneless(py)))
    return index


def candidates(head_len, latin, file_level, index):
    """Public words that could be this PDF entry, as a sorted list of character strings.

    The entry's Latin text starts with its pinyin, for example " bāng v. help ".
    A word matches when its pinyin is the start of that text. Exact tones are tried
    first. If nothing matches, tones are ignored, because the PDF writes tone changes
    such as bú kèqi. Only the longest matching pinyin is kept, so 帮 bāng beats 八 bā.
    The HSK 1 to 4 files repeat lower levels, so words at or below the file's level
    are preferred there. In the HSK 5 and 6 files the level must be equal.
    """
    text, text_tl = norm(latin), toneless(latin)
    pool = index.get(head_len, [])
    hits = [c for c in pool if c.py_norm and text.startswith(c.py_norm)]
    if not hits:
        hits = [c for c in pool if c.py_toneless and text_tl.startswith(c.py_toneless)]
    if not hits:
        return []
    longest = max(len(c.py_norm) for c in hits)
    hits = [c for c in hits if len(c.py_norm) == longest]
    in_level = [c for c in hits if (c.level <= file_level if file_level <= 4 else c.level == file_level)]
    return sorted({c.hz for c in (in_level or hits)})


def _consistent(hz, head, fwd, rev):
    for cid, ch in zip(head, hz):
        if fwd.get(cid, ch) != ch or rev.get(ch, cid) != cid:
            return False
    return True


def live_candidates(head, hzs, fwd, rev):
    """Candidates that still agree with everything learned so far."""
    return [hz for hz in hzs if _consistent(hz, head, fwd, rev)]


def solve(items, seed):
    """Fill the code-to-character map.

    items: one (head_cids, candidate_strings) pair per PDF entry.
    seed: codes already known, {cid: char}.
    Each round, every entry votes for the positions where all its remaining
    candidates agree. The best-supported votes are applied, one code to one
    character and one character to one code, and rounds repeat until a round
    learns nothing. Returns (map, conflicts), where conflicts lists codes that
    received votes for more than one character.
    """
    fwd = dict(seed)
    rev = {ch: cid for cid, ch in fwd.items()}
    conflicts = {}
    while True:
        votes = defaultdict(Counter)
        for head, hzs in items:
            live = live_candidates(head, hzs, fwd, rev)
            if not live:
                continue
            for i, cid in enumerate(head):
                if cid in fwd:
                    continue
                chars = {hz[i] for hz in live}
                if len(chars) == 1:
                    votes[cid][chars.pop()] += 1
        learned = 0
        for cid, count in sorted(votes.items(), key=lambda kv: (-kv[1].most_common(1)[0][1], kv[0])):
            ch, _ = count.most_common(1)[0]
            if len(count) > 1:
                conflicts[cid] = dict(count)
            if ch in rev:
                conflicts.setdefault(cid, dict(count))
                continue
            fwd[cid], rev[ch] = ch, cid
            learned += 1
        if not learned:
            return fwd, conflicts


def decode_cids(cids, fwd):
    return "".join(fwd.get(c, MISSING) for c in cids)


def body_text(entry, fwd):
    """Everything after the headword and its Latin text, with codes turned into characters."""
    return "".join(decode_cids(v, fwd) if kind == "c" else v for kind, v in entry["tokens"][2:])


def coverage(entries, fwd):
    """Counts for the report.

    Returns (per_file, body_total, body_ok, unresolved, example, all_cids):
    per-file counts of entries, fully decoded headwords and fully decoded bodies;
    body glyph totals; a Counter of unknown codes; one example entry per unknown
    code; and every code seen.
    """
    per_file = defaultdict(lambda: {"entries": 0, "heads_ok": 0, "bodies_ok": 0})
    body_total = body_ok = 0
    unresolved, example, all_cids = Counter(), {}, set()
    for e in entries:
        f = per_file[e["file"]]
        f["entries"] += 1
        f["heads_ok"] += all(c in fwd for c in e["head"])
        body = [c for kind, v in e["tokens"][1:] if kind == "c" for c in v]
        ok = sum(c in fwd for c in body)
        body_total += len(body)
        body_ok += ok
        f["bodies_ok"] += ok == len(body)
        for c in e["head"] + body:
            all_cids.add(c)
            if c not in fwd:
                unresolved[c] += 1
                example.setdefault(c, f'HSK{e["file"]} #{e["n"]}')
    return per_file, body_total, body_ok, unresolved, example, all_cids
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `python -m pytest tests/test_decode.py -q`
Expected: `10 passed`

- [ ] **Step 5: Commit**

```bash
git add tools/decode.py tests/test_decode.py
git commit -m "feat: code-to-character solver"
```

---

### Task 9: First decode run and report (`tools/03_decode_glyphs.py`)

**Files:**
- Create: `tools/03_decode_glyphs.py`
- Output: `data/decode/cidmap_v001.csv`, `data/decode/unresolved_v001.csv`, `data/decode/entry_match_v001.csv`, `data/reports/decode_v001.txt`

- [ ] **Step 1: Write the script**

```python
"""Step 3. Unscramble the Chinese glyph codes in the PDFs.

Inputs:  data/public/hsk2_old_exclusive_vNNN.json, data/extract/pdf_entries_vNNN.jsonl,
         data/extract/seed_cmap_vNNN.csv, and data/decode/glyph_seed_vNNN.csv once it exists
Outputs: data/decode/cidmap_vNNN.csv (cid, char, source), data/decode/unresolved_vNNN.csv,
         data/decode/entry_match_vNNN.csv (opens in Excel), data/reports/decode_vNNN.txt
"""
import random

from common import (all_version_paths, latest_version_path, next_versions, read_csv, read_json,
                    read_jsonl, write_new_csv, write_new_text)
from decode import body_text, build_index, candidates, coverage, decode_cids, live_candidates, solve


def load_seeds():
    footer = {int(r["cid"]): r["char"] for r in read_csv(latest_version_path("data/extract/seed_cmap", ".csv"))}
    found = all_version_paths("data/decode/glyph_seed", ".csv")
    glyph = {int(r["cid"]): r["char"] for r in read_csv(found[-1][1])} if found else {}
    return footer, glyph, (found[-1][1] if found else None)


def main():
    public = read_json(latest_version_path("data/public/hsk2_old_exclusive", ".json"))
    entries = read_jsonl(latest_version_path("data/extract/pdf_entries", ".jsonl"))
    footer, glyph, glyph_file = load_seeds()
    index = build_index(public)
    cands = [candidates(len(e["head"]), e["latin"], e["file"], index) for e in entries]
    fwd, conflicts = solve([(e["head"], c) for e, c in zip(entries, cands)], {**footer, **glyph})
    rev = {ch: cid for cid, ch in fwd.items()}
    per_file, body_total, body_ok, unresolved, example, all_cids = coverage(entries, fwd)

    paths = next_versions(cidmap=("data/decode/cidmap", ".csv"), unresolved=("data/decode/unresolved", ".csv"),
                          match=("data/decode/entry_match", ".csv"), report=("data/reports/decode", ".txt"))
    source = {cid: "footer" if cid in footer else "glyph" if cid in glyph else "headword" for cid in fwd}
    write_new_csv(paths["cidmap"], ["cid", "char", "source"], [(c, fwd[c], source[c]) for c in sorted(fwd)])
    write_new_csv(paths["unresolved"], ["cid", "count", "example"],
                  [(c, n, example[c]) for c, n in unresolved.most_common()])

    match_rows, no_match, unsure = [], [], []
    for e, c in zip(entries, cands):
        live = live_candidates(e["head"], c, fwd, rev)
        if not c:
            status = "none"
            no_match.append(e)
        elif len(live) == 1:
            status = "unique"
        else:
            status = "ambiguous" if live else "contradicted"
            unsure.append((e, status, live or c))
        match_rows.append((e["file"], e["n"], decode_cids(e["head"], fwd), status, " ".join(live or c),
                           e["latin"].strip()[:60]))
    write_new_csv(paths["match"], ["file", "n", "head", "status", "candidates", "latin"], match_rows, excel=True)

    lines = ["Decode report", "",
             f"Codes known before solving: {len(footer)} from the footer font, {len(glyph)} from glyph reading"
             + (f" ({glyph_file})" if glyph_file else ""), "",
             "Per PDF file (headwords fully decoded; entries whose sentences are fully decoded):"]
    for f in sorted(per_file):
        d = per_file[f]
        lines.append(f"  HSK{f}: headwords {d['heads_ok']}/{d['entries']} ({100 * d['heads_ok'] / d['entries']:.1f}%), "
                     f"sentences {d['bodies_ok']}/{d['entries']} ({100 * d['bodies_ok'] / d['entries']:.1f}%)")
    lines += ["",
              f"Distinct glyph codes seen: {len(all_cids)}. Decoded: {len(all_cids) - len(unresolved)}. "
              f"Still unknown: {len(unresolved)}.",
              f"Sentence glyphs decoded: {body_ok}/{body_total} ({100 * body_ok / max(body_total, 1):.1f}%)",
              f"Entries with no matching public word: {len(no_match)}",
              f"Entries still ambiguous or contradicted: {len(unsure)}",
              f"Codes with mixed votes: {len(conflicts)}", ""]
    if no_match:
        lines.append("First 25 entries with no match:")
        lines += [f"  HSK{e['file']} #{e['n']}: {e['latin'].strip()[:70]}" for e in no_match[:25]]
        lines.append("")
    if unsure:
        lines.append("First 25 ambiguous or contradicted entries:")
        lines += [f"  HSK{e['file']} #{e['n']} {status}: {' / '.join(c)}  ({e['latin'].strip()[:40]})"
                  for e, status, c in unsure[:25]]
        lines.append("")
    if conflicts:
        lines.append("Codes with mixed votes (first 50):")
        lines += [f"  {cid}: {votes}" for cid, votes in sorted(conflicts.items())[:50]]
        lines.append("")
    lines.append("20 random entries, decoded (□ means still unknown):")
    for e in random.Random(1).sample(entries, 20):
        lines.append(f"  HSK{e['file']} #{e['n']} {decode_cids(e['head'], fwd)} "
                     f"{e['latin'].strip()[:40]} | {body_text(e, fwd)[:80]}")
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines[:17]))
    print(f"Full report: {paths['report']}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `PYTHONIOENCODING=utf-8 python tools/03_decode_glyphs.py`
Expected, based on the planning analysis:
- about 99% of headwords decoded in every file;
- several hundred unknown codes, all from sentences, including punctuation codes such as 1157, 1176 and 1239;
- no or few codes with mixed votes;
- the report path `data\reports\decode_v001.txt`.

- [ ] **Step 3: Read the full report and judge it**

Open `data/reports/decode_v001.txt`. The 20 random decoded headwords must be real words that match their pinyin, for example `爸爸 bàba`.
- **Too few headwords decoded (below 95% in any file).** Look at the "no match" list. A pattern there, such as a pinyin spelling the matcher misses, needs a rule in `candidates()` and a test in `tests/test_decode.py`. Then rerun this task, which writes v002.
- **More than 20 codes with mixed votes.** Look at the listed votes. A mixed vote means some entries matched the wrong public word. Tighten `candidates()` the same way.

- [ ] **Step 4: Commit**

```bash
git add tools/03_decode_glyphs.py tools/decode.py tests/test_decode.py
git commit -m "feat: first decode run with coverage report"
```

---

### Task 10: Draw the unknown glyphs (`tools/04_render_glyphs.py`)

**Files:**
- Create: `tools/04_render_glyphs.py`
- Output: `data/decode/sheets_vNNN/sheet_01.png ...`, `data/decode/sheets_key_vNNN.csv`

- [ ] **Step 1: Write the script**

```python
"""Step 3b. Draw the glyphs that are still unknown, so they can be identified by eye.

Inputs:  data/decode/unresolved_vNNN.csv, data/decode/cidmap_vNNN.csv, the six PDFs
Outputs: data/decode/sheets_vNNN/sheet_01.png and so on, 100 numbered cells per sheet
         data/decode/sheets_key_vNNN.csv (cell, cid, control, known_char)
About one cell in ten is a glyph that is already known, mixed in unlabelled, to check the eye readings.
"""
import hashlib
import io
import random
from pathlib import Path

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt
import pypdf
from fontTools.cffLib import CFFFontSet
from fontTools.pens.basePen import BasePen
from matplotlib.patches import PathPatch, Rectangle
from matplotlib.path import Path as MplPath

from common import latest_version_path, next_versions, read_csv, write_new_csv

PDF_DIR = Path("../HSK 词汇 6本")
PER_SHEET = 100


class MplPen(BasePen):
    """Collects a glyph outline as a matplotlib path."""

    def __init__(self):
        super().__init__(None)
        self.verts, self.codes = [], []

    def _moveTo(self, p):
        self.verts.append(p)
        self.codes.append(MplPath.MOVETO)

    def _lineTo(self, p):
        self.verts.append(p)
        self.codes.append(MplPath.LINETO)

    def _curveToOne(self, p1, p2, p3):
        self.verts += [p1, p2, p3]
        self.codes += [MplPath.CURVE4] * 3

    def _closePath(self):
        self.verts.append((0, 0))
        self.codes.append(MplPath.CLOSEPOLY)


def glyph_outlines(wanted):
    """Find each wanted code's outline in the Chinese font embedded in the PDFs.

    Every page embeds only the glyphs it uses, so we look through pages until each code is found.
    """
    found, seen = {}, set()
    for level in range(1, 7):
        reader = pypdf.PdfReader(PDF_DIR / f"HSK{level} 词汇.pdf")
        for page in reader.pages:
            for f in page["/Resources"]["/Font"].values():
                f = f.get_object()
                if str(f.get("/BaseFont", "")).split("+")[-1] != "PingFangSC-Regular":
                    continue
                desc = f["/DescendantFonts"][0].get_object()["/FontDescriptor"].get_object()
                data = desc["/FontFile3"].get_object().get_data()
                digest = hashlib.sha1(data).hexdigest()
                if digest in seen:
                    continue
                seen.add(digest)
                fonts = CFFFontSet()
                fonts.decompile(io.BytesIO(data), None)
                glyphs = fonts[fonts.fontNames[0]].CharStrings
                for cid in wanted - found.keys():
                    name = f"cid{cid:05d}"
                    if name in glyphs:
                        pen = MplPen()
                        glyphs[name].draw(pen)
                        if pen.codes:
                            found[cid] = MplPath(pen.verts, pen.codes)
            if len(found) == len(wanted):
                return found
    return found


def draw_sheet(cells, outlines, path):
    """cells: list of (cell_number, cid). Each glyph sits inside its grey 1000-unit character box."""
    fig, axes = plt.subplots(10, 10, figsize=(10, 11))
    for ax in axes.flat:
        ax.set_axis_off()
    for ax, (cell, cid) in zip(axes.flat, cells):
        ax.add_patch(Rectangle((0, -120), 1000, 1000, fill=False, lw=0.5, ec="#bbbbbb"))
        if cid in outlines:
            ax.add_patch(PathPatch(outlines[cid], fc="black", ec="none"))
        else:
            ax.text(500, 380, "no outline", ha="center", va="center", fontsize=6)
        ax.set_xlim(-20, 1020)
        ax.set_ylim(-140, 900)
        ax.set_aspect("equal")
        ax.set_title(str(cell), fontsize=8, pad=1)
    fig.tight_layout(pad=0.3)
    fig.savefig(path, dpi=110)
    plt.close(fig)


def main():
    unresolved = [int(r["cid"]) for r in read_csv(latest_version_path("data/decode/unresolved", ".csv"))]
    known = {int(r["cid"]): r["char"] for r in read_csv(latest_version_path("data/decode/cidmap", ".csv"))
             if r["source"] == "headword"}
    rng = random.Random(7)
    controls = set(rng.sample(sorted(known), max(5, len(unresolved) // 10)))
    cids = unresolved + sorted(controls)
    rng.shuffle(cids)
    outlines = glyph_outlines(set(cids))

    paths = next_versions(sheets=("data/decode/sheets", ""), key=("data/decode/sheets_key", ".csv"))
    paths["sheets"].mkdir()
    cells = list(enumerate(cids, start=1))
    for start in range(0, len(cells), PER_SHEET):
        draw_sheet(cells[start:start + PER_SHEET], outlines,
                   paths["sheets"] / f"sheet_{start // PER_SHEET + 1:02d}.png")
    write_new_csv(paths["key"], ["cell", "cid", "control", "known_char"],
                  [(n, cid, int(cid in controls), known[cid] if cid in controls else "") for n, cid in cells])
    missing = [c for c in cids if c not in outlines]
    sheets = (len(cells) - 1) // PER_SHEET + 1
    print(f"{len(unresolved)} unknown and {len(controls)} check glyphs on {sheets} sheets in {paths['sheets']}")
    if missing:
        print(f"No outline found for {len(missing)} codes: {missing[:20]}")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Run it**

Run: `python tools/04_render_glyphs.py`
Expected: a line such as `412 unknown and 41 check glyphs on 5 sheets in data\decode\sheets_v001`, and no "No outline" line.

- [ ] **Step 3: Look at the first sheet to confirm it is legible**

Open `data/decode/sheets_v001/sheet_01.png` with the Read tool. Each cell should show one black character inside a grey box, with its cell number above. Punctuation should sit where it does in a text line (。 at the bottom left).

- [ ] **Step 4: Commit**

```bash
git add tools/04_render_glyphs.py
git commit -m "feat: draw unknown glyphs as numbered sheets"
```

---

### Task 11: Read the sheets and check the readings (`tools/04b_check_glyph_reads.py`)

**Files:**
- Create: `tools/04b_check_glyph_reads.py`, `data/manual/glyph_reads_v001.csv` (hand-written)
- Output: `data/decode/glyph_seed_vNNN.csv`, then a second decode run (`*_v002`)

- [ ] **Step 1: Write the script**

```python
"""Step 3c. Check the eye readings of the glyph sheets and turn them into known characters.

Inputs:  data/decode/sheets_key_vNNN.csv and data/manual/glyph_reads_vNNN.csv with the same NNN.
         The reads file is written by hand with columns cell,char. Use ? for a glyph that cannot be read.
Output:  data/decode/glyph_seed_vNNN.csv with every reading from all rounds whose check glyphs all passed.
If any check glyph was misread, nothing is written.
"""
import sys

from common import all_version_paths, next_version_path, read_csv, write_new_csv


def main():
    seed, failures, rounds = {}, [], 0
    reads_by_version = dict(all_version_paths("data/manual/glyph_reads", ".csv"))
    for version, key_path in all_version_paths("data/decode/sheets_key", ".csv"):
        if version not in reads_by_version:
            continue
        rounds += 1
        reads = {int(r["cell"]): r["char"].strip() for r in read_csv(reads_by_version[version])}
        for row in read_csv(key_path):
            cell, cid = int(row["cell"]), int(row["cid"])
            char = reads.get(cell, "?")
            if row["control"] == "1":
                if char != row["known_char"]:
                    failures.append(f"round {version} cell {cell}: read {char!r}, expected {row['known_char']!r}")
            elif char and char != "?":
                seed[cid] = char
    if not rounds:
        sys.exit("No glyph_reads file matches a sheets_key file yet.")
    if failures:
        sys.exit("Check glyphs misread, nothing written:\n  " + "\n  ".join(failures))
    path = next_version_path("data/decode/glyph_seed", ".csv")
    write_new_csv(path, ["cid", "char"], sorted(seed.items()))
    print(f"{len(seed)} glyphs from {rounds} round(s) -> {path}. Now run tools/03_decode_glyphs.py again.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Read every sheet and write `data/manual/glyph_reads_v001.csv`**

Open each `data/decode/sheets_v001/sheet_NN.png` with the Read tool. Write one row per cell in the format below, using `?` for anything not certain. Punctuation uses the full-width forms (。，？！：；、“”（）～). The file's version number must match the sheets folder (`sheets_v001` gives `glyph_reads_v001.csv`).

```
cell,char
1,的
2,？
3,?
```

- [ ] **Step 3: Check the readings**

Run: `python tools/04b_check_glyph_reads.py`
Expected: `N glyphs from 1 round(s) -> data\decode\glyph_seed_v001.csv. Now run tools/03_decode_glyphs.py again.`

If it prints misread check glyphs, look at those cells again. Write the corrected readings into the same reads file (it is a hand-written input, not a generated output) and rerun.

- [ ] **Step 4: Second decode run**

Run: `PYTHONIOENCODING=utf-8 python tools/03_decode_glyphs.py`
Expected: the report `data\reports\decode_v002.txt`, with unknown codes down to the ones marked `?` and sentence glyphs decoded at 99% or more.

- [ ] **Step 5: Optional second round**

If more than 20 codes are still unknown, run `python tools/04_render_glyphs.py` again. It writes `sheets_v002` and `sheets_key_v002`, and the script prints the folder name. Read those sheets into `data/manual/glyph_reads_v002.csv` (same number as the sheets folder), then repeat Steps 3 and 4.

- [ ] **Step 6: Read 30 decoded sentences as a sanity check**

Run:
```bash
PYTHONIOENCODING=utf-8 python -c "
import sys, random; sys.path.insert(0,'tools')
from common import latest_version_path, read_csv, read_jsonl
from decode import body_text, decode_cids
fwd={int(r['cid']):r['char'] for r in read_csv(latest_version_path('data/decode/cidmap','.csv'))}
rows=read_jsonl(latest_version_path('data/extract/pdf_entries','.jsonl'))
for e in random.Random(5).sample(rows,30): print(decode_cids(e['head'],fwd), '|', body_text(e,fwd)[:70])"
```
Expected: 30 natural Chinese sentences, each using its headword or the ～ placeholder. Any sentence that reads as nonsense points to a wrong reading. Find its codes in the latest `cidmap`, fix the reading in the reads file, and redo Steps 3 and 4.

- [ ] **Step 7: Commit**

```bash
git add tools/04b_check_glyph_reads.py data/manual/
git commit -m "feat: glyph reading check and second decode run"
```

---

### Task 12: Checkpoint with the user

- [ ] **Step 1: Run the full test suite**

Run: `python -m pytest tests -q`
Expected: every test passes (8 + 2 + 4 + 3 + 10 = 27 passed).

- [ ] **Step 2: Report to the user in plain language**

Give these numbers from the latest `data/reports/decode_vNNN.txt`:
- the share of headwords decoded per HSK level;
- the share of sentence characters decoded;
- how many codes are still unknown;
- how many check glyphs were read correctly.

Include 5 decoded example sentences. State anything that did not reach the expected level. Then ask to proceed to Plan 3 (word list and themes) and Plan 2 (app logic).
