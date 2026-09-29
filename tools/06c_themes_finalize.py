"""Step 6c. Apply the user's theme review: final themes, curriculum order and overlap lists.

Inputs:  data/build/wordlist_vNNN.jsonl (latest)
         data/manual/themes_reviewed_vNNN.csv (latest), the user's edited copy of the review sheet
         data/review/themes_review_vNNN.csv (latest), the review sheet as step 6b wrote it
         data/manual/theme_list_reviewed_vNNN.csv (latest) if the user ever edited the theme list,
         else data/review/theme_list_vNNN.csv (latest)
         Each is picked by its own latest version, so their numbers need not match.
Outputs: data/build/curriculum_vNNN.jsonl (id, theme, ord, noDistract),
         data/build/themes_vNNN.json (id, order, name, count),
         data/reports/curriculum_vNNN.txt
The order is level group first, then theme (the user's decision of 2026-09-29): HSK 1-2, then 3, 4, 5
and 6, and inside a group the themes in theme order (themes.curriculum). Theme ids t01, t02... follow
theme order, each theme's count covers all groups, and ord numbers the words as the blocks come.
Themes are never split and have no minimum size. Nothing is written if the review has problems.
"""
import sys

from common import (all_version_paths, latest_version_path, next_versions, read_csv, read_jsonl, write_new_json,
                    write_new_jsonl, write_new_text)
from distract import no_distract
from review import check_review, check_theme_list
from themes import curriculum
from validate import check_order


def read_sheet(path):
    try:
        return read_csv(path)
    except UnicodeDecodeError:
        sys.exit(f"{path} is not UTF-8. In Excel use File, Save As, 'CSV UTF-8 (Comma delimited)', "
                 "under a new version number.")


def without_blank_rows(rows):
    """Drop rows whose cells are all empty, such as the ",,,,," rows Excel can leave at the end of a sheet."""
    return [r for r in rows if any((v or "").strip() for v in r.values() if not isinstance(v, list))]


def finalize(blocks, order, names, overlap):
    """Curriculum rows and theme entries from the blocks of themes.curriculum.

    order: theme numbers in study order. names: {theme_no: name}. overlap: {id: [ids]} (noDistract).
    Theme k of the order gets id t01, t02..., and its count is its words over all level groups.
    ord numbers the words 1, 2, 3... walking the blocks in order. For example, blocks
    [("HSK 1-2", 2, ..., [a, b]), ("HSK 1-2", 1, ..., [c]), ("HSK 3", 2, ..., [d])] with order [2, 1]
    give a t01 ord 1, b t01 ord 2, c t02 ord 3, d t01 ord 4, and t01 has count 3.
    """
    tid = {no: f"t{k:02d}" for k, no in enumerate(order, start=1)}
    counts = {no: 0 for no in order}
    rows = []
    for _, no, _, members in blocks:
        counts[no] += len(members)
        for w in members:
            rows.append({"id": w["id"], "theme": tid[no], "ord": len(rows) + 1, "noDistract": overlap.get(w["id"], [])})
    themes = [{"id": tid[no], "order": k, "name": names[no], "count": counts[no]} for k, no in enumerate(order, start=1)]
    return rows, themes


def main():
    words = {w["id"]: w for w in read_jsonl(latest_version_path("data/build/wordlist", ".jsonl"))}
    reviewed_path = latest_version_path("data/manual/themes_reviewed", ".csv")
    generated_path = latest_version_path("data/review/themes_review", ".csv")
    edited_lists = all_version_paths("data/manual/theme_list_reviewed", ".csv")
    list_path = edited_lists[-1][1] if edited_lists else latest_version_path("data/review/theme_list", ".csv")
    problems, theme_of = check_review(words, read_csv(generated_path), without_blank_rows(read_sheet(reviewed_path)))
    more, order, names = check_theme_list(without_blank_rows(read_sheet(list_path)))
    problems += more
    if problems:
        sys.exit(f"Stopped, nothing written. {len(problems)} problems:\n  " + "\n  ".join(problems[:40]))

    blocks = curriculum(list(words.values()), theme_of, order, names)
    rows, themes = finalize(blocks, order, names, no_distract(list(words.values())))
    empty = [t["name"] for t in themes if not t["count"]]
    bad = check_order([dict(r, lv=words[r["id"]]["lv"]) for r in rows], [t["id"] for t in themes])
    if empty or bad or len(rows) != len(words):
        sys.exit("Stopped, nothing written.\n  " + "\n  ".join(
            [f"theme {name} has no words" for name in empty] + bad[:40] +
            ([f"{len(rows)} curriculum rows for {len(words)} words"] if len(rows) != len(words) else [])))

    paths = next_versions(curriculum=("data/build/curriculum", ".jsonl"), themes=("data/build/themes", ".json"),
                          report=("data/reports/curriculum", ".txt"))
    write_new_jsonl(paths["curriculum"], rows)
    write_new_json(paths["themes"], themes)
    lines = ["Curriculum report", "", f"Review used: {reviewed_path}, compared with {generated_path}",
             f"Theme list used: {list_path}", f"Words: {len(rows)} in {len(themes)} themes",
             f"Words with at least one overlapping meaning (noDistract): "
             f"{sum(1 for r in rows if r['noDistract'])}", "", "Level groups (first ord, words):"]
    start = 1
    for label in dict.fromkeys(b[0] for b in blocks):
        n = sum(len(b[3]) for b in blocks if b[0] == label)
        lines.append(f"  {label}: from ord {start}, {n} words")
        start += n
    lines += ["", "Themes (words over all level groups):"]
    lines += [f"  {t['id']} {t['name']}: {t['count']}" for t in themes]
    write_new_text(paths["report"], "\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"Curriculum: {paths['curriculum']}. Themes: {paths['themes']}. Report: {paths['report']}")


if __name__ == "__main__":
    main()
