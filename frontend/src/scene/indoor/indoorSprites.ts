// Character sprite sheet constants (ref_repo format)
export const CHAR_FRAME_W = 16
export const CHAR_FRAME_H = 32
export const CHAR_FRAMES_PER_ROW = 7

// Row index per direction in sprite sheet
export const DIR_ROW: Record<string, number> = {
  DOWN:  0,
  UP:    1,
  RIGHT: 2,
  LEFT:  2,  // mirrored
}

// Walk animation columns (0-3), idle = col 1
export const WALK_FRAMES = [0, 1, 2, 3]
export const IDLE_FRAME  = 1

export interface SpriteSheet {
  img: HTMLImageElement
  frameW: number
  frameH: number
}

export interface IndoorSprites {
  gaia:            SpriteSheet
  astraea:         SpriteSheet
  floorTile:       HTMLImageElement
  bulletinBoard:   HTMLImageElement
  dashboardPanel:  HTMLImageElement
  // wall textures (optional -- drawn in padding areas)
  wallTop?:        HTMLImageElement
  wallSide?:       HTMLImageElement
  // pixel-art decorations
  desk:            HTMLImageElement
  plant:           HTMLImageElement
  bookshelf:       HTMLImageElement
  chair:           HTMLImageElement
  // high-res decorations
  fridge:          HTMLImageElement
  squareTable:     HTMLImageElement
  clock:           HTMLImageElement
  shelf1:          HTMLImageElement
  shelf2:          HTMLImageElement
  pcDesk:          HTMLImageElement
  sofa1:           HTMLImageElement
  sofa2:           HTMLImageElement
  sofa3:           HTMLImageElement
  pot1:            HTMLImageElement
  pot2:            HTMLImageElement
  vendingMachine:  HTMLImageElement
  waterDispenser:  HTMLImageElement
  exitDoor:        HTMLImageElement
  portal:          HTMLImageElement
  shelf3:          HTMLImageElement
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload  = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load: ${src}`))
    img.src = src
  })
}

function sheet(img: HTMLImageElement): SpriteSheet {
  return { img, frameW: CHAR_FRAME_W, frameH: CHAR_FRAME_H }
}

export async function loadIndoorSprites(): Promise<IndoorSprites> {
  const [
    gaia, astraea,
    floorTile, bulletinBoard, dashboardPanel,
    desk, plant, bookshelf, chair,
    fridge, squareTable, clock,
    shelf1, shelf2, pcDesk,
    sofa1, sofa2, sofa3,
    pot1, pot2,
    vendingMachine, waterDispenser,
    exitDoor, portal, shelf3,
  ] = await Promise.all([
    loadImage('/assets/characters/gaia.png'),
    loadImage('/assets/characters/astraea.png'),
    loadImage('/assets/floor_tile.png'),
    loadImage('/assets/bulletin_board.png'),
    loadImage('/assets/dashboard_panel.png'),
    loadImage('/assets/desk.png'),
    loadImage('/assets/plant.png'),
    loadImage('/assets/bookshelf.png'),
    loadImage('/assets/chair.png'),
    loadImage('/assets/fridge.png'),
    loadImage('/assets/square_table.png'),
    loadImage('/assets/clock.png'),
    loadImage('/assets/shelf1.png'),
    loadImage('/assets/shelf2.png'),
    loadImage('/assets/pc_desk.png'),
    loadImage('/assets/sofa1.png'),
    loadImage('/assets/sofa2.png'),
    loadImage('/assets/sofa3.png'),
    loadImage('/assets/pot1.png'),
    loadImage('/assets/pot2.png'),
    loadImage('/assets/vending_machine.png'),
    loadImage('/assets/water_dispenser.png'),
    loadImage('/assets/exit_door.png'),
    loadImage('/assets/portal.png'),
    loadImage('/assets/shelf3.png'),
  ])
  // Wall textures loaded separately so they don't block the rest on failure
  const [wallTop, wallSide] = await Promise.all([
    loadImage('/assets/wall_top.png').catch(() => undefined),
    loadImage('/assets/wall_side.png').catch(() => undefined),
  ])

  return {
    gaia: sheet(gaia),
    astraea: sheet(astraea),
    floorTile,
    bulletinBoard,
    dashboardPanel,
    wallTop,
    wallSide,
    desk,
    plant,
    bookshelf,
    chair,
    fridge,
    squareTable,
    clock,
    shelf1,
    shelf2,
    pcDesk,
    sofa1,
    sofa2,
    sofa3,
    pot1,
    pot2,
    vendingMachine,
    waterDispenser,
    exitDoor,
    portal,
    shelf3,
  }
}
