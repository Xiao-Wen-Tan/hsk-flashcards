"""Step 12. Copy Hanzi Writer and the stroke data of every headword character into docs/.

Inputs:  the pinned npm packages hanzi-writer 3.7.3 and hanzi-writer-data 2.0.1 (downloaded,
         checksum-checked), and the latest docs/data/words_vNNN.json (or --words PATH)
Outputs: docs/vendor/hanzi-writer-3.7.3.esm.js, docs/vendor/hanzi-writer-LICENSE.txt,
         docs/strokes/<code point>.json for each character, docs/strokes/ARPHICPL.TXT,
         data/reports/strokes_vNNN.txt
Before Plan 3 writes the words file, only the library is copied. Run it again after each new
words file: files already there are kept, and only new characters are added.
"""
import argparse
import sys
from pathlib import Path

from common import all_version_paths, next_version_path, read_json, write_new_text
from strokedata import HANZI_WRITER, HANZI_WRITER_DATA, download, han_chars, vendor


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--words", help="words file (default: the latest docs/data/words_vNNN.json)")
    args = parser.parse_args()
    if args.words:
        words_path = Path(args.words)
    else:
        found = all_version_paths("docs/data/words", ".json")
        words_path = found[-1][1] if found else None
    words = read_json(words_path)["words"] if words_path else []
    print(f"Words file: {words_path or 'none yet, so only the library is copied'}")
    writer_tgz = download(HANZI_WRITER)
    data_tgz = download(HANZI_WRITER_DATA) if words else b""
    tally = vendor("docs", words, writer_tgz, data_tgz)
    lines = [
        f"words file: {words_path or 'none'}",
        f"characters: {len(han_chars(words))}",
        f"files written: {tally['new']}, already present: {tally['same']}",
        f"characters without stroke data: {len(tally['missing'])} {''.join(tally['missing'])}",
    ]
    report = next_version_path("data/reports/strokes", ".txt")
    write_new_text(report, "\n".join(lines) + "\n")
    print("\n".join(lines))
    print(f"Report: {report}")
    return 1 if tally["missing"] else 0


if __name__ == "__main__":
    sys.exit(main())
