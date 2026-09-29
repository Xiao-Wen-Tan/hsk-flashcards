"""Step 7. Choose the PDF sentences and prepare the batches for the Claude writing and translating agents.

Inputs:  data/build/wordlist_vNNN.jsonl, data/build/curriculum_vNNN.jsonl, data/build/themes_vNNN.json (latest)
Outputs (one shared version NNN):
  data/build/sentences_pdf_vNNN.jsonl              {id, sentence, ref} for every word with a usable PDF sentence
  data/build/sentence_batches_vNNN/batch_001.csv   words that need a new sentence, 60 per batch
                                                   (id, hz, py, lv, pos, en, theme)
  data/build/translation_batches_vNNN/batch_001.csv  PDF sentences to translate, 100 per batch
                                                   (id, word, word_py, word_en, sentence)
  data/reports/sentences_vNNN.txt
The agents answer in data/claude/sentences_vNNN/batch_001_v001.csv (id, hz, sentence, en) and
data/claude/translations_vNNN/batch_001_v001.csv (id, sentence, en).
"""
from collections import Counter

from common import (latest_version_path, next_versions, read_json, read_jsonl, write_new_csv, write_new_jsonl,
                    write_new_text)
from sentences import char_levels, choose_pdf_sentence
from themes import chunks

WRITE_BATCH, TRANSLATE_BATCH = 60, 100


def main():
    words = read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))
    theme_of = {r["id"]: r["theme"] for r in read_jsonl(latest_version_path("data/build/curriculum", ".jsonl"))}
    theme_name = {t["id"]: t["name"] for t in read_json(latest_version_path("data/build/themes", ".json"))}
    levels = char_levels(words)
    chosen, needed = [], []
    for w in words:
        found = choose_pdf_sentence(w, levels)
        if found:
            chosen.append({"id": w["id"], "sentence": found[0], "ref": found[1], "word": w})
        else:
            needed.append(w)

    paths = next_versions(pdf=("data/build/sentences_pdf", ".jsonl"), write=("data/build/sentence_batches", ""),
                          translate=("data/build/translation_batches", ""), report=("data/reports/sentences", ".txt"))
    write_new_jsonl(paths["pdf"], [{k: c[k] for k in ("id", "sentence", "ref")} for c in chosen])
    paths["write"].mkdir()
    for n, batch in enumerate(chunks(needed, WRITE_BATCH), start=1):
        write_new_csv(paths["write"] / f"batch_{n:03d}.csv", ["id", "hz", "py", "lv", "pos", "en", "theme"],
                      [[w["id"], w["hz"], w["py"], w["lv"], " ".join(w["pos"]), w["en"],
                        theme_name[theme_of[w["id"]]]] for w in batch])
    paths["translate"].mkdir()
    for n, batch in enumerate(chunks(chosen, TRANSLATE_BATCH), start=1):
        write_new_csv(paths["translate"] / f"batch_{n:03d}.csv", ["id", "word", "word_py", "word_en", "sentence"],
                      [[c["id"], c["word"]["hz"], c["word"]["py"], c["word"]["en"], c["sentence"]] for c in batch])
    need_levels = Counter(w["lv"] for w in needed)
    lines = ["Sentence report", "",
             f"Words: {len(words)}. With a usable PDF sentence: {len(chosen)}. Need a new sentence: {len(needed)}.",
             "New sentences needed by HSK level: "
             + ", ".join(f"HSK{lv} {need_levels[lv]}" for lv in sorted(need_levels)),
             "PDF words whose sentences were all unusable: " + " ".join(w["hz"] for w in needed if w["src"] == "pdf"),
             f"Writing batches: {-(-len(needed) // WRITE_BATCH)} in {paths['write']}",
             f"Translation batches: {-(-len(chosen) // TRANSLATE_BATCH)} in {paths['translate']}", ""]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
