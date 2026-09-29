"""Names, texts and checks for the MP3 files made with Microsoft's neural voice through edge-tts.

A file's name is the word ID plus a short hash of the voice, the speed and the text, for
example "w/w0001_3fa2b1c9.mp3". Changed text gives a new name, so an old file is never
overwritten, and a finished file can be skipped when the script is run again.
"""
import hashlib

VOICE = "zh-CN-XiaoxiaoNeural"
WORD_RATE, SENTENCE_RATE = "-10%", "-15%"
BYTES_PER_SECOND = 6000  # edge-tts sends 24 kHz mono MP3 at 48 kilobits per second
SECONDS = {"w": (0.3, 6.0), "s": (0.8, 20.0)}


def spoken(hz):
    """The text read aloud for a headword, where a pattern word's halves become a short list.

    "虽然…但是…" gives "虽然，但是"; "爱" stays "爱".
    """
    return "，".join(p for p in hz.split("…") if p)


def audio_path(kind, wid, text, rate, voice=VOICE):
    """The path relative to docs/audio/ for kind "w" (word) or "s" (sentence), a word ID and a text."""
    digest = hashlib.sha1(f"{voice}|{rate}|{text}".encode("utf-8")).hexdigest()[:8]
    return f"{kind}/{wid}_{digest}.mp3"


def mp3_problem(data, kind):
    """Why these bytes are not a usable MP3 of the expected length, or None.

    An MP3 starts with an ID3 tag or an MPEG frame header (0xFF then three set bits). The length
    in seconds is estimated from the size, and a word must last 0.3 to 6 s and a sentence 0.8 to 20 s.
    """
    if len(data) < 4 or not (data[:3] == b"ID3" or (data[0] == 0xFF and data[1] & 0xE0 == 0xE0)):
        return "not an MP3 file"
    seconds = len(data) / BYTES_PER_SECOND
    low, high = SECONDS[kind]
    if not low <= seconds <= high:
        return f"about {seconds:.1f} s long, outside {low} to {high} s"
    return None


def needs_standin(words, default_reading):
    """Single-character words whose card reading is not the character's default reading.

    default_reading(hz) gives the numbered reading a speech engine is likely to use. For these
    words a same-sound stand-in character is read instead, for example 杭 for 行 háng.
    """
    return [w for w in words if len(w["hz"]) == 1 and default_reading(w["hz"]) != w["pyNum"]]


def jobs(words, sentences, standins):
    """Every file to make: {"id", "kind", "text", "rate", "path"}.

    standins maps (hz, pyNum) to the text to read instead of the headword.
    sentences maps id to the final sentence text.
    """
    out = []
    for w in words:
        text = standins.get((w["hz"], w["pyNum"]), spoken(w["hz"]))
        out.append({"id": w["id"], "kind": "w", "text": text, "rate": WORD_RATE,
                    "path": audio_path("w", w["id"], text, WORD_RATE)})
        sentence = sentences[w["id"]]
        out.append({"id": w["id"], "kind": "s", "text": sentence, "rate": SENTENCE_RATE,
                    "path": audio_path("s", w["id"], sentence, SENTENCE_RATE)})
    return out


def standins_from(rows):
    """{(hz, pynum): speak} from the rows of data/manual/tts_standins_vNNN.csv (columns hz, pynum, speak)."""
    return {(r["hz"], r["pynum"]): r["speak"] for r in rows}


def audio_map(made):
    """{id: {"w": path, "s": path}} from the list that jobs() returns.

    Step 9 writes this map, and step 10 builds it again from the final texts to check that the
    audio was made from the same texts.
    """
    out = {}
    for job in made:
        out.setdefault(job["id"], {})[job["kind"]] = job["path"]
    return out
