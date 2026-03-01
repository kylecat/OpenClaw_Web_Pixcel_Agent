export type CharacterState = 'IDLE' | 'WALK'
export type Direction = 'UP' | 'DOWN' | 'LEFT' | 'RIGHT'
export type TileKind = 'FLOOR' | 'BOARD' | 'DASHBOARD'
export type DecorationKind =
  | 'desk' | 'plant' | 'bookshelf' | 'chair'
  | 'fridge' | 'squareTable' | 'clock'
  | 'shelf1' | 'shelf2' | 'pcDesk'
  | 'sofa1' | 'sofa2' | 'sofa3'
  | 'pot1' | 'pot2'
  | 'vendingMachine' | 'waterDispenser'

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
  frame: number   // current animation frame index (0–3)
}

export interface WorldState {
  grid: GridTile[][]   // [row][col]
  cols: number
  rows: number
  characters: Map<string, Character>
  decorations: Decoration[]
}
