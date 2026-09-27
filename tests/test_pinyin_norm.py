from pinyin_norm import norm, toneless


def test_norm_removes_spaces_apostrophes_and_case():
    assert norm("Běi jīng") == "běijīng"
    assert norm("duì bu qǐ") == "duìbuqǐ"
    assert norm("nǚ'ér") == "nǚér"
    assert norm("I’m sorry") == "imsorry"


def test_toneless_keeps_u_umlaut():
    assert toneless("Běijīng") == "beijing"
    assert toneless("lǜ sè") == "lüse"
    assert toneless("nǚ'ér") == "nüer"


def test_u_colon_spelling_means_u_umlaut():
    assert norm("cè lu:è") == norm("cè lüè") == "cèlüè"
    assert toneless("lu:è") == "lüe"
    assert norm("NU:È") == "nüè"
