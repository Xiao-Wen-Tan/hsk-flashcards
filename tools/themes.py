"""The 30 daily-life themes, the Starter Kit rule, and checks on Claude's theme choices.

Theme 1, the Starter Kit, is filled by a fixed rule, never by judgement. Every other
word is sorted into themes 2 to 30 by Claude batch agents, each writing one CSV per batch.
"""
import math

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
MAX_THEME, MIN_THEME = 350, 40
# Theme number 1 is the Starter Kit, whose words step 6b places by rule. Like every theme it
# needs at least MIN_THEME words.
STARTER_NO = 1
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


def split_by_level(words):
    """Split one theme's words, already in curriculum order, into parts of at most MAX_THEME.

    The parts are as equal as possible and keep the order, so the first part holds the
    lowest levels. 700 words give two parts of 350; 351 words give parts of 176 and 175.
    """
    parts = math.ceil(len(words) / MAX_THEME) or 1
    base, extra = divmod(len(words), parts)
    out, start = [], 0
    for i in range(parts):
        size = base + (1 if i < extra else 0)
        out.append(words[start:start + size])
        start += size
    return out


def curriculum(words, theme_of, theme_order, theme_names):
    """Themes in study order with their words, split into parts where needed.

    words: word dicts with "id", "lv" and "freq". theme_of: {id: theme_no}.
    theme_order: theme numbers in the order they are studied. theme_names: {theme_no: name}.
    Returns [(theme_no, name, [word, ...])]. Inside a theme, words go by HSK level, then by
    frequency (a smaller number is more common), then by id. Themes with no words are left out.
    """
    out = []
    for no in theme_order:
        members = sorted((w for w in words if theme_of[w["id"]] == no),
                         key=lambda w: (w["lv"], w["freq"], w["id"]))
        if not members:
            continue
        parts = split_by_level(members)
        for i, part in enumerate(parts, start=1):
            name = theme_names[no] + (f" (Part {i})" if len(parts) > 1 else "")
            out.append((no, name, part))
    return out
