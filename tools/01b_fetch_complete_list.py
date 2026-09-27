"""Step 1b. Download the complete HSK word list, pinned to the same upstream commit as step 1.

Source: github.com/drkameleon/complete-hsk-vocabulary, file complete.json at the repository root
(MIT licence, saved by step 1 as data/public/LICENSE_upstream_vNNN.txt; meanings from CC-CEDICT,
CC BY-SA 4.0).
Why: the old-HSK exclusive list from step 1 lacks everyday words that the PDFs contain,
such as 说, 没有, 哪儿, 一点儿, 他们, 天 and 饭店.
Output: data/public/hsk_complete_vNNN.json, the upstream list unchanged.
Nothing is written unless the list has exactly 11470 words and all seven words above are in it.
"""
import json
import sys
import urllib.request

from common import next_version_path, write_new_json

COMMIT = "7ac65bf1a6387d35f1ade478906172a19311c7f9"
BASE = f"https://raw.githubusercontent.com/drkameleon/complete-hsk-vocabulary/{COMMIT}/"
EXPECTED_COUNT = 11470
MUST_HAVE = ["说", "没有", "哪儿", "一点儿", "他们", "天", "饭店"]


def fetch(url):
    with urllib.request.urlopen(url, timeout=60) as response:
        return response.read().decode("utf-8")


def main():
    words = json.loads(fetch(BASE + "complete.json"))
    if len(words) != EXPECTED_COUNT:
        sys.exit(f"complete.json: expected {EXPECTED_COUNT} words, got {len(words)}. Nothing written.")
    present = {w.get("simplified") for w in words}
    missing = [hz for hz in MUST_HAVE if hz not in present]
    if missing:
        sys.exit(f"complete.json lacks {' '.join(missing)} as simplified entries. Nothing written.")
    path = next_version_path("data/public/hsk_complete", ".json")
    write_new_json(path, words)
    print(f"{len(words)} words, including {' '.join(MUST_HAVE)} -> {path}")


if __name__ == "__main__":
    main()
