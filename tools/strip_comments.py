#!/usr/bin/env python3
"""Strip comments from source files. Code documents itself; names carry the meaning.

Kept: lines whose comment begins with `ponytail:`. Those record a deliberate shortcut and
the ceiling it has, and `/ponytail-debt` reads them as a ledger. One line each — a
continuation line is not kept, so an entry that needs two lines is an entry that has not
been said crisply enough.

Never touched: lang/*.txt (instructions written for translators, not code), Markdown,
XML, and anything under bin/ or obj/.

    python tools/strip_comments.py [path ...]     strip in place, print what changed
    python tools/strip_comments.py --check [path] exit 1 if anything would change
    python tools/strip_comments.py --selftest     run the parser's own checks
"""

import argparse
import pathlib
import sys

KEEP = "ponytail:"
SKIP_DIRS = {"bin", "obj", ".git", "node_modules", "packages"}


def strip_csharp(text, overflow=None):
    """Remove // and /* */ comments, leaving string and char literals untouched."""
    overflow = overflow if overflow is not None else []
    out = []
    i = 0
    n = len(text)
    while i < n:
        c = text[i]
        nxt = text[i + 1] if i + 1 < n else ""

        if c == '"' or (c == "@" and nxt == '"') or (c == "$" and nxt == '"') \
                or (c == "$" and nxt == "@" and text[i + 2:i + 3] == '"') \
                or (c == "@" and nxt == "$" and text[i + 2:i + 3] == '"'):
            verbatim = "@" in text[i:i + 2]
            while text[i] != '"':
                out.append(text[i])
                i += 1
            out.append(text[i])
            i += 1
            while i < n:
                if verbatim:
                    if text[i] == '"' and text[i + 1:i + 2] == '"':
                        out.append(text[i:i + 2])
                        i += 2
                        continue
                    if text[i] == '"':
                        break
                else:
                    if text[i] == "\\":
                        out.append(text[i:i + 2])
                        i += 2
                        continue
                    if text[i] == '"' or text[i] == "\n":
                        break
                out.append(text[i])
                i += 1
            if i < n:
                out.append(text[i])
                i += 1
            continue

        if c == "'":
            out.append(c)
            i += 1
            while i < n and text[i] != "'":
                if text[i] == "\\":
                    out.append(text[i:i + 2])
                    i += 2
                    continue
                out.append(text[i])
                i += 1
            if i < n:
                out.append(text[i])
                i += 1
            continue

        if c == "/" and nxt == "/":
            end = text.find("\n", i)
            end = n if end < 0 else end
            body = text[i + 2:end].strip().lstrip("/").strip()
            if body.startswith(KEEP):
                out.append(text[i:end])
                if text[end + 1:].lstrip().startswith("//"):
                    overflow.append(body[:60])
            i = end
            continue

        if c == "/" and nxt == "*":
            end = text.find("*/", i + 2)
            i = n if end < 0 else end + 2
            continue

        out.append(c)
        i += 1

    return "".join(out)


def strip_python(text):
    """Remove # comments. Docstrings are left to the caller's judgement, not guessed at."""
    out = []
    for line in text.splitlines(keepends=True):
        stripped = line.lstrip()
        if stripped.startswith("#") and not stripped[1:].strip().startswith(KEEP):
            continue
        out.append(line)
    return "".join(out)


def spans_lines(text):
    """True when a verbatim string literal runs across a newline: tidy must not touch it."""
    i = 0
    while i < len(text):
        if text[i] == "@" and text[i + 1:i + 2] == '"':
            end = i + 2
            while end < len(text):
                if text[end] == '"' and text[end + 1:end + 2] == '"':
                    end += 2
                    continue
                if text[end] == '"':
                    break
                end += 1
            if chr(10) in text[i:end]:
                return True
            i = end + 1
            continue
        i += 1
    return False


def tidy(text):
    """Drop the whitespace a removed comment leaves: trailing spaces, and runs of blanks."""
    lines = [line.rstrip() for line in text.split("\n")]
    kept = []
    for line in lines:
        after = kept[-1] if kept else None
        if line == "" and after is not None and (
                after == "" or after.endswith(("{", "[")) or after.lstrip().startswith("//")):
            continue
        kept.append(line)
    while kept and kept[0] == "":
        kept.pop(0)
    return "\n".join(kept).rstrip() + "\n"


STRIPPERS = {".cs": strip_csharp, ".py": strip_python}


def sources(roots):
    for root in roots:
        root = pathlib.Path(root)
        candidates = [root] if root.is_file() else sorted(root.rglob("*"))
        for path in candidates:
            if path.suffix not in STRIPPERS or not path.is_file():
                continue
            if any(part in SKIP_DIRS for part in path.parts):
                continue
            if path.name == pathlib.Path(__file__).name:
                continue
            yield path


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("paths", nargs="*", default=["."])
    parser.add_argument("--check", action="store_true", help="report, change nothing")
    parser.add_argument("--selftest", action="store_true")
    args = parser.parse_args()

    if args.selftest:
        return selftest()

    changed = []
    spilled = []
    for path in sources(args.paths or ["."]):
        original = path.read_text(encoding="utf-8")
        overflow = []
        bare = STRIPPERS[path.suffix](original, overflow) if path.suffix == ".cs" \
            else STRIPPERS[path.suffix](original)
        for entry in overflow:
            print(f"{path}: ponytail entry runs past one line: {entry}...", file=sys.stderr)
            spilled.append(path)
        stripped = bare if spans_lines(bare) else tidy(bare)
        if stripped != original:
            changed.append(path)
            if not args.check:
                path.write_text(stripped, encoding="utf-8", newline="")
    for path in changed:
        print(path)
    if spilled:
        print(f"{len(spilled)} ponytail entr(ies) lost a continuation line", file=sys.stderr)
        return 1
    if args.check and changed:
        print(f"{len(changed)} file(s) still carry comments", file=sys.stderr)
        return 1
    print(f"{len(changed)} file(s) changed" if not args.check else "clean")
    return 0


def selftest():
    cases = [
        ("a(); // gone", "a();"),
        ("a(); /* gone */ b();", "a();  b();"),
        ("/// <summary>gone</summary>\na();", "a();"),
        ("// ponytail: kept, and why\na();", "// ponytail: kept, and why\na();"),
        ('var s = "http://not.a.comment";', 'var s = "http://not.a.comment";'),
        ('var s = @"C:\\p // not a comment";', 'var s = @"C:\\p // not a comment";'),
        ('var s = @"he said ""hi // there""";', 'var s = @"he said ""hi // there""";'),
        ('var s = $"{a}//b";', 'var s = $"{a}//b";'),
        ("var c = '/'; // gone", "var c = '/';"),
        ("var c = '\\''; // gone", "var c = '\\'';"),
        ('var s = "escaped \\" // still string";', 'var s = "escaped \\" // still string";'),
        ("a(); /* multi\nline */ b();", "a();  b();"),
        ("var s = \"/* not a block */\";", "var s = \"/* not a block */\";"),
        ("int x = 6 / 2; // gone", "int x = 6 / 2;"),
        ("// ponytail: one line\na();", "// ponytail: one line\na();"),
        ("// ponytail: kept\n// a continuation is not\na();", "// ponytail: kept\na();"),
        ('var s = @"open {\n\ninside";\n', 'var s = @"open {\n\ninside";\n'),
    ]
    bad = 0
    for source, want in cases:
        bare = strip_csharp(source)
        got = bare if spans_lines(bare) else tidy(bare)
        if got != want.rstrip() + "\n":
            bad += 1
            print(f"FAIL  {source!r}\n  got  {got!r}\n  want {want!r}")
    print("selftest: all green" if not bad else f"selftest: {bad} failed")
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main())
