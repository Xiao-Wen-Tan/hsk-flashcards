from ttsaudio import audio_map, audio_path, jobs, mp3_problem, needs_standin, spoken, standins_from


def test_spoken():
    assert spoken("虽然…但是…") == "虽然，但是"
    assert spoken("爱") == "爱"


def test_audio_path_changes_with_text_rate_and_voice():
    a = audio_path("w", "w0001", "爱", "-10%")
    assert a.startswith("w/00/w0001_") and a.endswith(".mp3") and len(a) == len("w/00/w0001_12345678.mp3")
    # A folder holds the files of 100 IDs, so no folder has more than 100 files.
    assert audio_path("s", "w5034", "爱", "-15%").startswith("s/50/w5034_")
    assert a == audio_path("w", "w0001", "爱", "-10%")
    assert a != audio_path("w", "w0001", "爱", "-15%")
    assert a != audio_path("w", "w0001", "爱你", "-10%")
    assert a != audio_path("w", "w0001", "爱", "-10%", voice="zh-CN-YunxiNeural")


def test_mp3_problem():
    assert mp3_problem(b"ID3" + b"\0" * 6000, "w") is None
    assert mp3_problem(b"\xff\xf3" + b"\0" * 12000, "s") is None
    assert mp3_problem(b"<html>" + b"\0" * 6000, "w") == "not an MP3 file"
    assert mp3_problem(b"ID3" + b"\0" * 100, "w") == "about 0.0 s long, outside 0.3 to 6.0 s"


def test_needs_standin_and_jobs():
    words = [{"id": "w1", "hz": "行", "pyNum": "hang2"}, {"id": "w2", "hz": "爱", "pyNum": "ai4"},
             {"id": "w3", "hz": "银行", "pyNum": "yin2 hang2"}]
    default = {"行": "xing2", "爱": "ai4"}
    assert [w["id"] for w in needs_standin(words, lambda hz: default.get(hz, ""))] == ["w1"]
    standins = standins_from([{"hz": "行", "pynum": "hang2", "speak": "杭"}])
    assert standins == {("行", "hang2"): "杭"}
    made = jobs(words[:1], {"w1": "我去银行。"}, standins)
    assert [(j["kind"], j["text"], j["rate"]) for j in made] == [("w", "杭", "-10%"), ("s", "我去银行。", "-15%")]
    assert made[0]["path"] == audio_path("w", "w1", "杭", "-10%")
    assert audio_map(made) == {"w1": {"w": made[0]["path"], "s": made[1]["path"]}}
