"""Checks on the user's edited theme spreadsheet and theme list (from step 6b's review files).

The user moves a word by changing its theme_no; the theme_name column is only there to read.
"""
from themes import THEMES


def check_review(words, generated, reviewed):
    """Check the user's edited review sheet against the one step 6b wrote.

    words: {id: word}. generated and reviewed: lists of CSV rows. Returns (problems, {id: theme_no}).
    """
    problems, theme_of = [], {}
    generated = {r["id"]: r for r in generated}
    counts = {}
    for r in reviewed:
        rid = (r.get("id") or "").strip()
        counts[rid] = counts.get(rid, 0) + 1
        if rid not in words:
            problems.append(f"{rid!r}: not a word id")
            continue
        if (r.get("hz") or "").strip() != words[rid]["hz"]:
            problems.append(f"{rid}: characters read as {r.get('hz')!r}, so the file was not saved as CSV UTF-8")
        no = (r.get("theme_no") or "").strip()
        if not no.isdigit() or not 1 <= int(no) <= len(THEMES):
            problems.append(f"{rid}: theme_no {no!r} is not 1 to {len(THEMES)}")
            continue
        old = generated[rid]
        if (r.get("theme_name") or "").strip() != old["theme_name"] and no == old["theme_no"]:
            problems.append(f"{rid}: theme_name was changed but theme_no was not; change theme_no to move a word")
        theme_of[rid] = int(no)
    problems += [f"{rid}: appears {n} times" for rid, n in counts.items() if n > 1]
    problems += [f"{rid}: missing from the sheet" for rid in words if rid not in counts]
    return problems, theme_of


def check_theme_list(rows):
    """Check the theme list (theme_no, order, name). Returns (problems, order, names), where order
    lists theme numbers in study order and names maps theme_no to its (possibly renamed) name."""
    problems = []
    try:
        numbers = sorted(int(r["theme_no"]) for r in rows)
        orders = sorted(int(r["order"]) for r in rows)
    except (KeyError, ValueError):
        return ["theme_no and order must be whole numbers"], [], {}
    if numbers != list(range(1, len(THEMES) + 1)):
        problems.append(f"theme_no must be 1 to {len(THEMES)}, each once")
    if orders != list(range(1, len(THEMES) + 1)):
        problems.append(f"order must use 1 to {len(THEMES)}, each once")
    names = {int(r["theme_no"]): (r.get("name") or "").strip() for r in rows}
    problems += [f"theme {n} has no name" for n, name in names.items() if not name]
    order = [int(r["theme_no"]) for r in sorted(rows, key=lambda r: int(r["order"]))]
    return problems, order, names
