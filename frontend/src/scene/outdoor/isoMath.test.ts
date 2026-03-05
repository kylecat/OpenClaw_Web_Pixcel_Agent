import { describe, it, expect } from 'vitest'
import {
  ISO_TILE_W,
  ISO_TILE_H,
  isoToScreen,
  screenToIso,
  screenToIsoTile,
  isoDepthSort,
} from './isoMath'

describe('isoToScreen / screenToIso round-trip', () => {
  const cases = [
    { col: 0, row: 0 },
    { col: 1, row: 0 },
    { col: 0, row: 1 },
    { col: 3, row: 5 },
    { col: 7, row: 2 },
    { col: 15, row: 11 },
  ]

  for (const { col, row } of cases) {
    it(`round-trip (${col}, ${row}) with default origin`, () => {
      const screen = isoToScreen(col, row)
      const grid = screenToIso(screen.x, screen.y)
      expect(grid.col).toBeCloseTo(col, 10)
      expect(grid.row).toBeCloseTo(row, 10)
    })
  }

  it('round-trip with custom origin', () => {
    const originX = 200
    const originY = 150
    const col = 4
    const row = 6
    const screen = isoToScreen(col, row, originX, originY)
    const grid = screenToIso(screen.x, screen.y, originX, originY)
    expect(grid.col).toBeCloseTo(col, 10)
    expect(grid.row).toBeCloseTo(row, 10)
  })
})

describe('isoToScreen specific values', () => {
  it('(0,0) maps to origin', () => {
    const { x, y } = isoToScreen(0, 0)
    expect(x).toBe(0)
    expect(y).toBe(0)
  })

  it('(1,0) moves right and down', () => {
    const { x, y } = isoToScreen(1, 0)
    expect(x).toBe(ISO_TILE_W / 2)
    expect(y).toBe(ISO_TILE_H / 2)
  })

  it('(0,1) moves left and down', () => {
    const { x, y } = isoToScreen(0, 1)
    expect(x).toBe(-ISO_TILE_W / 2)
    expect(y).toBe(ISO_TILE_H / 2)
  })

  it('(1,1) moves straight down', () => {
    const { x, y } = isoToScreen(1, 1)
    expect(x).toBe(0)
    expect(y).toBe(ISO_TILE_H)
  })
})

describe('screenToIsoTile snapping', () => {
  it('center of tile (0,0) snaps to (0,0)', () => {
    // Center of diamond at (0,0) is at screen (0, ISO_TILE_H/2)
    const { col, row } = screenToIsoTile(0, ISO_TILE_H / 2)
    expect(col).toBe(0)
    expect(row).toBe(0)
  })

  it('center of tile (2,3) snaps correctly', () => {
    const screen = isoToScreen(2, 3)
    // Offset slightly toward center of tile (not the top-center anchor)
    const { col, row } = screenToIsoTile(screen.x + 1, screen.y + ISO_TILE_H / 2)
    expect(col).toBe(2)
    expect(row).toBe(3)
  })
})

describe('isoDepthSort', () => {
  it('sorts by depth (col + row) ascending', () => {
    const items = [
      { col: 3, row: 3, id: 'far' },     // depth 6
      { col: 0, row: 0, id: 'nearest' },  // depth 0
      { col: 2, row: 1, id: 'mid' },      // depth 3
    ]
    const sorted = isoDepthSort(items)
    expect(sorted.map((i) => i.id)).toEqual(['nearest', 'mid', 'far'])
  })

  it('tie-breaks by row (larger row drawn later)', () => {
    const items = [
      { col: 3, row: 1, id: 'upper' },  // depth 4, row 1
      { col: 1, row: 3, id: 'lower' },  // depth 4, row 3
      { col: 2, row: 2, id: 'mid' },    // depth 4, row 2
    ]
    const sorted = isoDepthSort(items)
    expect(sorted.map((i) => i.id)).toEqual(['upper', 'mid', 'lower'])
  })

  it('does not mutate the original array', () => {
    const items = [
      { col: 2, row: 0 },
      { col: 0, row: 1 },
    ]
    const original = [...items]
    isoDepthSort(items)
    expect(items).toEqual(original)
  })

  it('handles empty array', () => {
    expect(isoDepthSort([])).toEqual([])
  })

  it('handles single item', () => {
    const items = [{ col: 5, row: 5 }]
    expect(isoDepthSort(items)).toEqual([{ col: 5, row: 5 }])
  })
})

describe('constants', () => {
  it('ISO_TILE_W is 64', () => {
    expect(ISO_TILE_W).toBe(64)
  })

  it('ISO_TILE_H is 32 (2:1 ratio)', () => {
    expect(ISO_TILE_H).toBe(32)
    expect(ISO_TILE_W / ISO_TILE_H).toBe(2)
  })
})
