import type { OutdoorTileKind, OutdoorDecorationKind } from '../core/sceneTypes'

/**
 * Outdoor sprites — loads pixel-art PNG assets from /assets/outdoor/.
 */
export interface OutdoorSprites {
  tiles: Record<OutdoorTileKind, HTMLImageElement | HTMLCanvasElement>
  decorations: Partial<Record<OutdoorDecorationKind, HTMLImageElement | HTMLCanvasElement>>
  /** 8-direction character sprite sheets (gaia_iso.png, astraea_iso.png) */
  characters: Record<string, HTMLImageElement>
}

// ── Asset path mapping ─────────────────────────────────────────────

const TILE_ASSETS: Record<OutdoorTileKind, string> = {
  GRASS: '/assets/outdoor/iso_grass.png',
  DIRT:  '/assets/outdoor/iso_dirt.png',
  WATER: '/assets/outdoor/iso_water.png',
  PATH:  '/assets/outdoor/iso_path.png',
}

const DECO_ASSETS: Record<OutdoorDecorationKind, string> = {
  greenhouse1:      '/assets/outdoor/greenhouse.png',
  greenhouse2:      '/assets/outdoor/greenhouse2.png',
  greenhouse3:      '/assets/outdoor/greenhouse.png',
  weatherStation:   '/assets/outdoor/weather_station.png',
  cabin:            '/assets/outdoor/cabin.png',
  windTurbine:      '/assets/outdoor/wind_turbine.png',
  tree1:            '/assets/outdoor/tree_1.png',
  tree2:            '/assets/outdoor/tree_2.png',
  bush:             '/assets/outdoor/bush.png',
  cropEmpty:        '/assets/outdoor/crop_plot_empty.png',
  cropGrowing:      '/assets/outdoor/crop_plot_growing.png',
  cropReady:        '/assets/outdoor/crop_plot_ready.png',
  cropLongGrowing:  '/assets/outdoor/crop_long_growing.png',
  cropLongCovered:  '/assets/outdoor/crop_long_covered.png',
  cropLongHarvest:  '/assets/outdoor/crop_long_harvest.png',
}

const CHAR_ASSETS: Record<string, string> = {
  gaia:    '/assets/outdoor/gaia_iso.png',
  astraea: '/assets/outdoor/astraea_iso.png',
}

// ── 8-direction sprite sheet constants ─────────────────────────────

/** Frame dimensions in the sprite sheet (source pixels) */
export const ISO_CHAR_FRAME_W = 32
export const ISO_CHAR_FRAME_H = 24
/** Sprite sheet layout: 4 columns × 8 rows */
export const ISO_SHEET_COLS = 4
/** Direction row order: S=0, SW=1, W=2, NW=3, N=4, NE=5, E=6, SE=7 */
export const ISO_DIR_ROW: Record<string, number> = {
  S: 0, SW: 1, W: 2, NW: 3, N: 4, NE: 5, E: 6, SE: 7,
}
/** Map grid directions (UP/DOWN/LEFT/RIGHT) to 8-direction names */
export const GRID_TO_ISO_DIR: Record<string, string> = {
  UP:    'N',
  DOWN:  'S',
  LEFT:  'W',
  RIGHT: 'E',
}
/** Walk animation frames (0-3 cycle) */
export const ISO_WALK_FRAMES = 4
/** Idle uses frame 0 */
export const ISO_IDLE_FRAME = 0

// ── Image loader helper ────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load: ${src}`))
    img.src = src
  })
}

// ── Main loader ────────────────────────────────────────────────────

/**
 * Load all outdoor pixel-art assets from /assets/outdoor/.
 */
export async function loadOutdoorSprites(): Promise<OutdoorSprites> {
  // Load tile images
  const tileEntries = await Promise.all(
    Object.entries(TILE_ASSETS).map(async ([kind, src]) => {
      try {
        const img = await loadImage(src)
        return [kind, img] as [string, HTMLImageElement]
      } catch {
        console.warn(`Tile asset missing: ${src}`)
        return null
      }
    }),
  )
  const tiles = {} as Record<OutdoorTileKind, HTMLImageElement>
  for (const entry of tileEntries) {
    if (entry) tiles[entry[0] as OutdoorTileKind] = entry[1]
  }

  // Load decoration images
  const decoEntries = await Promise.all(
    Object.entries(DECO_ASSETS).map(async ([kind, src]) => {
      try {
        const img = await loadImage(src)
        return [kind, img] as [string, HTMLImageElement]
      } catch {
        console.warn(`Deco asset missing: ${src}`)
        return null
      }
    }),
  )
  const decorations: Partial<Record<OutdoorDecorationKind, HTMLImageElement>> = {}
  for (const entry of decoEntries) {
    if (entry) decorations[entry[0] as OutdoorDecorationKind] = entry[1]
  }

  // Load character sprite sheets
  const charEntries = await Promise.all(
    Object.entries(CHAR_ASSETS).map(async ([id, src]) => {
      try {
        const img = await loadImage(src)
        return [id, img] as [string, HTMLImageElement]
      } catch {
        console.warn(`Character sheet missing: ${src}`)
        return null
      }
    }),
  )
  const characters: Record<string, HTMLImageElement> = {}
  for (const entry of charEntries) {
    if (entry) characters[entry[0]] = entry[1]
  }

  return { tiles, decorations, characters }
}
