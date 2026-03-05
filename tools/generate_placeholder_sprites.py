#!/usr/bin/env python3
"""
Generate placeholder sprite sheets for PixelAgent characters.

Outputs:
  1. Indoor (top-down) sprite sheets — 112×96, 7 cols × 3 rows, 16×32 per frame
     - Row 0: DOWN, Row 1: UP, Row 2: RIGHT (LEFT = flip)
     - Cols 0-3: walk frames, Col 1: idle
  2. Outdoor (isometric) sprite sheets — 64×192, 4 cols × 8 rows, 16×24 per frame
     - Rows: S, SW, W, NW, N, NE, E, SE
     - Cols 0-3: walk frames

Usage:
  python3 tools/generate_placeholder_sprites.py [--output-dir frontend/public/assets]
"""

import argparse
import os
from PIL import Image, ImageDraw


# ── Character Colors ──────────────────────────────────────────────────

CHARACTERS = {
    "gaia": {
        "body":  (80, 180, 120),   # green
        "hair":  (60, 140, 90),    # darker green
        "skin":  (255, 220, 185),  # peach
        "eye":   (40, 40, 40),     # dark
        "shirt": (80, 180, 120),   # green
        "pants": (60, 90, 60),     # dark green
        "shoes": (80, 60, 40),     # brown
    },
    "astraea": {
        "body":  (120, 100, 200),  # purple
        "hair":  (90, 70, 160),    # darker purple
        "skin":  (255, 220, 185),  # peach
        "eye":   (40, 40, 40),     # dark
        "shirt": (120, 100, 200),  # purple
        "pants": (70, 50, 120),    # dark purple
        "shoes": (80, 60, 40),     # brown
    },
}

# ── Indoor Sprite (16×32, top-down) ─────────────────────────────────

INDOOR_FW = 16
INDOOR_FH = 32
INDOOR_COLS = 7
INDOOR_ROWS = 3  # DOWN=0, UP=1, RIGHT=2
INDOOR_DIR_NAMES = ["DOWN", "UP", "RIGHT"]

# Arrow directions for each row (dx, dy pixel offsets for a small arrow)
INDOOR_ARROWS = {
    "DOWN":  (0, 1),
    "UP":    (0, -1),
    "RIGHT": (1, 0),
}


def draw_indoor_frame(img: Image.Image, x0: int, y0: int,
                       colors: dict, direction: str, walk_phase: int):
    """Draw a single 16×32 top-down character frame."""
    d = ImageDraw.Draw(img)
    cx = x0 + 8  # center x
    skin = colors["skin"]
    hair = colors["hair"]
    shirt = colors["shirt"]
    pants = colors["pants"]
    shoes = colors["shoes"]
    eye = colors["eye"]

    # ── Head (rows 2-9) ──
    # Hair top
    d.rectangle([cx - 4, y0 + 2, cx + 3, y0 + 5], fill=hair)
    # Face
    d.rectangle([cx - 3, y0 + 5, cx + 2, y0 + 9], fill=skin)

    # Eyes (direction-dependent)
    if direction == "DOWN":
        d.point([(cx - 2, y0 + 6), (cx + 1, y0 + 6)], fill=eye)
    elif direction == "UP":
        # Back of head, no eyes
        d.rectangle([cx - 3, y0 + 5, cx + 2, y0 + 9], fill=hair)
    else:  # RIGHT
        d.point([(cx + 1, y0 + 6)], fill=eye)

    # ── Body / Shirt (rows 10-19) ──
    d.rectangle([cx - 4, y0 + 10, cx + 3, y0 + 19], fill=shirt)

    # Arms with walk animation
    arm_offset = [-1, 0, 1, 0][walk_phase]
    # Left arm
    d.rectangle([cx - 5, y0 + 11 + arm_offset, cx - 5, y0 + 16 + arm_offset], fill=skin)
    # Right arm
    d.rectangle([cx + 4, y0 + 11 - arm_offset, cx + 4, y0 + 16 - arm_offset], fill=skin)

    # ── Pants (rows 20-25) ──
    d.rectangle([cx - 3, y0 + 20, cx + 2, y0 + 25], fill=pants)

    # Legs with walk animation
    leg_offset = [-1, 0, 1, 0][walk_phase]
    # Left leg
    d.rectangle([cx - 3, y0 + 23, cx - 1, y0 + 27 + leg_offset], fill=pants)
    # Right leg
    d.rectangle([cx, y0 + 23, cx + 2, y0 + 27 - leg_offset], fill=pants)

    # ── Shoes ──
    d.rectangle([cx - 3, y0 + 28 + leg_offset, cx - 1, y0 + 29 + leg_offset], fill=shoes)
    d.rectangle([cx, y0 + 28 - leg_offset, cx + 2, y0 + 29 - leg_offset], fill=shoes)

    # ── Direction arrow (tiny, at bottom) ──
    arrow = INDOOR_ARROWS[direction]
    ax, ay = cx + arrow[0] * 3, y0 + 31
    d.point([(ax, ay)], fill=(255, 255, 0))


def generate_indoor_sheet(name: str, colors: dict) -> Image.Image:
    """Generate 112×96 indoor sprite sheet."""
    w = INDOOR_FW * INDOOR_COLS  # 112
    h = INDOOR_FH * INDOOR_ROWS  # 96
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    for row_idx, direction in enumerate(INDOOR_DIR_NAMES):
        for col in range(INDOOR_COLS):
            walk_phase = col % 4
            x0 = col * INDOOR_FW
            y0 = row_idx * INDOOR_FH
            draw_indoor_frame(img, x0, y0, colors, direction, walk_phase)

    return img


# ── Isometric Sprite (16×24, 8-direction) ───────────────────────────

ISO_FW = 16
ISO_FH = 24
ISO_COLS = 4  # walk frames
ISO_ROWS = 8  # directions

# Direction order: S, SW, W, NW, N, NE, E, SE
ISO_DIR_NAMES = ["S", "SW", "W", "NW", "N", "NE", "E", "SE"]

# Body tilt offsets for isometric feel (dx applied to torso)
ISO_BODY_DX = {
    "S":  0, "SW": -1, "W": -1, "NW": -1,
    "N":  0, "NE":  1, "E":  1, "SE":  1,
}

# Facing direction for eye placement
ISO_FACE = {
    "S":  "front", "SW": "left",  "W":  "left",  "NW": "left",
    "N":  "back",  "NE": "right", "E":  "right", "SE": "right",
}

# Arrow vectors (small indicator)
ISO_ARROW_VEC = {
    "S":  ( 0,  1), "SW": (-1,  1), "W":  (-1,  0), "NW": (-1, -1),
    "N":  ( 0, -1), "NE": ( 1, -1), "E":  ( 1,  0), "SE": ( 1,  1),
}


def draw_iso_frame(img: Image.Image, x0: int, y0: int,
                    colors: dict, direction: str, walk_phase: int):
    """Draw a single 16×24 isometric character frame (chibi)."""
    d = ImageDraw.Draw(img)
    cx = x0 + 8
    body_dx = ISO_BODY_DX[direction]
    face = ISO_FACE[direction]
    skin = colors["skin"]
    hair = colors["hair"]
    shirt = colors["shirt"]
    pants = colors["pants"]
    shoes = colors["shoes"]
    eye = colors["eye"]

    # ── Head (rows 1-7) — larger for chibi ──
    d.rectangle([cx - 4, y0 + 1, cx + 3, y0 + 3], fill=hair)
    d.rectangle([cx - 4, y0 + 3, cx + 3, y0 + 7], fill=skin)

    # Hair overlay for back view
    if face == "back":
        d.rectangle([cx - 4, y0 + 3, cx + 3, y0 + 7], fill=hair)

    # Eyes
    if face == "front":
        d.point([(cx - 2, y0 + 5), (cx + 1, y0 + 5)], fill=eye)
    elif face == "left":
        d.point([(cx - 3, y0 + 5)], fill=eye)
    elif face == "right":
        d.point([(cx + 2, y0 + 5)], fill=eye)

    # ── Body / Shirt (rows 8-14) ──
    bx = cx + body_dx
    d.rectangle([bx - 3, y0 + 8, bx + 2, y0 + 14], fill=shirt)

    # Arms (with walk swing)
    arm_swing = [-1, 0, 1, 0][walk_phase]
    d.rectangle([bx - 4, y0 + 9 + arm_swing, bx - 4, y0 + 13 + arm_swing], fill=skin)
    d.rectangle([bx + 3, y0 + 9 - arm_swing, bx + 3, y0 + 13 - arm_swing], fill=skin)

    # ── Pants (rows 15-18) ──
    d.rectangle([bx - 2, y0 + 15, bx + 1, y0 + 18], fill=pants)

    # Legs (with walk animation)
    leg_swing = [-1, 0, 1, 0][walk_phase]
    d.rectangle([bx - 2, y0 + 17, bx - 1, y0 + 20 + leg_swing], fill=pants)
    d.rectangle([bx, y0 + 17, bx + 1, y0 + 20 - leg_swing], fill=pants)

    # ── Shoes ──
    d.rectangle([bx - 2, y0 + 21 + leg_swing, bx - 1, y0 + 22 + leg_swing], fill=shoes)
    d.rectangle([bx, y0 + 21 - leg_swing, bx + 1, y0 + 22 - leg_swing], fill=shoes)

    # ── Direction arrow (colored dot at top) ──
    av = ISO_ARROW_VEC[direction]
    ax = cx + av[0] * 3
    ay = y0 + max(0, av[1])
    d.point([(ax, ay)], fill=(255, 255, 0))


def generate_iso_sheet(name: str, colors: dict) -> Image.Image:
    """Generate 64×192 isometric sprite sheet."""
    w = ISO_FW * ISO_COLS   # 64
    h = ISO_FH * ISO_ROWS   # 192
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))

    for row_idx, direction in enumerate(ISO_DIR_NAMES):
        for col in range(ISO_COLS):
            x0 = col * ISO_FW
            y0 = row_idx * ISO_FH
            draw_iso_frame(img, x0, y0, colors, direction, col)

    return img


# ── Isometric Tile Placeholders ─────────────────────────────────────

ISO_TILE_W = 64
ISO_TILE_H = 32


def draw_diamond(d: ImageDraw.Draw, x0: int, y0: int,
                 w: int, h: int, fill_color, outline_color):
    """Draw a diamond (isometric tile) shape."""
    cx = x0 + w // 2
    cy = y0 + h // 2
    points = [
        (cx, y0),          # top
        (x0 + w, cy),      # right
        (cx, y0 + h),      # bottom
        (x0, cy),          # left
    ]
    d.polygon(points, fill=fill_color, outline=outline_color)


def generate_iso_tile(name: str, fill: tuple, outline: tuple) -> Image.Image:
    """Generate a 64×32 isometric diamond tile."""
    img = Image.new("RGBA", (ISO_TILE_W, ISO_TILE_H), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    draw_diamond(d, 0, 0, ISO_TILE_W, ISO_TILE_H, fill, outline)
    return img


def generate_iso_building(name: str, tile_w: int, tile_h: int,
                           base_color: tuple, roof_color: tuple,
                           height: int = 48) -> Image.Image:
    """Generate a placeholder isometric building sprite."""
    w = tile_w
    h = tile_h + height
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Building body (rectangle)
    body_top = height // 3
    d.rectangle([w // 4, body_top, 3 * w // 4, h - tile_h // 2],
                fill=base_color, outline=(40, 40, 40))

    # Roof (diamond on top)
    draw_diamond(d, 0, 0, w, tile_h, roof_color, (40, 40, 40))

    # Label
    try:
        d.text((w // 2 - len(name) * 3, h // 2), name[:6],
               fill=(255, 255, 255))
    except Exception:
        pass

    return img


# ── Main ────────────────────────────────────────────────────────────

TILE_DEFS = {
    "iso_grass":  ((100, 180, 80),  (80, 150, 60)),
    "iso_dirt":   ((160, 130, 90),  (130, 100, 70)),
    "iso_water":  ((70, 130, 200),  (50, 100, 170)),
    "iso_path":   ((190, 170, 140), (160, 140, 110)),
}

BUILDING_DEFS = {
    "greenhouse":      (64, 32, (180, 220, 180), (100, 200, 100), 48),
    "weather_station": (64, 32, (180, 180, 200), (100, 100, 180), 56),
    "cabin":           (64, 32, (160, 120, 80),  (120, 80, 50),   52),
}


def main():
    parser = argparse.ArgumentParser(description="Generate placeholder sprite sheets")
    parser.add_argument("--output-dir", default="frontend/public/assets",
                        help="Output base directory (default: frontend/public/assets)")
    args = parser.parse_args()

    base = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                        args.output_dir)

    chars_dir = os.path.join(base, "characters")
    outdoor_dir = os.path.join(base, "outdoor")
    os.makedirs(chars_dir, exist_ok=True)
    os.makedirs(outdoor_dir, exist_ok=True)

    # ── Character Sprite Sheets ──
    for name, colors in CHARACTERS.items():
        # Indoor (top-down) — save as *_placeholder.png to not overwrite originals
        indoor = generate_indoor_sheet(name, colors)
        indoor_path = os.path.join(chars_dir, f"{name}_placeholder.png")
        indoor.save(indoor_path)
        print(f"  [indoor]  {indoor_path}  ({indoor.size[0]}×{indoor.size[1]})")

        # Isometric (8-dir)
        iso = generate_iso_sheet(name, colors)
        iso_path = os.path.join(chars_dir, f"{name}_iso.png")
        iso.save(iso_path)
        print(f"  [iso]     {iso_path}  ({iso.size[0]}×{iso.size[1]})")

    # ── Isometric Ground Tiles ──
    for tile_name, (fill, outline) in TILE_DEFS.items():
        tile = generate_iso_tile(tile_name, fill, outline)
        tile_path = os.path.join(outdoor_dir, f"{tile_name}.png")
        tile.save(tile_path)
        print(f"  [tile]    {tile_path}  ({tile.size[0]}×{tile.size[1]})")

    # ── Isometric Buildings ──
    for bld_name, (tw, th, base_c, roof_c, h) in BUILDING_DEFS.items():
        bld = generate_iso_building(bld_name, tw, th, base_c, roof_c, h)
        bld_path = os.path.join(outdoor_dir, f"{bld_name}.png")
        bld.save(bld_path)
        print(f"  [build]   {bld_path}  ({bld.size[0]}×{bld.size[1]})")

    # ── Vegetation placeholders ──
    veg_defs = {
        "tree_1": ((60, 120, 40), 32, 48),
        "tree_2": ((50, 140, 50), 32, 52),
        "bush":   ((80, 160, 60), 24, 20),
    }
    for veg_name, (color, vw, vh) in veg_defs.items():
        vimg = Image.new("RGBA", (vw, vh), (0, 0, 0, 0))
        vd = ImageDraw.Draw(vimg)
        # Tree = ellipse crown + rectangle trunk
        if "tree" in veg_name:
            trunk_c = (100, 70, 40)
            vd.rectangle([vw // 2 - 2, vh // 2, vw // 2 + 2, vh - 1], fill=trunk_c)
            vd.ellipse([2, 2, vw - 3, vh // 2 + 4], fill=color, outline=(40, 80, 30))
        else:
            vd.ellipse([2, 2, vw - 3, vh - 3], fill=color, outline=(40, 80, 30))
        veg_path = os.path.join(outdoor_dir, f"{veg_name}.png")
        vimg.save(veg_path)
        print(f"  [veg]     {veg_path}  ({vimg.size[0]}×{vimg.size[1]})")

    # ── Crop plot placeholders ──
    for stage in ["empty", "growing", "ready"]:
        cp = Image.new("RGBA", (ISO_TILE_W, ISO_TILE_H), (0, 0, 0, 0))
        cpd = ImageDraw.Draw(cp)
        draw_diamond(cpd, 0, 0, ISO_TILE_W, ISO_TILE_H,
                     (140, 110, 70), (100, 80, 50))
        if stage == "growing":
            # Small green dots
            for dx in range(-8, 9, 8):
                cpd.rectangle([32 + dx - 1, 14, 32 + dx + 1, 18],
                              fill=(80, 180, 60))
        elif stage == "ready":
            # Taller plants
            for dx in range(-8, 9, 8):
                cpd.rectangle([32 + dx - 1, 8, 32 + dx + 1, 18],
                              fill=(60, 160, 40))
                cpd.ellipse([32 + dx - 2, 6, 32 + dx + 2, 10],
                            fill=(200, 60, 60))
        cp_path = os.path.join(outdoor_dir, f"crop_plot_{stage}.png")
        cp.save(cp_path)
        print(f"  [crop]    {cp_path}  ({cp.size[0]}×{cp.size[1]})")

    print(f"\nDone! Generated all placeholder sprites.")


if __name__ == "__main__":
    main()
