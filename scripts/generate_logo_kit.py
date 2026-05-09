#!/usr/bin/env python3
"""Generate the AdaptArxiv logo kit.

Produces favicons, PWA icons, Apple icons, and OG/Twitter previews from the
canonical SVG glyph in src/app/icon.svg. Requires Pillow, cairosvg, fontTools
(with brotli) — all already available in the project's anaconda3 env.
"""
from __future__ import annotations

import io
from pathlib import Path

import cairosvg
from PIL import Image, ImageDraw, ImageFont
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parent.parent
APP_DIR = ROOT / "src" / "app"
PUBLIC_DIR = ROOT / "public"
FONT_WOFF2 = PUBLIC_DIR / "fonts" / "TRJN-DaVinci-Regular.woff2"

BRAND_LIGHT = "#C4C3B6"
BRAND_DARK = "#595855"
BG_BLACK = "#000000"

PATH_RING = (
    "M14.8796 1.18042C19.0513 1.18052 22.4778 2.64436 24.8611 5.15991C27.244 "
    "7.67513 28.5798 11.2368 28.5798 15.4255C28.5798 19.5914 27.2176 23.1909 "
    "24.822 25.7488C22.4261 28.3068 19.0001 29.82 14.8796 29.8201C10.7594 "
    "29.8201 7.33298 28.3104 4.93726 25.7585C2.54194 23.2071 1.18042 19.6171 "
    "1.18042 15.4617C1.18049 11.2624 2.50116 7.69136 4.87671 5.16968C7.25272 "
    "2.64753 10.6795 1.18042 14.8796 1.18042ZM14.8894 2.11694C11.7445 2.11694 "
    "9.18683 3.35239 7.41382 5.61987C5.63949 7.88911 4.64626 11.1979 4.64624 "
    "15.3513C4.64624 19.4709 5.61368 22.8546 7.37573 25.2068C9.13637 27.557 "
    "11.6941 28.8816 14.8894 28.8816C17.9713 28.8815 20.5365 27.5988 22.3328 "
    "25.283C24.1301 22.9656 25.1609 19.6097 25.1609 15.4617C25.1608 11.3994 "
    "24.1796 8.06269 22.407 5.74292C20.6356 3.42486 18.0704 2.11703 14.8894 "
    "2.11694Z"
)
PATH_LEFT = "M15 6.5 L10.0 24.0 L6.5 24.0 Z"
PATH_RIGHT = "M15 6.5 L23.5 24.0 L20.0 24.0 Z"
PATH_BAR = "M12.0 17.0 L18.0 17.0 L18.43 18.5 L11.57 18.5 Z"


def logo_svg(color: str) -> str:
    return (
        '<svg width="30" height="31" viewBox="0 0 30 31" '
        'xmlns="http://www.w3.org/2000/svg">\n'
        f'  <path d="{PATH_RING}" fill="{color}" stroke="{color}" '
        'stroke-width="0.12"/>\n'
        f'  <path d="{PATH_LEFT}" fill="{color}"/>\n'
        f'  <path d="{PATH_RIGHT}" fill="{color}"/>\n'
        f'  <path d="{PATH_BAR}" fill="{color}"/>\n'
        "</svg>"
    )


def raster_logo(color: str, width: int, height: int | None = None) -> Image.Image:
    h = height if height is not None else width
    png_bytes = cairosvg.svg2png(
        bytestring=logo_svg(color).encode("utf-8"),
        output_width=width,
        output_height=h,
    )
    return Image.open(io.BytesIO(png_bytes)).convert("RGBA")


def logo_on_black(color: str, size: int, scale: float) -> Image.Image:
    inner = round(size * scale)
    logo = raster_logo(color, inner)
    canvas = Image.new("RGBA", (size, size), BG_BLACK)
    offset = ((size - inner) // 2, (size - inner) // 2)
    canvas.paste(logo, offset, logo)
    return canvas


def load_pil_font(woff2_path: Path, size: int) -> ImageFont.FreeTypeFont:
    """WOFF2 → in-memory TTF → Pillow font (Pillow can't read WOFF2 directly)."""
    font = TTFont(str(woff2_path))
    font.flavor = None
    buf = io.BytesIO()
    font.save(buf)
    buf.seek(0)
    return ImageFont.truetype(buf, size=size)


def render_og() -> Image.Image:
    canvas = Image.new("RGBA", (1200, 630), BG_BLACK)
    logo = raster_logo(BRAND_LIGHT, 280, 289)
    canvas.paste(logo, (460, 140), logo)

    font = load_pil_font(FONT_WOFF2, 88)
    draw = ImageDraw.Draw(canvas)
    # anchor "ms": horizontal middle + baseline, so xy=(600, 510) sets
    # baseline at y=510 with text centered on x=600.
    draw.text((600, 510), "AdaptArxiv", font=font, fill=BRAND_LIGHT, anchor="ms")
    return canvas


def main() -> None:
    APP_DIR.mkdir(parents=True, exist_ok=True)
    PUBLIC_DIR.mkdir(parents=True, exist_ok=True)

    out: list[str] = []

    icon32 = raster_logo(BRAND_DARK, 32)
    icon32.save(APP_DIR / "icon.png", "PNG")
    out.append("src/app/icon.png (32x32)")

    # Render a high-quality 256 source for the ICO; Pillow downsamples to the
    # listed sub-image sizes when saving.
    ico_src = raster_logo(BRAND_DARK, 256)
    ico_src.save(
        APP_DIR / "favicon.ico",
        "ICO",
        sizes=[(16, 16), (32, 32), (48, 48)],
    )
    out.append("src/app/favicon.ico (16,32,48)")

    apple = logo_on_black(BRAND_LIGHT, 180, 0.64)
    apple.convert("RGB").save(APP_DIR / "apple-icon.png", "PNG")
    out.append("src/app/apple-icon.png (180x180, solid bg)")

    raster_logo(BRAND_DARK, 192).save(PUBLIC_DIR / "icon-192.png", "PNG")
    out.append("public/icon-192.png")
    raster_logo(BRAND_DARK, 512).save(PUBLIC_DIR / "icon-512.png", "PNG")
    out.append("public/icon-512.png")

    maskable = logo_on_black(BRAND_LIGHT, 512, 0.6)
    maskable.convert("RGB").save(PUBLIC_DIR / "icon-maskable-512.png", "PNG")
    out.append("public/icon-maskable-512.png")

    og = render_og().convert("RGB")
    og.save(APP_DIR / "opengraph-image.png", "PNG")
    out.append("src/app/opengraph-image.png (1200x630)")
    og.save(APP_DIR / "twitter-image.png", "PNG")
    out.append("src/app/twitter-image.png (1200x630)")

    print("logo kit generated:")
    for line in out:
        print(f"  - {line}")


if __name__ == "__main__":
    main()
