import { describe, it, expect } from 'vitest'
import { createOutdoorWorldState, OUTDOOR_COLS, OUTDOOR_ROWS, GAIA_OUTDOOR_HOME_COL, GAIA_OUTDOOR_HOME_ROW, CABIN_WALK_COL, CABIN_WALK_ROW, WEATHER_WALK_COL, WEATHER_WALK_ROW } from './outdoorWorldState'
import { findPath } from '../core/pathfinding'

describe('createOutdoorWorldState', () => {
  const world = createOutdoorWorldState()

  it('returns correct grid dimensions', () => {
    expect(world.cols).toBe(OUTDOOR_COLS)
    expect(world.rows).toBe(OUTDOOR_ROWS)
    expect(world.grid.length).toBe(OUTDOOR_ROWS)
    expect(world.grid[0].length).toBe(OUTDOOR_COLS)
  })

  it('has both characters', () => {
    expect(world.characters.has('gaia')).toBe(true)
    expect(world.characters.has('astraea')).toBe(true)
  })

  it('has decorations', () => {
    expect(world.decorations.length).toBeGreaterThan(0)
  })

  it('has blocked tiles (water + decorations)', () => {
    expect(world.blockedTiles.size).toBeGreaterThan(0)
  })

  it('water tiles are blocked', () => {
    // Row 11, col 0 should be water and blocked
    expect(world.grid[11][0].kind).toBe('WATER')
    expect(world.blockedTiles.has('0,11')).toBe(true)
  })

  it('grass tiles are walkable', () => {
    // Row 7, col 8 is a PATH (should not be in blocked)
    expect(world.blockedTiles.has('8,7')).toBe(false)
  })
})

describe('BFS pathfinding on outdoor grid', () => {
  const world = createOutdoorWorldState()

  it('Gaia can walk to cabin', () => {
    const path = findPath(
      GAIA_OUTDOOR_HOME_COL, GAIA_OUTDOOR_HOME_ROW,
      CABIN_WALK_COL, CABIN_WALK_ROW,
      world.grid,
      world.blockedTiles,
    )
    expect(path.length).toBeGreaterThan(0)
    const dest = path[path.length - 1]
    expect(dest.col).toBe(CABIN_WALK_COL)
    expect(dest.row).toBe(CABIN_WALK_ROW)
  })

  it('Gaia can walk to weather station', () => {
    const path = findPath(
      GAIA_OUTDOOR_HOME_COL, GAIA_OUTDOOR_HOME_ROW,
      WEATHER_WALK_COL, WEATHER_WALK_ROW,
      world.grid,
      world.blockedTiles,
    )
    expect(path.length).toBeGreaterThan(0)
    const dest = path[path.length - 1]
    expect(dest.col).toBe(WEATHER_WALK_COL)
    expect(dest.row).toBe(WEATHER_WALK_ROW)
  })

  it('cannot walk into water', () => {
    // Try to path into middle of river
    const path = findPath(
      GAIA_OUTDOOR_HOME_COL, GAIA_OUTDOOR_HOME_ROW,
      2, 11,  // water tile
      world.grid,
      world.blockedTiles,
    )
    expect(path.length).toBe(0)
  })

  it('Astraea can reach Gaia home', () => {
    const astraea = world.characters.get('astraea')!
    const path = findPath(
      astraea.col, astraea.row,
      GAIA_OUTDOOR_HOME_COL, GAIA_OUTDOOR_HOME_ROW,
      world.grid,
      world.blockedTiles,
    )
    expect(path.length).toBeGreaterThan(0)
  })
})
