"""Step 3. Unscramble the Chinese glyph codes in the PDFs.

Inputs:  data/public/hsk2_old_exclusive_vNNN.json, data/public/hsk_complete_vNNN.json,
         data/extract/pdf_entries_vNNN.jsonl, data/extract/seed_cmap_vNNN.csv,
         data/decode/glyph_seed_vNNN.csv once it exists (eye readings of unknown glyphs),
         data/decode/suspects_vNNN.csv once it exists (readings the visual check flagged)
Outputs: data/decode/cidmap_vNNN.csv (cid, char, source), data/decode/unresolved_vNNN.csv,
         data/decode/entry_match_vNNN.csv (opens in Excel), data/reports/decode_vNNN.txt

Each entry is matched twice against the two public lists (old HSK list first, then the
complete list). The level-free matches are solved first; the matches that prefer words at
the PDF file's level only settle what the level-free pass leaves open. Readings listed in
the latest suspects file are banned, so those codes stay unknown and go to blind reading,
unless the latest glyph seed has since confirmed the same reading.
A headword with a bracketed variant, such as 这（这儿）, is matched on the part before （
(decode.match_head); the outputs still show the whole headword.
"""
import random

from common import (all_version_paths, latest_version_path, next_versions, read_csv, read_json,
                    read_jsonl, write_new_csv, write_new_text)
from decode import (body_text, build_index, candidates, complete_as_public, coverage, decode_cids,
                    effective_bans, live_candidates, match_head, solve)


def load_seeds():
    footer = {int(r["cid"]): r["char"] for r in read_csv(latest_version_path("data/extract/seed_cmap", ".csv"))}
    found = all_version_paths("data/decode/glyph_seed", ".csv")
    glyph = {int(r["cid"]): r["char"] for r in read_csv(found[-1][1])} if found else {}
    return footer, glyph, (found[-1][1] if found else None)


def load_banned():
    found = all_version_paths("data/decode/suspects", ".csv")
    if not found:
        return set(), None
    return {(r["cid"], r["char"]) for r in read_csv(found[-1][1])}, found[-1][1]


def main():
    old = read_json(latest_version_path("data/public/hsk2_old_exclusive", ".json"))
    complete = read_json(latest_version_path("data/public/hsk_complete", ".json"))
    entries = read_jsonl(latest_version_path("data/extract/pdf_entries", ".jsonl"))
    footer, glyph, glyph_file = load_seeds()
    suspects, banned_file = load_banned()
    banned = effective_bans(suspects, glyph)
    old_index = build_index(old)
    indexes = [old_index, build_index(complete_as_public(complete))]

    heads = [match_head(e["head"]) for e in entries]
    free = [candidates(len(h), e["latin"], e["file"], indexes, use_level=False) for e, h in zip(entries, heads)]
    level = [candidates(len(h), e["latin"], e["file"], indexes) for e, h in zip(entries, heads)]
    old_only = [candidates(len(h), e["latin"], e["file"], [old_index], use_level=False)
                for e, h in zip(entries, heads)]
    # Matched only through the complete list: the old list alone gives nothing, or gives a
    # worse match (for example a toneless 甜 tián where the complete list has 天 tiān exactly).
    via_complete = [e for e, f, o in zip(entries, free, old_only) if f and f != o]
    via_complete_new = sum(1 for e, f, o in zip(entries, free, old_only) if f and not o)

    fwd, conflicts = solve(list(zip(heads, free)), {**footer, **glyph},
                           fallback=list(zip(heads, level)), banned=banned)
    rev = {ch: cid for cid, ch in fwd.items()}
    per_file, body_total, body_ok, unresolved, example, all_cids = coverage(entries, fwd)

    paths = next_versions(cidmap=("data/decode/cidmap", ".csv"), unresolved=("data/decode/unresolved", ".csv"),
                          match=("data/decode/entry_match", ".csv"), report=("data/reports/decode", ".txt"))
    source = {cid: "footer" if cid in footer else "glyph" if cid in glyph else "headword" for cid in fwd}
    write_new_csv(paths["cidmap"], ["cid", "char", "source"], [(c, fwd[c], source[c]) for c in sorted(fwd)])
    write_new_csv(paths["unresolved"], ["cid", "count", "example"],
                  [(c, n, example[c]) for c, n in unresolved.most_common()])

    match_rows, no_match, unsure = [], [], []
    for e, h, fc, lc in zip(entries, heads, free, level):
        live = live_candidates(h, lc, fwd, rev, banned) or live_candidates(h, fc, fwd, rev, banned)
        shown = live or lc or fc
        if not fc:
            status = "none"
            no_match.append(e)
        elif len(live) == 1:
            status = "unique"
        else:
            status = "ambiguous" if live else "contradicted"
            unsure.append((e, status, shown))
        match_rows.append((e["file"], e["n"], decode_cids(e["head"], fwd), status, " ".join(shown),
                           e["latin"].strip()[:60]))
    write_new_csv(paths["match"], ["file", "n", "head", "status", "candidates", "latin"], match_rows, excel=True)

    lines = ["Decode report", "",
             f"Codes known before solving: {len(footer)} from the footer font, {len(glyph)} from glyph reading"
             + (f" ({glyph_file})" if glyph_file else ""),
             f"Banned suspect readings: {len(banned)} of {len(suspects)} suspects"
             + (f" ({banned_file}; the rest are confirmed by the glyph seed)" if banned_file else ""), "",
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
              f"Entries matched only through the complete list: {len(via_complete)} "
              f"({via_complete_new} of them have no match at all in the old list)",
              f"Entries still ambiguous or contradicted: {len(unsure)}",
              f"Codes with mixed votes: {len(conflicts)}", ""]
    summary_len = len(lines)
    if no_match:
        lines.append(f"Entries with no match (all {len(no_match)}):")
        lines += [f"  HSK{e['file']} #{e['n']}: {e['latin'].strip()[:70]}" for e in no_match]
        lines.append("")
    if unsure:
        lines.append("First 25 ambiguous or contradicted entries:")
        lines += [f"  HSK{e['file']} #{e['n']} {status}: {' / '.join(c)}  ({e['latin'].strip()[:40]})"
                  for e, status, c in unsure[:25]]
        lines.append("")
    if conflicts:
        lines.append(f"Codes with mixed votes (all {len(conflicts)}), shown as code = decoded character: votes:")
        lines += [f"  {cid} = {fwd.get(cid, '?')}: {votes}" for cid, votes in sorted(conflicts.items())]
        lines.append("")
    if via_complete:
        lines.append("First 25 entries matched only through the complete list:")
        lines += [f"  HSK{e['file']} #{e['n']} {decode_cids(e['head'], fwd)} {e['latin'].strip()[:40]}"
                  for e in via_complete[:25]]
        lines.append("")
    lines.append("20 random entries, decoded (□ means still unknown):")
    for e in random.Random(1).sample(entries, 20):
        lines.append(f"  HSK{e['file']} #{e['n']} {decode_cids(e['head'], fwd)} "
                     f"{e['latin'].strip()[:40]} | {body_text(e, fwd)[:80]}")
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines[:summary_len]))
    print(f"Full report: {paths['report']}")


if __name__ == "__main__":
    main()
