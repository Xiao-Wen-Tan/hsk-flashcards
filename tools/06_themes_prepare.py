"""Step 6. Prepare the theme batches for the Claude batch agents.

Input:   data/build/wordlist_vNNN.jsonl (latest)
Outputs: data/build/theme_batches_vNNN/ with
           starter.csv          the Starter Kit words, placed by rule (id, hz)
           batch_001.csv ...    125 words each for the batch agents (id, hz, py, lv, pos, en)
           check_sample.csv     250 random words for the independent second-opinion agent
The agents write their answers to data/claude/themes_vNNN/ with the same NNN
(batch_001_v001.csv ..., check_v001.csv), columns id, hz, theme_no, confidence, alt_theme_no, note.
"""
import random
from pathlib import Path

from common import latest_version_path, next_version_path, read_jsonl, write_new_csv
from themes import BATCH_COLUMNS, batch_rows, chunks, is_starter

BATCH_SIZE = 125
SAMPLE_SIZE = 250


def main():
    words = read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))
    starter = [w for w in words if is_starter(w)]
    rest = [w for w in words if not is_starter(w)]
    folder = next_version_path("data/build/theme_batches", "")
    folder.mkdir()
    write_new_csv(folder / "starter.csv", ["id", "hz"], [[w["id"], w["hz"]] for w in starter])
    batches = chunks(rest, BATCH_SIZE)
    for n, batch in enumerate(batches, start=1):
        write_new_csv(folder / f"batch_{n:03d}.csv", BATCH_COLUMNS, batch_rows(batch))
    sample = sorted(random.Random(6).sample(rest, SAMPLE_SIZE), key=lambda w: w["id"])
    write_new_csv(folder / "check_sample.csv", BATCH_COLUMNS, batch_rows(sample))
    answers = Path("data/claude") / folder.name.replace("theme_batches", "themes")
    print(f"Starter Kit by rule: {len(starter)} words: {' '.join(w['hz'] for w in starter)}")
    print(f"{len(rest)} words in {len(batches)} batches and a second-opinion sample of {SAMPLE_SIZE} in {folder}")
    print(f"Agents write their answers to {answers}")


if __name__ == "__main__":
    main()
