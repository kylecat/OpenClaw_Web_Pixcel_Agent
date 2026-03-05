export type CharacterState = 'IDLE' | 'WALK'
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
export type TileKind = 'FLOOR' | 'BOARD' | 'DASHBOARD'
export type DecorationKind =
  | 'desk' | 'plant' | 'bookshelf' | 'chair'
  | 'fridge' | 'squareTable' | 'clock'
  | 'shelf1' | 'shelf2' | 'shelf3' | 'pcDesk'
  | 'sofa1' | 'sofa2' | 'sofa3'
  | 'pot1' | 'pot2'
  | 'vendingMachine' | 'waterDispenser'
  | 'exitDoor' | 'portal'

export interface GridTile {
  kind: TileKind
}

export interface Decoration {
  col: number
  row: number
  kind: DecorationKind
}

export interface Character {
  id: string
  displayName: string
  emoji: string
  statusEmoji: string
  // pixel position (center of current tile, interpolated during walk)
  x: number
  y: number
  // tile grid position
  col: number
  row: number
  // home tile
  homeCol: number
  homeRow: number
  state: CharacterState
  dir: Direction
  path: Array<{ col: number; row: number }>
  moveProgress: number
  frameTimer: number
  frame: number   // current animation frame index (0-3)
}

export interface WorldState {
  grid: GridTile[][]   // [row][col]
  cols: number
  rows: number
  characters: Map<string, Character>
  decorations: Decoration[]
  blockedTiles: Set<string>   // "col,row" -- decoration collision, used by pathfinding
}

// T4: canvas hit-test result
export type SelectedObject =
  | { kind: 'character'; id: string }
  | { kind: 'board' }
  | { kind: 'dashboard' }
  | { kind: 'exitDoor' }
  | { kind: 'portal' }
  | { kind: 'decoration'; index: number; decoKind: DecorationKind }

// T9: Scene abstraction — each scene (indoor, outdoor) implements this interface
export interface SceneConfig {
  id: string
  cols: number
  rows: number
  tileSize: number
  createWorldState: () => WorldState
  loadSprites: () => Promise<unknown>
  render: (
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    world: WorldState,
    sprites: unknown,
    selectedObject?: SelectedObject | null,
    pendingTile?: { col: number; row: number } | null,
  ) => void
  hitTest: (
    logicalX: number,
    logicalY: number,
    world: WorldState,
  ) => SelectedObject | null
  /** Walk targets for named destinations (board, dashboard, etc.) */
  walkTargets: Record<string, { col: number; row: number }>
  /** Scene padding in tiles */
  padding: { left: number; right: number; top: number; bottom: number }
}
