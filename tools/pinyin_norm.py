"""Pinyin clean-up used to match PDF entries with the public word list."""
import unicodedata

_DROP = str.maketrans("", "", " '’‘-·")
_TONE_MARKS = {"\u0304", "\u0301", "\u030c", "\u0300"}  # macron, acute, caron, grave


def norm(s):
    """Lower case, composed accents, no spaces or apostrophes. 'Běi jīng' becomes 'běijīng'.

    The public list sometimes writes ü as "u:", so 'cè lu:è' also becomes 'cèlüè'.
    """
    s = s.replace("u:", "ü").replace("U:", "Ü")
    return unicodedata.normalize("NFC", s).lower().translate(_DROP)


def toneless(s):
    """norm() without tone marks, keeping ü. 'lǜ sè' becomes 'lüse'."""
    decomposed = unicodedata.normalize("NFD", norm(s))
    kept = "".join(c for c in decomposed if c not in _TONE_MARKS)
    return unicodedata.normalize("NFC", kept)
