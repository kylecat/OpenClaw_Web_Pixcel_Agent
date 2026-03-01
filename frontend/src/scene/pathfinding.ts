import type { GridTile } from './types'

function key(col: number, row: number): string {
  return `${col},${row}`
}

function isWalkable(col: number, row: number, grid: GridTile[][]): boolean {
  const rows = grid.length
  const cols = rows > 0 ? grid[0].length : 0
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false
  return true // all tiles are walkable in this MVP (no walls)
}

const DIRS = [
  { dc: 0, dr: -1 },
  { dc: 0, dr: 1 },
  { dc: -1, dr: 0 },
  { dc: 1, dr: 0 },
]

export function findPath(
  startCol: number,
  startRow: number,
  endCol: number,
  endRow: number,
  grid: GridTile[][],
): Array<{ col: number; row: number }> {
  if (startCol === endCol && startRow === endRow) return []
  if (!isWalkable(endCol, endRow, grid)) return []

  const startKey = key(startCol, startRow)
  const endKey = key(endCol, endRow)
  const visited = new Set<string>([startKey])
  const parent = new Map<string, string>()
  const queue: Array<{ col: number; row: number }> = [{ col: startCol, row: startRow }]

  while (queue.length > 0) {
    const curr = queue.shift()!
    const currKey = key(curr.col, curr.row)

    if (currKey === endKey) {
      const path: Array<{ col: number; row: number }> = []
      let k = endKey
      while (k !== startKey) {
        const [c, r] = k.split(',').map(Number)
        path.unshift({ col: c, row: r })
        k = parent.get(k)!
      }
      return path
    }

    for (const d of DIRS) {
      const nc = curr.col + d.dc
      const nr = curr.row + d.dr
      const nk = key(nc, nr)
      if (visited.has(nk) || !isWalkable(nc, nr, grid)) continue
      visited.add(nk)
      parent.set(nk, currKey)
      queue.push({ col: nc, row: nr })
    }
  }

  return []
}
