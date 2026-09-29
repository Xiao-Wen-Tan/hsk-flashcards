from wordsjson import LICENSE, build, stale

ROWS = [("w0001", "爱", "ài", "ai4", "ai", "love"), ("w0002", "八", "bā", "ba1", "ba", "eight"),
        ("w0003", "爸爸", "bàba", "ba4 ba5", "baba", "father"), ("w0004", "杯子", "bēizi", "bei1 zi5", "beizi", "cup"),
        ("w0005", "北京", "Běijīng", "bei3 jing1", "beijing", "Beijing")]


def sample():
    words = [{"id": i, "hz": hz, "py": py, "pyNum": num, "pyBase": base, "syl": len(num.split()), "lv": 1,
              "pos": ["n."], "en": en, "enShort": en, "freq": 1} for i, hz, py, num, base, en in ROWS]
    curriculum = [{"id": w["id"], "theme": "t01", "ord": k, "noDistract": []} for k, w in enumerate(words, start=1)]
    themes = [{"id": "t01", "order": 1, "name": "Family & People", "count": 5}]
    sentences = [{"id": w["id"], "sentence": f"我说{w['hz']}。", "en": "I say it.", "src": "claude"} for w in words]
    pinyin = {w["id"]: f"Wǒ shuō {w['py']}." for w in words}
    audio = {w["id"]: {"w": f"w/{w['id']}_0123abcd.mp3", "s": f"s/{w['id']}_4567cdef.mp3"} for w in words}
    return build("v001", "2026-10-05", words, curriculum, themes, sentences, pinyin, audio)


def test_build_matches_the_schema_example_shape():
    data = sample()
    assert list(data) == ["version", "generated", "license", "themes", "words"] and data["license"] == LICENSE
    first = data["words"][0]
    assert list(first) == ["id", "hz", "py", "pyNum", "pyBase", "syl", "lv", "pos", "en", "enShort", "theme", "ord",
                           "au", "noDistract", "ex"]
    assert first["ex"] == {"hz": "我说爱。", "py": "Wǒ shuō ài.", "en": "I say it.", "au": "s/w0001_4567cdef.mp3",
                           "src": "claude"}


def test_stale_names_pinyin_and_audio_made_from_other_text():
    sentences = [{"id": "w0001", "sentence": "我爱你。"}, {"id": "w0002", "sentence": "八个人。"}]
    pinyin_rows = [{"id": "w0001", "sentence": "我爱你。", "py": "Wǒ ài nǐ."},
                   {"id": "w0002", "sentence": "八本书。", "py": "Bā běn shū."}]
    expected = {"w0001": {"w": "w/w0001_0123abcd.mp3", "s": "s/w0001_4567cdef.mp3"},
                "w0002": {"w": "w/w0002_0123abcd.mp3", "s": "s/w0002_89abcdef.mp3"}}
    audio = {"w0001": expected["w0001"], "w0002": {"w": "w/w0002_0123abcd.mp3", "s": "s/w0002_00000000.mp3"}}
    assert stale(sentences, pinyin_rows, audio, expected) == [
        "w0002: the pinyin was made from '八本书。' but the final sentence is '八个人。'",
        "w0002: the audio map has s/w0002_00000000.mp3 where the final texts give s/w0002_89abcdef.mp3"]
    assert stale(sentences, pinyin_rows[:1], {"w0001": audio["w0001"]}, {"w0001": expected["w0001"]}) == []
