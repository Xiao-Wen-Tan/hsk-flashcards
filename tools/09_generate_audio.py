"""Step 9. Make the MP3 files with Microsoft's neural Chinese voice through edge-tts.

Inputs:  data/build/wordlist_vNNN.jsonl and data/build/sentences_final_vNNN.jsonl (latest),
         data/manual/tts_standins_vNNN.csv (latest; hz, pynum, speak)
Outputs: docs/audio/w/<id>_<hash>.mp3 and docs/audio/s/<id>_<hash>.mp3,
         data/build/audio_map_vNNN.json ({id: {"w": path, "s": path}}) once every file is present,
         data/reports/audio_vNNN.txt
Run with --suggest-standins first. It lists the single-character words whose card reading differs
from the character's default reading, with same-sound characters to read instead, in
data/build/tts_standins_suggested_vNNN.csv.
The script can be stopped and rerun. Finished files are checked and kept, and missing ones are made.
A file is first written as <name>.mp3.part and renamed only after it passes the MP3 check.
"""
import argparse
import os
import sys
import time
from pathlib import Path

import edge_tts
from pypinyin import Style, lazy_pinyin, pinyin

from common import (all_version_paths, latest_version_path, next_version_path, next_versions, read_csv, read_jsonl,
                    write_new_csv, write_new_json, write_new_text)
from sentences import char_levels
from ttsaudio import VOICE, audio_map, jobs, mp3_problem, needs_standin, standins_from

ROOT = Path("docs/audio")
PAUSE, TRIES = 0.3, 4
OPTIONS = dict(style=Style.TONE3, neutral_tone_with_five=True, v_to_u=True)


def default_reading(hz):
    return lazy_pinyin(hz, **OPTIONS)[0]


def only_reading(ch):
    found = set(pinyin(ch, heteronym=True, **OPTIONS)[0])
    return found.pop() if len(found) == 1 else None


def suggest(words):
    targets = needs_standin(words, default_reading)
    levels = char_levels(words)
    pool = sorted(levels, key=lambda ch: (levels[ch], ch))
    rows = []
    for w in targets:
        options = [ch for ch in pool if ch != w["hz"] and only_reading(ch) == w["pyNum"]][:3]
        rows.append([w["hz"], w["pyNum"], w["py"], default_reading(w["hz"]), " ".join(options),
                     options[0] if options else ""])
    path = next_version_path("data/build/tts_standins_suggested", ".csv")
    write_new_csv(path, ["hz", "pynum", "py", "default", "options", "speak"], rows, excel=True)
    print(f"{len(rows)} words need a stand-in. Suggestions: {path}")


def make(job):
    """Make one file if it is missing. Returns None when the file is ready, else why it is not."""
    final = ROOT / job["path"]
    if final.exists():
        return mp3_problem(final.read_bytes(), job["kind"])
    part = final.with_name(final.name + ".part")
    error = None
    for attempt in range(TRIES):
        try:
            edge_tts.Communicate(job["text"], VOICE, rate=job["rate"]).save_sync(str(part))
            error = None
            break
        except Exception as e:  # the service can refuse or drop a request; wait and try again
            error = f"{type(e).__name__}: {e}"
            time.sleep(2 ** (attempt + 1))
    time.sleep(PAUSE)
    if error:
        return error
    problem = mp3_problem(part.read_bytes(), job["kind"])
    if problem:
        part.unlink()
        return problem
    for attempt in range(TRIES):
        try:
            os.rename(part, final)
            return None
        except OSError as e:  # Box Drive can time out while it syncs the folder; wait and try again
            error = f"{type(e).__name__}: {e}"
            time.sleep(2 ** (attempt + 1))
    return error


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--suggest-standins", action="store_true")
    args = parser.parse_args()
    words = read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))
    if args.suggest_standins:
        suggest(words)
        return
    sentences = {r["id"]: r["sentence"] for r in read_jsonl(latest_version_path("data/build/sentences_final", ".jsonl"))}
    found = all_version_paths("data/manual/tts_standins", ".csv")
    standins = standins_from(read_csv(found[-1][1])) if found else {}
    missing = [w for w in needs_standin(words, default_reading) if (w["hz"], w["pyNum"]) not in standins]
    if missing:
        sys.exit("Stopped. These words need a row in data/manual/tts_standins_vNNN.csv: "
                 + " ".join(f"{w['hz']} {w['pyNum']}" for w in missing))
    todo = jobs(words, sentences, standins)
    for kind in ("w", "s"):
        (ROOT / kind).mkdir(parents=True, exist_ok=True)
    failures = []
    for n, job in enumerate(todo, start=1):
        problem = make(job)
        if problem:
            failures.append(f"{job['path']} ({job['text']}): {problem}")
        if n % 200 == 0:
            print(f"{n}/{len(todo)} files, {len(failures)} failed so far", flush=True)
    lines = ["Audio report", "", f"Voice {VOICE}. Files: {len(todo)}. Failed: {len(failures)}.", ""] + failures[:200]
    if failures:
        path = next_version_path("data/reports/audio", ".txt")
        write_new_text(path, "\n".join(lines) + "\n")
        sys.exit(f"{len(failures)} files failed, listed in {path}. Run the script again to retry them.")
    audio = audio_map(todo)
    standin_list = [f"  {w['id']} {w['hz']} {w['py']}: docs/audio/{audio[w['id']]['w']}"
                    for w in words if (w["hz"], w["pyNum"]) in standins]
    lines += ["Word files read with a stand-in character (for the listening check):"] + standin_list
    paths = next_versions(map=("data/build/audio_map", ".json"), report=("data/reports/audio", ".txt"))
    write_new_json(paths["map"], audio)
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines[:4]))
    print(f"Audio map: {paths['map']}. Report: {paths['report']}")


if __name__ == "__main__":
    main()
