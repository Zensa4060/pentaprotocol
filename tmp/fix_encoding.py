"""Reverse a UTF-8 → cp1252 → UTF-8 mojibake round-trip on a file."""
import io
import sys

path = sys.argv[1]
s = io.open(path, encoding="utf-8").read()
# PS 5.1's `-Encoding utf8` prepends a BOM — drop it (and any stray ZWNBSP).
s = s.replace("﻿", "")

out = bytearray()
for ch in s:
    try:
        out += ch.encode("cp1252")
    except UnicodeEncodeError:
        cp = ord(ch)
        if cp < 0x100:
            out.append(cp)
        else:
            print(f"unmappable char U+{cp:04X} — aborting without changes")
            sys.exit(1)

try:
    fixed = out.decode("utf-8")
except UnicodeDecodeError as e:
    print(f"decode failed: {e} — aborting without changes")
    sys.exit(1)

io.open(path, "w", encoding="utf-8", newline="").write(fixed)
print("fixed", path, "| mojibake remaining:", "â€" in fixed)
