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
