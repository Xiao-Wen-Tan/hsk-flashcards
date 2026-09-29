"""Step 10. Write the app's word data file.

Inputs (the latest of each): data/build/wordlist_vNNN.jsonl, curriculum_vNNN.jsonl, themes_vNNN.json,
         sentences_final_vNNN.jsonl, sentence_pinyin_final_vFFF.jsonl (the style-sheet pinyin of steps 8c
         to 8e), sentence_pinyin_vNNN.jsonl (the draft of step 8, whose polyphone_batches_vNNN folder must
         be empty), audio_map_vNNN.json and data/manual/tts_standins_vNNN.csv
Output:  docs/data/words_vNNN.json, compact UTF-8 JSON in the shape of .claude/plans/words-json-schema.md
Nothing is written when a word is missing from an input, when the corrected pinyin was made from an older
draft than the latest one of step 8, or when the sentence pinyin or the audio was made from other text than
the final sentences (for example after step 7c or 7d changed a sentence). Then the message names the words,
and the named steps must be run again.
"""
import json
import sys
from datetime import date
from pathlib import Path

from common import all_version_paths, latest_version_path, next_version_path, read_csv, read_json, read_jsonl, \
    write_new_text
from ttsaudio import audio_map, jobs, standins_from
from wordsjson import build, stale


def main():
    draft_path = latest_version_path("data/build/sentence_pinyin", ".jsonl")
    version = draft_path.stem.rsplit("_", 1)[1]
    if list(Path(f"data/build/polyphone_batches_{version}").glob("batch_*.csv")):
        sys.exit("Stopped. The latest pinyin run still lists characters to check (Plan 3b Task 12).")
    pinyin_path = latest_version_path("data/build/sentence_pinyin_final", ".jsonl")
    drafts = {r["id"]: r["py"] for r in read_jsonl(draft_path)}
    words = read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))
    curriculum = read_jsonl(latest_version_path("data/build/curriculum", ".jsonl"))
    themes = read_json(latest_version_path("data/build/themes", ".json"))
    sentences = read_jsonl(latest_version_path("data/build/sentences_final", ".jsonl"))
    pinyin_rows = read_jsonl(pinyin_path)
    pinyin = {r["id"]: r["py"] for r in pinyin_rows}
    older = [r["id"] for r in pinyin_rows if drafts.get(r["id"]) != r["draft"]]
    if older:
        sys.exit(f"Stopped, nothing written. The pinyin of {len(older)} sentences in {pinyin_path} was corrected from "
                 f"an older draft than {draft_path}, for example {older[:5]}. Run Task 14 again, whose step 8c "
                 "batches only those sentences.")
    audio = read_json(latest_version_path("data/build/audio_map", ".json"))
    ids = {w["id"] for w in words}
    gaps = {name: sorted(ids - set(have))[:5] for name, have in
            (("curriculum", {r["id"] for r in curriculum}), ("sentences", {r["id"] for r in sentences}),
             ("pinyin", set(pinyin)), ("audio", set(audio)))}
    gaps = {name: missing for name, missing in gaps.items() if missing}
    if gaps:
        sys.exit(f"Stopped, nothing written. Words missing from: {gaps}")
    found = all_version_paths("data/manual/tts_standins", ".csv")
    standins = standins_from(read_csv(found[-1][1])) if found else {}
    expected = audio_map(jobs(words, {r["id"]: r["sentence"] for r in sentences}, standins))
    problems = stale(sentences, pinyin_rows, audio, expected)
    if problems:
        sys.exit(f"Stopped, nothing written. {len(problems)} pinyin or audio entries were made from other text "
                 "than the final sentences. Run tools/08_pinyin.py (and Task 12 if it lists characters), Task 14, "
                 "then tools/09_generate_audio.py, then this step again:\n  " + "\n  ".join(problems[:20]))
    path = next_version_path("docs/data/words", ".json")
    data = build(path.stem.rsplit("_", 1)[1], date.today().isoformat(), words, curriculum, themes, sentences,
                 pinyin, audio)
    write_new_text(path, json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n")
    print(f"{len(data['words'])} words in {len(data['themes'])} themes -> {path} "
          f"({path.stat().st_size / 1e6:.1f} MB)")


if __name__ == "__main__":
    main()
