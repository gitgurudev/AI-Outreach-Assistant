#!/usr/bin/env python3
"""
create_icons.py — Generate the three PNG icons required by manifest.json.

Run once before loading the extension:
    python create_icons.py

No external packages needed — uses only Python stdlib.
"""

import os
import struct
import zlib


# LinkedIn blue
ICON_COLOR = (10, 102, 194)


def _chunk(tag: bytes, data: bytes) -> bytes:
    """Wrap data in a PNG chunk: length + tag + data + CRC."""
    body = tag + data
    return (
        struct.pack(">I", len(data))
        + body
        + struct.pack(">I", zlib.crc32(body) & 0xFFFFFFFF)
    )


def make_png(size: int, rgb: tuple) -> bytes:
    """Return a minimal valid PNG of given size filled with a solid RGB color."""
    r, g, b = rgb

    # IHDR: width, height, bit-depth=8, color-type=2 (RGB), compression=0, filter=0, interlace=0
    ihdr = _chunk(b"IHDR", struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0))

    # IDAT: one filter byte (0x00 = None) per row, then raw RGB pixels
    row  = bytes([r, g, b] * size)
    raw  = (b"\x00" + row) * size
    idat = _chunk(b"IDAT", zlib.compress(raw, level=9))

    iend = _chunk(b"IEND", b"")

    return b"\x89PNG\r\n\x1a\n" + ihdr + idat + iend


def main():
    os.makedirs("icons", exist_ok=True)
    for size in [16, 48, 128]:
        path = os.path.join("icons", f"icon{size}.png")
        with open(path, "wb") as fh:
            fh.write(make_png(size, ICON_COLOR))
        print(f"  Created {path}  ({size}×{size} px)")
    print("\nDone — icons/ folder is ready.")


if __name__ == "__main__":
    main()
