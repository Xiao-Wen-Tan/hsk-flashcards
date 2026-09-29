from wordids import assign_ids


def test_first_build_numbers_in_order():
    ids, new = assign_ids([("爱", "ai4"), ("八", "ba1")], [])
    assert ids == {("爱", "ai4"): "w0001", ("八", "ba1"): "w0002"}
    assert new == [{"id": "w0001", "hz": "爱", "pynum": "ai4"}, {"id": "w0002", "hz": "八", "pynum": "ba1"}]


def test_later_build_keeps_ids_and_only_appends():
    frozen = [{"id": "w0001", "hz": "爱", "pynum": "ai4"}, {"id": "w0002", "hz": "长", "pynum": "chang2"}]
    ids, new = assign_ids([("长", "zhang3"), ("爱", "ai4")], frozen)
    assert ids == {("长", "zhang3"): "w0003", ("爱", "ai4"): "w0001"}
    assert new == [{"id": "w0003", "hz": "长", "pynum": "zhang3"}]
