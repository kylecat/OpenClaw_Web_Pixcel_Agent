#!/usr/bin/env python3
"""
Process UI reference pixel-art assets → outdoor scene assets.
Trims transparent borders, resizes to target dimensions, and copies to assets/outdoor/.
"""

from PIL import Image
import os

UI_DIR = os.path.join(os.path.dirname(__file__), '..', 'ui')
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'frontend', 'public', 'assets', 'outdoor')
os.makedirs(OUT_DIR, exist_ok=True)


def trim_transparency(img):
    """Remove transparent border from RGBA image."""
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    bbox = img.getbbox()
    if bbox:
        return img.crop(bbox)
    return img


def process_and_save(src_name, dst_name, max_w=None, max_h=None):
    """Load from ui/, trim, optionally resize, save to assets/outdoor/."""
    src = os.path.join(UI_DIR, src_name)
    if not os.path.exists(src):
        print(f'  SKIP (not found): {src_name}')
        return
    img = Image.open(src).convert('RGBA')
    img = trim_transparency(img)

    if max_w and max_h:
        # Resize to fit within max_w × max_h, preserving aspect ratio
        w, h = img.size
        scale = min(max_w / w, max_h / h)
        if scale < 1:
            new_w = max(1, int(w * scale))
            new_h = max(1, int(h * scale))
            img = img.resize((new_w, new_h), Image.NEAREST)
    elif max_w:
        w, h = img.size
        scale = max_w / w
        if scale < 1:
            img = img.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.NEAREST)

    dst = os.path.join(OUT_DIR, dst_name)
    img.save(dst)
    print(f'  {src_name} ({img.size[0]}x{img.size[1]}) -> {dst_name}')


def gen_grass_tile():
    """Generate a proper isometric grass diamond tile from the scene reference."""
    # Use the outdoor scene reference to sample grass color/texture
    ref_path = os.path.join(UI_DIR, '室外場景1.png')
    if os.path.exists(ref_path):
        ref = Image.open(ref_path).convert('RGBA')
        # Sample grass area (top-right of scene, mostly grass)
        # Create a textured 64×32 diamond
        import random
        random.seed(42)
        w, h = 64, 32
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        # Build diamond mask
        hw, hh = w // 2, h // 2
        for y in range(h):
            for x in range(w):
                # Diamond test
                dx = abs(x - hw) / hw
                dy = abs(y - hh) / hh
                if dx + dy <= 1.0:
                    # Sample colors from the reference grass area
                    # The reference scene has grass in the upper portion
                    rx = 600 + (x * 3) % 200
                    ry = 100 + (y * 3) % 200
                    rx = min(rx, ref.size[0] - 1)
                    ry = min(ry, ref.size[1] - 1)
                    pixel = ref.getpixel((rx, ry))
                    # Add subtle noise for variation
                    r = max(0, min(255, pixel[0] + random.randint(-5, 5)))
                    g = max(0, min(255, pixel[1] + random.randint(-5, 5)))
                    b = max(0, min(255, pixel[2] + random.randint(-5, 5)))
                    img.putpixel((x, y), (r, g, b, 255))
        img.save(os.path.join(OUT_DIR, 'iso_grass.png'))
        print(f'  Generated iso_grass.png (64x32) from scene reference')
    else:
        print('  SKIP iso_grass.png (no scene reference)')


def gen_dirt_tile():
    """Generate a dirt diamond tile from crop plot reference."""
    ref_path = os.path.join(UI_DIR, '田壟_小2.png')
    if os.path.exists(ref_path):
        ref = Image.open(ref_path).convert('RGBA')
        import random
        random.seed(43)
        w, h = 64, 32
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        hw, hh = w // 2, h // 2
        for y in range(h):
            for x in range(w):
                dx = abs(x - hw) / hw
                dy = abs(y - hh) / hh
                if dx + dy <= 1.0:
                    # Sample from center of the dirt plot
                    rx = int(ref.size[0] * 0.3 + (x * 2) % (ref.size[0] // 3))
                    ry = int(ref.size[1] * 0.3 + (y * 2) % (ref.size[1] // 3))
                    rx = min(rx, ref.size[0] - 1)
                    ry = min(ry, ref.size[1] - 1)
                    pixel = ref.getpixel((rx, ry))
                    if pixel[3] < 128:
                        # Fallback brown
                        pixel = (120, 85, 40, 255)
                    r = max(0, min(255, pixel[0] + random.randint(-5, 5)))
                    g = max(0, min(255, pixel[1] + random.randint(-5, 5)))
                    b = max(0, min(255, pixel[2] + random.randint(-5, 5)))
                    img.putpixel((x, y), (r, g, b, 255))
        img.save(os.path.join(OUT_DIR, 'iso_dirt.png'))
        print(f'  Generated iso_dirt.png (64x32) from crop reference')
    else:
        print('  SKIP iso_dirt.png (no reference)')


def gen_water_tile():
    """Generate a water diamond tile from the scene reference."""
    ref_path = os.path.join(UI_DIR, '螢幕截圖_室外場景.png')
    if os.path.exists(ref_path):
        ref = Image.open(ref_path).convert('RGBA')
        import random
        random.seed(44)
        w, h = 64, 32
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        hw, hh = w // 2, h // 2
        for y in range(h):
            for x in range(w):
                dx = abs(x - hw) / hw
                dy = abs(y - hh) / hh
                if dx + dy <= 1.0:
                    # Sample from river area of the screenshot (bottom-left)
                    rx = 40 + (x * 2) % 60
                    ry = 360 + (y * 2) % 30
                    rx = min(rx, ref.size[0] - 1)
                    ry = min(ry, ref.size[1] - 1)
                    pixel = ref.getpixel((rx, ry))
                    r = max(0, min(255, pixel[0] + random.randint(-5, 5)))
                    g = max(0, min(255, pixel[1] + random.randint(-5, 5)))
                    b = max(0, min(255, pixel[2] + random.randint(-5, 5)))
                    img.putpixel((x, y), (r, g, b, 255))
        img.save(os.path.join(OUT_DIR, 'iso_water.png'))
        print(f'  Generated iso_water.png (64x32) from scene reference')
    else:
        print('  SKIP iso_water.png (no reference)')


def gen_path_tile():
    """Generate a path diamond tile from the stone brick reference."""
    ref_path = os.path.join(UI_DIR, '室外道路_石磚.png')
    if os.path.exists(ref_path):
        ref = Image.open(ref_path).convert('RGBA')
        import random
        random.seed(45)
        w, h = 64, 32
        img = Image.new('RGBA', (w, h), (0, 0, 0, 0))
        hw, hh = w // 2, h // 2
        for y in range(h):
            for x in range(w):
                dx = abs(x - hw) / hw
                dy = abs(y - hh) / hh
                if dx + dy <= 1.0:
                    # Sample from center of the stone brick tile
                    rx = int(ref.size[0] * 0.2 + (x * ref.size[0] * 0.6) / w)
                    ry = int(ref.size[1] * 0.2 + (y * ref.size[1] * 0.6) / h)
                    rx = min(rx, ref.size[0] - 1)
                    ry = min(ry, ref.size[1] - 1)
                    pixel = ref.getpixel((rx, ry))
                    if pixel[3] < 128:
                        pixel = (160, 150, 130, 255)
                    r = max(0, min(255, pixel[0] + random.randint(-3, 3)))
                    g = max(0, min(255, pixel[1] + random.randint(-3, 3)))
                    b = max(0, min(255, pixel[2] + random.randint(-3, 3)))
                    img.putpixel((x, y), (r, g, b, 255))
        img.save(os.path.join(OUT_DIR, 'iso_path.png'))
        print(f'  Generated iso_path.png (64x32) from stone brick reference')
    else:
        print('  SKIP iso_path.png (no reference)')


if __name__ == '__main__':
    print('Processing buildings...')
    # Greenhouses: 3 variants, target ~256px wide (fits 4-tile footprint at 64px/tile)
    process_and_save('溫室1.png', 'greenhouse.png', max_w=256)
    process_and_save('溫室2.png', 'greenhouse2.png', max_w=256)

    # Cabin (資材室): target ~192px wide (3-tile footprint)
    process_and_save('資材室1.png', 'cabin.png', max_w=192)

    # Weather station: very large, target ~128px wide (2-tile footprint)
    process_and_save('氣象站1.png', 'weather_station.png', max_w=128)

    # Wind turbine: new decoration
    process_and_save('風力發電機1.png', 'wind_turbine.png', max_w=96)

    print('\nProcessing vegetation...')
    # Tree: target ~64px wide
    process_and_save('樹1.png', 'tree_1.png', max_w=64)

    print('\nProcessing crop plots...')
    # Small crop plots (fit in ~2x2 tile footprint, ~128px)
    process_and_save('田壟_小1.png', 'crop_plot_growing.png', max_w=128)
    process_and_save('田壟_小2.png', 'crop_plot_empty.png', max_w=128)

    # Long crop plots (new types for variety)
    process_and_save('田壟_長2.png', 'crop_long_growing.png', max_w=256)
    process_and_save('田壟_長3.png', 'crop_long_covered.png', max_w=256)
    process_and_save('田壟_長4.png', 'crop_long_harvest.png', max_w=256)

    print('\nGenerating ground tiles from references...')
    gen_grass_tile()
    gen_dirt_tile()
    gen_water_tile()
    gen_path_tile()

    # Keep the 8-direction character sprites from the previous generation
    # (gaia_iso.png and astraea_iso.png are still valid)

    print('\nDone!')
