#!/usr/bin/env python3
"""
Generate pixel-art isometric assets for the outdoor farm scene.
All assets are drawn pixel-by-pixel for a retro pixel-art style.

Usage: python3 scripts/generate_outdoor_assets.py
"""

from PIL import Image, ImageDraw
import os, math, random

OUT = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'assets', 'outdoor')
os.makedirs(OUT, exist_ok=True)

random.seed(42)  # reproducible

# ── Helpers ──────────────────────────────────────────────────────────

def iso_diamond_mask(w, h):
    """Return a PIL Image mask for a diamond shape (w×h)."""
    mask = Image.new('L', (w, h), 0)
    draw = ImageDraw.Draw(mask)
    hw, hh = w // 2, h // 2
    draw.polygon([(hw, 0), (w - 1, hh), (hw, h - 1), (0, hh)], fill=255)
    return mask


def fill_diamond(img, base_color, noise=8):
    """Fill an image with base_color inside diamond mask + subtle noise."""
    w, h = img.size
    mask = iso_diamond_mask(w, h)
    pixels = img.load()
    mask_px = mask.load()
    r0, g0, b0 = base_color
    for y in range(h):
        for x in range(w):
            if mask_px[x, y] > 0:
                nr = max(0, min(255, r0 + random.randint(-noise, noise)))
                ng = max(0, min(255, g0 + random.randint(-noise, noise)))
                nb = max(0, min(255, b0 + random.randint(-noise, noise)))
                pixels[x, y] = (nr, ng, nb, 255)


def diamond_outline(draw, w, h, color, width=1):
    """Draw a diamond outline."""
    hw, hh = w // 2, h // 2
    pts = [(hw, 0), (w - 1, hh), (hw, h - 1), (0, hh)]
    for i in range(4):
        p1, p2 = pts[i], pts[(i + 1) % 4]
        draw.line([p1, p2], fill=color, width=width)


def darken(color, factor=0.7):
    return tuple(int(c * factor) for c in color)


def lighten(color, factor=1.3):
    return tuple(min(255, int(c * factor)) for c in color)


# ── Ground Tiles (64×32) ────────────────────────────────────────────

def gen_grass():
    img = Image.new('RGBA', (64, 32), (0, 0, 0, 0))
    fill_diamond(img, (74, 140, 63), noise=12)
    draw = ImageDraw.Draw(img)
    mask = iso_diamond_mask(64, 32)
    mask_px = mask.load()
    # Grass blades
    for _ in range(30):
        x = random.randint(4, 59)
        y = random.randint(2, 29)
        if mask_px[x, y] > 0:
            shade = random.choice([(60, 120, 50), (85, 155, 70), (50, 110, 40)])
            draw.point((x, y), fill=(*shade, 255))
            if y > 0 and mask_px[x, y-1] > 0:
                draw.point((x, y - 1), fill=(*shade, 200))
    # Subtle edge darkening (bottom-left, bottom-right)
    diamond_outline(draw, 64, 32, (40, 90, 30, 100))
    img.save(os.path.join(OUT, 'iso_grass.png'))


def gen_dirt():
    img = Image.new('RGBA', (64, 32), (0, 0, 0, 0))
    fill_diamond(img, (139, 105, 20), noise=15)
    draw = ImageDraw.Draw(img)
    mask = iso_diamond_mask(64, 32)
    mask_px = mask.load()
    # Pebbles / texture
    for _ in range(20):
        x = random.randint(6, 57)
        y = random.randint(3, 28)
        if mask_px[x, y] > 0:
            shade = random.choice([(120, 90, 15), (155, 115, 30), (110, 80, 10)])
            draw.point((x, y), fill=(*shade, 255))
    diamond_outline(draw, 64, 32, (100, 75, 10, 100))
    img.save(os.path.join(OUT, 'iso_dirt.png'))


def gen_water():
    img = Image.new('RGBA', (64, 32), (0, 0, 0, 0))
    fill_diamond(img, (58, 124, 191), noise=10)
    draw = ImageDraw.Draw(img)
    mask = iso_diamond_mask(64, 32)
    mask_px = mask.load()
    # Wave highlights
    for _ in range(15):
        x = random.randint(8, 55)
        y = random.randint(4, 27)
        if mask_px[x, y] > 0:
            draw.line([(x, y), (x + random.randint(2, 5), y)], fill=(100, 170, 220, 180))
    # Specular dots
    for _ in range(8):
        x = random.randint(15, 48)
        y = random.randint(6, 25)
        if mask_px[x, y] > 0:
            draw.point((x, y), fill=(180, 220, 255, 200))
    diamond_outline(draw, 64, 32, (40, 90, 150, 120))
    img.save(os.path.join(OUT, 'iso_water.png'))


def gen_path():
    img = Image.new('RGBA', (64, 32), (0, 0, 0, 0))
    fill_diamond(img, (196, 164, 108), noise=10)
    draw = ImageDraw.Draw(img)
    mask = iso_diamond_mask(64, 32)
    mask_px = mask.load()
    # Cobblestone pattern
    for _ in range(12):
        x = random.randint(8, 55)
        y = random.randint(4, 27)
        if mask_px[x, y] > 0:
            shade = random.choice([(180, 150, 95), (210, 178, 120), (170, 140, 85)])
            sz = random.randint(2, 3)
            for dx in range(sz):
                for dy in range(sz // 2 + 1):
                    px, py = x + dx, y + dy
                    if 0 <= px < 64 and 0 <= py < 32 and mask_px[px, py] > 0:
                        draw.point((px, py), fill=(*shade, 255))
    diamond_outline(draw, 64, 32, (150, 120, 75, 100))
    img.save(os.path.join(OUT, 'iso_path.png'))


# ── Buildings ────────────────────────────────────────────────────────

def gen_greenhouse():
    """Greenhouse: 64×80, isometric building with glass panels."""
    w, h = 64, 80
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Base diamond (footprint) at bottom
    base_y = 48
    hw = 32
    hh = 16

    # Front face (left trapezoid)
    draw.polygon([
        (0, base_y + hh),      # bottom-left of diamond
        (hw, base_y + hh * 2), # bottom-center
        (hw, base_y),          # top-center
        (0, base_y),           # top-left
    ], fill=(160, 210, 160, 230))

    # Right face
    draw.polygon([
        (hw, base_y + hh * 2),
        (w - 1, base_y + hh),
        (w - 1, base_y - 16),
        (hw, base_y),
    ], fill=(130, 190, 130, 230))

    # Roof (pointed)
    draw.polygon([
        (hw, 4),               # peak
        (0, base_y),
        (hw, base_y + hh),     # note: not full bottom
        (w - 1, base_y - 16),
    ], fill=(180, 230, 180, 200))

    # Glass panel lines
    for i in range(1, 4):
        x_off = i * (hw // 4)
        draw.line([(x_off, base_y), (x_off, base_y + hh + x_off // 2)], fill=(100, 180, 100, 150), width=1)
    for i in range(1, 4):
        x_off = hw + i * (hw // 4)
        draw.line([(x_off, base_y + hh * 2 - i * (hh // 3)), (x_off, base_y - 16 + i * 4)], fill=(100, 170, 100, 150), width=1)

    # Frame lines
    draw.line([(0, base_y + hh), (hw, base_y + hh * 2)], fill=(60, 100, 60, 255), width=1)
    draw.line([(hw, base_y + hh * 2), (w - 1, base_y + hh)], fill=(60, 100, 60, 255), width=1)
    draw.line([(0, base_y), (0, base_y + hh)], fill=(60, 100, 60, 255), width=1)
    draw.line([(w - 1, base_y - 16), (w - 1, base_y + hh)], fill=(60, 100, 60, 255), width=1)
    draw.line([(hw, 4), (0, base_y)], fill=(60, 100, 60, 255), width=1)
    draw.line([(hw, 4), (w - 1, base_y - 16)], fill=(60, 100, 60, 255), width=1)

    # Door
    draw.rectangle([(28, base_y + 20), (35, base_y + 32)], fill=(80, 140, 80, 255))

    img.save(os.path.join(OUT, 'greenhouse.png'))


def gen_cabin():
    """Cabin: 64×84, cozy wooden cabin."""
    w, h = 64, 84
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    base_y = 40
    hw = 32

    # Left wall
    draw.polygon([
        (0, base_y + 16),
        (hw, base_y + 32),
        (hw, base_y),
        (0, base_y - 8),
    ], fill=(139, 90, 43))

    # Right wall
    draw.polygon([
        (hw, base_y + 32),
        (w - 1, base_y + 16),
        (w - 1, base_y - 24),
        (hw, base_y),
    ], fill=(120, 75, 35))

    # Roof left
    draw.polygon([
        (hw, 4),
        (-4, base_y - 4),
        (hw, base_y + 8),
    ], fill=(160, 60, 40))

    # Roof right
    draw.polygon([
        (hw, 4),
        (68, base_y - 20),
        (hw, base_y + 8),
    ], fill=(130, 45, 30))

    # Log lines on left wall
    for i in range(4):
        y = base_y + i * 6
        draw.line([(2, y - 6 + i * 2), (hw - 2, y + 2 + i * 2)], fill=(110, 70, 30, 180), width=1)

    # Log lines on right wall
    for i in range(4):
        y = base_y + i * 5
        draw.line([(hw + 2, y + i * 2), (w - 3, y - 6 + i)], fill=(95, 60, 25, 180), width=1)

    # Door
    draw.rectangle([(14, base_y + 10), (22, base_y + 24)], fill=(90, 55, 25))
    draw.point((21, base_y + 17), fill=(200, 180, 50))  # doorknob

    # Window on right
    draw.rectangle([(hw + 10, base_y - 8), (hw + 20, base_y + 2)], fill=(150, 200, 220))
    draw.rectangle([(hw + 10, base_y - 8), (hw + 20, base_y + 2)], outline=(80, 50, 25))

    # Chimney
    draw.rectangle([(44, 2), (50, 20)], fill=(100, 70, 40))
    draw.rectangle([(43, 0), (51, 4)], fill=(80, 55, 30))

    img.save(os.path.join(OUT, 'cabin.png'))


def gen_weather_station():
    """Weather station: 64×88, metal/tech structure."""
    w, h = 64, 88
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    base_y = 50

    # Platform base
    draw.polygon([
        (32, base_y + 16),
        (0, base_y),
        (32, base_y - 16),
        (63, base_y),
    ], fill=(140, 140, 150))
    draw.polygon([
        (32, base_y + 16),
        (0, base_y),
        (32, base_y - 16),
        (63, base_y),
    ], outline=(100, 100, 110))

    # Main pole
    draw.rectangle([(29, 14), (34, base_y)], fill=(160, 160, 170))
    draw.rectangle([(29, 14), (34, base_y)], outline=(120, 120, 130))

    # Anemometer (top cross)
    draw.line([(20, 18), (44, 18)], fill=(180, 180, 190), width=2)
    draw.ellipse([(17, 15), (23, 21)], fill=(200, 200, 210))
    draw.ellipse([(41, 15), (47, 21)], fill=(200, 200, 210))
    draw.ellipse([(29, 10), (35, 16)], fill=(200, 200, 210))

    # Wind vane
    draw.polygon([(32, 6), (28, 12), (36, 12)], fill=(180, 50, 50))

    # Solar panel (left)
    draw.polygon([
        (6, base_y - 8),
        (18, base_y - 14),
        (18, base_y - 22),
        (6, base_y - 16),
    ], fill=(60, 80, 140))
    draw.polygon([
        (6, base_y - 8),
        (18, base_y - 14),
        (18, base_y - 22),
        (6, base_y - 16),
    ], outline=(40, 55, 100))

    # Screen / display
    draw.rectangle([(24, base_y - 10), (40, base_y - 2)], fill=(30, 60, 30))
    draw.rectangle([(26, base_y - 8), (38, base_y - 4)], fill=(50, 200, 80))

    # Rain gauge (right)
    draw.rectangle([(46, base_y - 16), (52, base_y)], fill=(180, 200, 220, 200))
    draw.rectangle([(46, base_y - 16), (52, base_y)], outline=(120, 140, 160))
    draw.rectangle([(47, base_y - 8), (51, base_y)], fill=(100, 160, 220, 200))

    img.save(os.path.join(OUT, 'weather_station.png'))


# ── Vegetation ───────────────────────────────────────────────────────

def gen_tree(filename, w, h, trunk_color, leaf_color, leaf_alt):
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Trunk
    tw = max(3, w // 8)
    tx = w // 2 - tw // 2
    trunk_top = h // 2
    draw.rectangle([(tx, trunk_top), (tx + tw, h - 1)], fill=trunk_color)
    # Bark detail
    for i in range(3):
        y = trunk_top + 2 + i * (h - trunk_top) // 4
        draw.line([(tx + 1, y), (tx + tw - 1, y)], fill=darken(trunk_color, 0.8))

    # Leaf canopy (layered circles for organic look)
    cx, cy = w // 2, trunk_top - 2
    for dy in range(-h // 3, 4):
        for dx in range(-w // 3, w // 3 + 1):
            dist = math.sqrt(dx * dx + (dy * 1.5) ** 2)
            r = w // 3 + 2
            if dist < r:
                px, py = cx + dx, cy + dy
                if 0 <= px < w and 0 <= py < h:
                    c = leaf_color if (dx + dy) % 3 != 0 else leaf_alt
                    nr = max(0, min(255, c[0] + random.randint(-10, 10)))
                    ng = max(0, min(255, c[1] + random.randint(-10, 10)))
                    nb = max(0, min(255, c[2] + random.randint(-10, 10)))
                    img.putpixel((px, py), (nr, ng, nb, 255))

    # Highlights on top
    for _ in range(6):
        hx = cx + random.randint(-w // 4, w // 4)
        hy = cy + random.randint(-h // 4, 0)
        if 0 <= hx < w and 0 <= hy < h and img.getpixel((hx, hy))[3] > 0:
            lc = lighten(leaf_color)
            img.putpixel((hx, hy), (*lc, 255))

    img.save(os.path.join(OUT, filename))


def gen_bush():
    w, h = 24, 20
    img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    cx, cy = w // 2, h // 2 + 2
    for dy in range(-8, 8):
        for dx in range(-10, 11):
            dist = math.sqrt((dx * 0.9) ** 2 + (dy * 1.3) ** 2)
            if dist < 9:
                px, py = cx + dx, cy + dy
                if 0 <= px < w and 0 <= py < h:
                    base = (90, 154, 58) if (dx + dy) % 2 == 0 else (75, 135, 45)
                    nr = max(0, min(255, base[0] + random.randint(-8, 8)))
                    ng = max(0, min(255, base[1] + random.randint(-8, 8)))
                    nb = max(0, min(255, base[2] + random.randint(-8, 8)))
                    img.putpixel((px, py), (nr, ng, nb, 255))
    img.save(os.path.join(OUT, 'bush.png'))


# ── Crop Plots (64×32 diamond) ──────────────────────────────────────

def gen_crop_empty():
    img = Image.new('RGBA', (64, 32), (0, 0, 0, 0))
    fill_diamond(img, (154, 120, 64), noise=10)
    draw = ImageDraw.Draw(img)
    mask = iso_diamond_mask(64, 32)
    mask_px = mask.load()
    # Furrow lines
    for i in range(1, 5):
        y = 6 + i * 5
        for x in range(10, 54, 3):
            if 0 <= y < 32 and mask_px[x, y] > 0:
                draw.point((x, y), fill=(120, 90, 45, 255))
    diamond_outline(draw, 64, 32, (110, 80, 35, 120))
    img.save(os.path.join(OUT, 'crop_plot_empty.png'))


def gen_crop_growing():
    img = Image.new('RGBA', (64, 32), (0, 0, 0, 0))
    fill_diamond(img, (120, 100, 55), noise=8)
    draw = ImageDraw.Draw(img)
    mask = iso_diamond_mask(64, 32)
    mask_px = mask.load()
    # Small green sprouts
    sprout_positions = [(16, 10), (28, 8), (40, 12), (22, 18), (36, 16), (48, 14), (18, 24), (34, 22)]
    for sx, sy in sprout_positions:
        if 0 <= sx < 64 and 0 <= sy < 32 and mask_px[sx, sy] > 0:
            color = random.choice([(70, 140, 50), (80, 155, 60), (60, 130, 45)])
            draw.point((sx, sy), fill=(*color, 255))
            if sy > 0 and mask_px[sx, sy - 1] > 0:
                draw.point((sx, sy - 1), fill=(*color, 255))
            if sy > 1 and mask_px[sx, sy - 2] > 0:
                draw.point((sx, sy - 2), fill=(*lighten(color), 230))
    diamond_outline(draw, 64, 32, (90, 70, 30, 120))
    img.save(os.path.join(OUT, 'crop_plot_growing.png'))


def gen_crop_ready():
    img = Image.new('RGBA', (64, 32), (0, 0, 0, 0))
    fill_diamond(img, (110, 95, 50), noise=8)
    draw = ImageDraw.Draw(img)
    mask = iso_diamond_mask(64, 32)
    mask_px = mask.load()
    # Tall golden wheat/crops
    crop_positions = [(14, 12), (22, 8), (30, 10), (38, 7), (46, 11), (20, 18), (32, 16), (42, 20), (26, 22)]
    for cx, cy in crop_positions:
        if 0 <= cx < 64 and 0 <= cy < 32 and mask_px[cx, cy] > 0:
            gold = random.choice([(212, 160, 48), (200, 150, 40), (220, 170, 55)])
            for dy in range(4):
                py = cy - dy
                if 0 <= py < 32 and mask_px[cx, py] > 0:
                    draw.point((cx, py), fill=(*gold, 255))
            # Grain head
            if cy - 4 >= 0 and mask_px[cx, cy - 4] > 0:
                draw.point((cx - 1, cy - 4), fill=(230, 190, 70, 255))
                draw.point((cx + 1, cy - 4), fill=(230, 190, 70, 255))
    diamond_outline(draw, 64, 32, (90, 70, 30, 120))
    img.save(os.path.join(OUT, 'crop_plot_ready.png'))


# ── 8-Direction Character Sprites ───────────────────────────────────

# Sprite sheet: 128×192 (4 cols × 8 rows), each frame 32×24
# Directions: S, SW, W, NW, N, NE, E, SE (row order)
# 4 walk frames per direction

CHAR_FW = 32   # frame width
CHAR_FH = 24   # frame height (chibi proportion)
SHEET_COLS = 4
SHEET_ROWS = 8

# Direction offsets: body facing angle adjustments
# S=0, SW=1, W=2, NW=3, N=4, NE=5, E=6, SE=7

def draw_chibi_char(img, fx, fy, direction, frame, skin, hair, shirt, pants, hair_style='short'):
    """
    Draw a single chibi character frame at (fx, fy) in the sprite sheet.
    direction: 0-7 (S, SW, W, NW, N, NE, E, SE)
    frame: 0-3 (walk cycle)
    """
    draw = ImageDraw.Draw(img)

    # Base positions
    cx = fx + CHAR_FW // 2  # center x
    foot_y = fy + CHAR_FH - 1

    # Walk bob
    bob = [0, -1, 0, -1][frame]
    # Leg spread for walk animation
    leg_offset = [-1, 0, 1, 0][frame]

    # Determine facing
    faces_right = direction in (5, 6, 7)  # NE, E, SE
    faces_left = direction in (1, 2, 3)   # SW, W, NW
    faces_front = direction in (0, 1, 7)  # S, SW, SE
    faces_back = direction in (3, 4, 5)   # NW, N, NE
    is_side = direction in (2, 6)         # W, E

    # Body width adjustment
    bw = 4 if is_side else 5  # narrower from side

    # ── Legs ──
    ly = foot_y - 4
    if is_side:
        # Side view: legs overlapping with walk offset
        draw.line([(cx - 1 + leg_offset, ly), (cx - 1 + leg_offset, foot_y)], fill=pants, width=2)
        draw.line([(cx + 1 - leg_offset, ly), (cx + 1 - leg_offset, foot_y)], fill=darken(pants, 0.85), width=2)
    else:
        spread = 2
        lx = -spread if not faces_right else 0
        rx = spread if not faces_left else 0
        draw.line([(cx + lx + leg_offset, ly), (cx + lx + leg_offset, foot_y)], fill=pants, width=2)
        draw.line([(cx + rx - leg_offset, ly), (cx + rx - leg_offset, foot_y)], fill=darken(pants, 0.85), width=2)

    # ── Torso ──
    ty = ly - 5 + bob
    body_left = cx - bw // 2
    body_right = cx + bw // 2
    draw.rectangle([(body_left, ty), (body_right, ly)], fill=shirt)

    # Side shading
    if faces_left or is_side:
        draw.line([(body_right, ty), (body_right, ly)], fill=darken(shirt, 0.8))
    if faces_right:
        draw.line([(body_left, ty), (body_left, ly)], fill=darken(shirt, 0.8))

    # ── Arms ──
    arm_y = ty + 2
    arm_swing = [-1, 0, 1, 0][frame]
    if is_side:
        # Side: one arm visible
        ax = body_left - 1 if direction == 2 else body_right + 1
        draw.line([(ax, arm_y), (ax + arm_swing, arm_y + 4)], fill=skin, width=1)
    else:
        draw.line([(body_left - 1, arm_y), (body_left - 1 - arm_swing, arm_y + 4)], fill=skin, width=1)
        draw.line([(body_right + 1, arm_y), (body_right + 1 + arm_swing, arm_y + 4)], fill=skin, width=1)

    # ── Head ──
    head_w = 7
    head_h = 7
    hx = cx - head_w // 2
    hy = ty - head_h + 1 + bob
    draw.rectangle([(hx, hy), (hx + head_w - 1, hy + head_h - 1)], fill=skin)

    # ── Face ──
    if faces_front or direction in (1, 7):
        # Front-facing: two eyes
        ey = hy + 3
        if faces_left:
            draw.point((cx - 2, ey), fill=(40, 40, 40))
            draw.point((cx + 1, ey), fill=(40, 40, 40))
        elif faces_right:
            draw.point((cx - 1, ey), fill=(40, 40, 40))
            draw.point((cx + 2, ey), fill=(40, 40, 40))
        else:
            draw.point((cx - 2, ey), fill=(40, 40, 40))
            draw.point((cx + 2, ey), fill=(40, 40, 40))
    elif faces_back:
        pass  # no face visible from back
    elif is_side:
        ey = hy + 3
        ex = cx + 2 if direction == 6 else cx - 2
        draw.point((ex, ey), fill=(40, 40, 40))

    # ── Hair ──
    hair_top = hy - 1
    if hair_style == 'short':
        draw.rectangle([(hx - 1, hair_top), (hx + head_w, hy + 2)], fill=hair)
        if faces_back:
            draw.rectangle([(hx - 1, hair_top), (hx + head_w, hy + head_h - 2)], fill=hair)
    elif hair_style == 'long':
        draw.rectangle([(hx - 1, hair_top), (hx + head_w, hy + 2)], fill=hair)
        # Long hair on sides
        draw.line([(hx - 1, hy + 2), (hx - 1, hy + head_h + 2)], fill=hair, width=1)
        draw.line([(hx + head_w, hy + 2), (hx + head_w, hy + head_h + 2)], fill=hair, width=1)
        if faces_back:
            draw.rectangle([(hx - 1, hair_top), (hx + head_w, hy + head_h + 1)], fill=hair)

    # Shoes
    draw.point((cx - 2 + leg_offset, foot_y), fill=(60, 40, 20))
    draw.point((cx + 2 - leg_offset, foot_y), fill=(60, 40, 20))


def gen_character_sheet(filename, skin, hair, shirt, pants, hair_style='short'):
    """Generate a complete 8-direction sprite sheet."""
    sw = CHAR_FW * SHEET_COLS  # 128
    sh = CHAR_FH * SHEET_ROWS  # 192
    img = Image.new('RGBA', (sw, sh), (0, 0, 0, 0))

    for direction in range(8):
        for frame in range(4):
            fx = frame * CHAR_FW
            fy = direction * CHAR_FH
            draw_chibi_char(img, fx, fy, direction, frame, skin, hair, shirt, pants, hair_style)

    img.save(os.path.join(OUT, filename))


# ── Generate All ─────────────────────────────────────────────────────

if __name__ == '__main__':
    print('Generating ground tiles...')
    gen_grass()
    gen_dirt()
    gen_water()
    gen_path()

    print('Generating buildings...')
    gen_greenhouse()
    gen_cabin()
    gen_weather_station()

    print('Generating vegetation...')
    gen_tree('tree_1.png', 32, 48, (100, 70, 35), (45, 106, 30), (55, 120, 35))
    gen_tree('tree_2.png', 32, 52, (90, 60, 30), (58, 125, 40), (68, 140, 50))
    gen_bush()

    print('Generating crop plots...')
    gen_crop_empty()
    gen_crop_growing()
    gen_crop_ready()

    print('Generating character sprite sheets...')
    # Gaia: warm skin, dark blue hair, blue shirt, dark pants
    gen_character_sheet('gaia_iso.png',
        skin=(235, 200, 160),
        hair=(40, 50, 90),
        shirt=(70, 100, 170),
        pants=(50, 50, 70),
        hair_style='short',
    )
    # Astraea: light skin, silver/lavender hair, purple shirt, dark skirt
    gen_character_sheet('astraea_iso.png',
        skin=(240, 215, 195),
        hair=(160, 140, 190),
        shirt=(140, 80, 160),
        pants=(70, 50, 80),
        hair_style='long',
    )

    print(f'All assets saved to {OUT}')
    print('Done!')
