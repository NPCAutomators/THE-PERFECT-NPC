#!/usr/bin/env python3
"""Generate deterministic raster assets for the ZORIN hard fork.

The upstream artwork encoded the former product identity even after filenames
were renamed.  These assets use only geometric shapes and bundled system fonts
so the fork's visual identity can be reproduced without external services.
"""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
FONT_BOLD = Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf")
FONT_MONO = Path("/usr/share/fonts/truetype/dejavu/DejaVuSansMono-Bold.ttf")

INK = (8, 16, 27)
PANEL = (15, 29, 45)
CYAN = (92, 218, 255)
GOLD = (255, 193, 49)
ORANGE = (238, 123, 43)
WHITE = (239, 248, 255)


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def regular_polygon(cx: float, cy: float, radius: float, sides: int, rotation: float = 0) -> list[tuple[float, float]]:
    return [
        (
            cx + radius * math.cos(rotation + 2 * math.pi * index / sides),
            cy + radius * math.sin(rotation + 2 * math.pi * index / sides),
        )
        for index in range(sides)
    ]


def draw_z_mark(draw: ImageDraw.ImageDraw, box: tuple[int, int, int, int], *, fill=WHITE, stroke=INK) -> None:
    x0, y0, x1, y1 = box
    size = max(12, int((y1 - y0) * 0.76))
    face = font(FONT_BOLD, size)
    bounds = draw.textbbox((0, 0), "Z", font=face, stroke_width=max(1, size // 32))
    width = bounds[2] - bounds[0]
    height = bounds[3] - bounds[1]
    x = (x0 + x1 - width) / 2 - bounds[0]
    y = (y0 + y1 - height) / 2 - bounds[1]
    draw.text((x, y), "Z", font=face, fill=fill, stroke_width=max(1, size // 32), stroke_fill=stroke)


def brand_badge(size: int, *, transparent: bool) -> Image.Image:
    mode = "RGBA" if transparent else "RGB"
    background = (0, 0, 0, 0) if transparent else INK
    image = Image.new(mode, (size, size), background)
    draw = ImageDraw.Draw(image)
    pad = max(5, size // 18)
    draw.rounded_rectangle((pad, pad, size - pad, size - pad), radius=size // 5, fill=PANEL + ((255,) if transparent else ()))
    cx = cy = size / 2
    outer = regular_polygon(cx, cy, size * 0.36, 6, math.pi / 6)
    inner = regular_polygon(cx, cy, size * 0.29, 6, math.pi / 6)
    draw.line(outer + [outer[0]], fill=CYAN, width=max(2, size // 28), joint="curve")
    draw.line(inner + [inner[0]], fill=GOLD, width=max(2, size // 45), joint="curve")
    draw_z_mark(draw, (int(size * 0.28), int(size * 0.22), int(size * 0.72), int(size * 0.78)))
    for angle in (0, math.pi / 2, math.pi, math.pi * 1.5):
        x = cx + math.cos(angle) * size * 0.41
        y = cy + math.sin(angle) * size * 0.41
        radius = max(2, size // 38)
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=ORANGE)
    return image


def save_banner() -> None:
    width, height = 1145, 196
    image = Image.new("RGB", (width, height), INK)
    draw = ImageDraw.Draw(image)
    for x in range(0, width, 28):
        draw.line((x, 0, x, height), fill=(12, 25, 39), width=1)
    for y in range(0, height, 28):
        draw.line((0, y, width, y), fill=(12, 25, 39), width=1)
    face = font(FONT_BOLD, 132)
    label = "ZORIN"
    bounds = draw.textbbox((0, 0), label, font=face, stroke_width=4)
    text_width = bounds[2] - bounds[0]
    text_height = bounds[3] - bounds[1]
    x = (width - text_width) // 2 - bounds[0]
    y = (height - text_height) // 2 - bounds[1] - 3
    draw.text((x + 8, y + 9), label, font=face, fill=(0, 0, 0), stroke_width=5, stroke_fill=(0, 0, 0))
    draw.text((x, y), label, font=face, fill=GOLD, stroke_width=5, stroke_fill=ORANGE)
    tagline = "AUTONOMOUS  •  LOCAL  •  YOURS"
    small = font(FONT_MONO, 19)
    small_width = draw.textbbox((0, 0), tagline, font=small)[2]
    draw.text(((width - small_width) // 2, height - 27), tagline, font=small, fill=CYAN)
    for relative in (
        "assets/banner.png",
        "website/static/img/zorin-agent-banner.png",
    ):
        image.save(ROOT / relative, optimize=True)


def save_logos() -> None:
    badge = brand_badge(150, transparent=True)
    badge.save(ROOT / "website/static/img/npcautomators-logo.png", optimize=True)

    mark = brand_badge(256, transparent=False)
    mark_draw = ImageDraw.Draw(mark)
    caption = "NPC"
    face = font(FONT_MONO, 22)
    width = mark_draw.textbbox((0, 0), caption, font=face)[2]
    mark_draw.text(((256 - width) // 2, 222), caption, font=face, fill=CYAN)
    for relative in (
        "apps/desktop/public/npcautomators-mark.jpg",
        "apps/bootstrap-installer/public/npcautomators-mark.jpg",
    ):
        mark.save(ROOT / relative, quality=95, subsampling=0)


def draw_agent_frame(size: tuple[int, int], phase: int, *, transparent: bool = True) -> Image.Image:
    width, height = size
    image = Image.new("RGBA", size, (0, 0, 0, 0) if transparent else INK + (255,))
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    cx, cy = width / 2, height / 2
    radius = min(width, height) * 0.33
    glow_draw.ellipse((cx - radius, cy - radius, cx + radius, cy + radius), fill=CYAN + (75,))
    glow = glow.filter(ImageFilter.GaussianBlur(max(4, int(radius * 0.16))))
    image.alpha_composite(glow)
    draw = ImageDraw.Draw(image)
    ring_radius = radius * 1.08
    draw.ellipse((cx - ring_radius, cy - ring_radius, cx + ring_radius, cy + ring_radius), outline=CYAN + (210,), width=max(3, width // 100))
    body = regular_polygon(cx, cy, radius * 0.9, 6, math.pi / 6)
    draw.polygon(body, fill=PANEL + (255,), outline=GOLD + (255,))
    inner = regular_polygon(cx, cy, radius * 0.72, 6, math.pi / 6)
    draw.line(inner + [inner[0]], fill=ORANGE + (255,), width=max(3, width // 90), joint="curve")
    draw_z_mark(draw, (int(cx - radius * 0.43), int(cy - radius * 0.55), int(cx + radius * 0.43), int(cy + radius * 0.52)))
    angle = phase * math.pi / 4 - math.pi / 2
    dot_x = cx + math.cos(angle) * ring_radius
    dot_y = cy + math.sin(angle) * ring_radius
    dot_radius = max(7, width // 45)
    draw.ellipse((dot_x - dot_radius, dot_y - dot_radius, dot_x + dot_radius, dot_y + dot_radius), fill=GOLD + (255,), outline=WHITE + (255,), width=2)
    return image


def save_agent_art() -> None:
    main = draw_agent_frame((1254, 1254), 0)
    main.save(ROOT / "apps/desktop/public/zorin.png", optimize=True)

    frames = [draw_agent_frame((560, 500), phase) for phase in range(8)]
    frame_root = ROOT / "apps/desktop/public/zorin-frames"
    frame_root.mkdir(parents=True, exist_ok=True)
    for phase, frame in enumerate(frames):
        frame.save(frame_root / f"zorin-frame-{phase}.png", optimize=True)

    sprite = Image.new("RGBA", (1536, 1024), (0, 0, 0, 0))
    for index in range(6):
        cell = draw_agent_frame((512, 512), index)
        sprite.alpha_composite(cell, ((index % 3) * 512, (index // 3) * 512))
    sprite.save(ROOT / "apps/desktop/public/zorin-sprite.png", optimize=True)


def main() -> None:
    save_banner()
    save_logos()
    save_agent_art()
    print("Generated ZORIN banner, logos, avatar, sprite, and animation frames.")


if __name__ == "__main__":
    main()
