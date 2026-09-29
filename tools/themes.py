"""The 30 daily-life themes, the Starter Kit rule, and checks on Claude's theme choices.

Theme 1, the Starter Kit, is filled by a fixed rule, never by judgement. Every other
word is sorted into themes 2 to 30 by Claude batch agents, each writing one CSV per batch.
"""
THEMES = ["Starter Kit", "Greetings & Courtesy", "Numbers & Measure Words", "Time & Dates",
          "Family & People", "Food & Drink", "Shopping & Money", "Home & Housework", "Daily Routine",
          "Body & Health", "Clothes & Appearance", "Transport & Travel", "Places & Directions",
          "Weather & Seasons", "Nature & Animals", "School & Study", "Work & Office",
          "Phone, Internet & Media", "Hobbies & Sports", "Feelings", "Personality & Behavior",
          "Friends & Social Life", "Talking & Thinking", "Describing Things", "Business & Economy",
          "Society, Law & Politics", "Science & Technology", "Culture, History & Arts",
          "Linking & Abstract Words", "Idioms & Formal Expressions"]
QUESTION_WORDS = {"什么", "谁", "哪", "哪儿", "几", "多少", "怎么", "怎么样", "为什么"}
CORE_WORDS = {"是", "有", "在", "要", "的", "了", "吗", "呢", "吧", "不", "没", "很", "也", "都",
              "和", "太", "还", "就", "没有", "一点儿"}
# A core headword with more than one card counts only in this reading, so 还 hái (still) counts and 还 huán (return) does not.
CORE_READINGS = {"还": "hai2"}
# Theme number 1 is the Starter Kit, whose words step 6b places by rule.
STARTER_NO = 1
# The learning order goes level group first, then theme (the user's decision of 2026-09-29).
# HSK 1 and 2 are learned together, then each higher level on its own.
LEVEL_GROUPS = [("HSK 1-2", (1, 2)), ("HSK 3", (3,)), ("HSK 4", (4,)), ("HSK 5", (5,)), ("HSK 6", (6,))]
BATCH_COLUMNS = ["id", "hz", "py", "lv", "pos", "en"]
OUTPUT_COLUMNS = ["id", "hz", "theme_no", "confidence", "alt_theme_no", "note"]


def is_starter(word):
    """The Starter Kit rule, which admits an HSK 1 or 2 word that is a pronoun, a question word, or one of
    the core words 是 有 在 要 的 了 吗 呢 吧 不 没 很 也 都 和 太 还 就 没有 一点儿.

    A core word with two cards counts only in the reading CORE_READINGS gives, so 还 hái
    (still) is in and 还 huán (to return) is not.
    """
    core = word["hz"] in CORE_WORDS and CORE_READINGS.get(word["hz"], word.get("pyNum")) == word.get("pyNum")
    return word["lv"] <= 2 and ("pron." in word["pos"] or word["hz"] in QUESTION_WORDS or core)


def batch_rows(words):
    """One input row per word, in BATCH_COLUMNS order, with pos labels joined by spaces."""
    return [[w["id"], w["hz"], w["py"], w["lv"], " ".join(w["pos"]), w["en"]] for w in words]


def chunks(items, size):
    """Consecutive pieces of at most `size` items, so 5 items with size 2 give pieces of 2, 2 and 1."""
    return [items[i:i + size] for i in range(0, len(items), size)]


def check_output(inputs, outputs, first_theme=2):
    """Problems in one batch agent's output, compared with its input rows.

    inputs and outputs are lists of dicts (CSV rows). Each input id must appear exactly once,
    with the same hz, a theme_no from first_theme to 30, a confidence of H, M or L, and an
    alt_theme_no that is empty or a theme number. Returns a list of problem strings.
    """
    problems = []
    want = {r["id"]: r["hz"] for r in inputs}
    seen = {}
    for r in outputs:
        rid = (r.get("id") or "").strip()
        seen[rid] = seen.get(rid, 0) + 1
        if rid not in want:
            problems.append(f"{rid}: not in the input")
            continue
        if (r.get("hz") or "").strip() != want[rid]:
            problems.append(f"{rid}: hz {r.get('hz')!r} differs from the input {want[rid]!r}")
        theme = (r.get("theme_no") or "").strip()
        if not theme.isdigit() or not first_theme <= int(theme) <= len(THEMES):
            problems.append(f"{rid}: theme_no {theme!r} is not {first_theme} to {len(THEMES)}")
        if (r.get("confidence") or "").strip() not in ("H", "M", "L"):
            problems.append(f"{rid}: confidence {r.get('confidence')!r} is not H, M or L")
        alt = (r.get("alt_theme_no") or "").strip()
        if alt and (not alt.isdigit() or not 1 <= int(alt) <= len(THEMES)):
            problems.append(f"{rid}: alt_theme_no {alt!r} is not a theme number")
    problems += [f"{rid}: classified {n} times" for rid, n in seen.items() if n > 1 and rid in want]
    problems += [f"{rid}: missing" for rid in want if rid not in seen]
    return problems


def second_opinion_flags(main, second):
    """Ids where the independent checker disagrees with the batch agent.

    main and second map id to (theme_no, alt_theme_no) as strings. A disagreement counts only
    when neither agent's first choice is the other's first or second choice.
    """
    flags = {}
    for rid, (theme2, alt2) in second.items():
        theme1, alt1 = main[rid]
        if theme1 != theme2 and theme1 != alt2 and theme2 != alt1:
            flags[rid] = theme2
    return flags


def level_group(lv):
    """The position in LEVEL_GROUPS of the group holding HSK level lv, so level 2 gives 0 and level 3 gives 1."""
    return next(k for k, (_, levels) in enumerate(LEVEL_GROUPS) if lv in levels)


def curriculum(words, theme_of, theme_order, theme_names):
    """The study order as blocks, one per level group and theme that share words.

    words: word dicts with "id", "lv" and "freq". theme_of: {id: theme_no}.
    theme_order: theme numbers in the order they are studied. theme_names: {theme_no: name}.
    Returns [(group label, theme_no, name, [word, ...])]. The blocks go by level group (HSK 1-2,
    then 3, 4, 5 and 6), and inside a group by theme order. Inside a block, words go by HSK level,
    then by frequency (a smaller number is more common), then by id. So Food & Drink gives one
    block of its HSK 1 and 2 words after the Starter Kit's, and another after the HSK 3 words of
    the themes before it. A theme is never split by size, and empty blocks are left out.
    """
    rank = {no: k for k, no in enumerate(theme_order)}
    blocks = {}
    for w in sorted(words, key=lambda w: (level_group(w["lv"]), rank[theme_of[w["id"]]], w["lv"], w["freq"], w["id"])):
        blocks.setdefault((level_group(w["lv"]), theme_of[w["id"]]), []).append(w)
    return [(LEVEL_GROUPS[group][0], no, theme_names[no], members) for (group, no), members in blocks.items()]
