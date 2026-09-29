"""Step 13. Draw the home-screen icons that the web app manifest names.

Outputs: docs/icons/icon-192.png, docs/icons/icon-512.png (rounded red square with "HSK"),
         docs/icons/icon-maskable-512.png (full red square, text inside the central safe area)
Uses Pillow's built-in font, so no font file is needed. Existing icons are never replaced:
the script stops and names them. To change the icons, delete them yourself first.
"""
import sys
from io import BytesIO
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

RED, WHITE = (179, 38, 30, 255), (255, 255, 255, 255)
OUT = Path("docs/icons")


def draw(size, maskable):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if maskable:
        d.rectangle([0, 0, size, size], fill=RED)
        text_width = size * 0.5  # Android may crop the outer 10% on each side
    else:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=size // 5, fill=RED)
        text_width = size * 0.7
    font_size = size // 2
    font = ImageFont.load_default(size=font_size)
    while d.textlength("HSK", font=font) > text_width:
        font_size -= 2
        font = ImageFont.load_default(size=font_size)
    d.text((size / 2, size / 2), "HSK", font=font, fill=WHITE, anchor="mm")
    buf = BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def main():
    plan = {"icon-192.png": (192, False), "icon-512.png": (512, False), "icon-maskable-512.png": (512, True)}
    present = [name for name in plan if (OUT / name).exists()]
    if present:
        print(f"Icons already exist and are never replaced: {', '.join(present)}")
        return 1
    OUT.mkdir(parents=True, exist_ok=True)
    for name, (size, maskable) in plan.items():
        with open(OUT / name, "xb") as f:
            f.write(draw(size, maskable))
        print(f"Wrote {OUT / name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
