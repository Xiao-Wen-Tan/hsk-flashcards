"""Permanent word IDs.

Every card keeps its ID ("w0001") for ever, because the app stores progress by ID.
The IDs live in data/ids/word_ids_vNNN.csv (id, hz, pynum), which is committed to git.
A later build reuses every ID in the latest file and only appends new ones; an ID is
never reused, even when its word leaves the list. The key is the headword plus its
numbered reading in dictionary tones, so 长 chang2 and 长 zhang3 have different IDs.
"""


def assign_ids(keys, frozen):
    """IDs for `keys`, a list of (hz, pynum) in the order new IDs should be handed out.

    frozen: rows {"id", "hz", "pynum"} from the latest IDs file (empty on the first build).
    Returns (ids, new_rows), where ids maps every key to its ID and new_rows are the rows to append.
    With frozen [{"id": "w0001", "hz": "爱", "pynum": "ai4"}] and keys [("八", "ba1"), ("爱", "ai4")],
    爱 keeps w0001 and 八 gets w0002.
    """
    known = {(r["hz"], r["pynum"]): r["id"] for r in frozen}
    top = max((int(r["id"][1:]) for r in frozen), default=0)
    ids, new_rows = {}, []
    for key in keys:
        if key not in known:
            top += 1
            known[key] = f"w{top:04d}"
            new_rows.append({"id": known[key], "hz": key[0], "pynum": key[1]})
        ids[key] = known[key]
    return ids, new_rows
