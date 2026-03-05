import type { GridTile } from './sceneTypes'

function key(col: number, row: number): string {
  return `${col},${row}`
}

function isWalkable(
  col: number,
  row: number,
  grid: GridTile[][],
  blocked: Set<string>,
): boolean {
  const rows = grid.length
  const cols = rows > 0 ? grid[0].length : 0
  if (row < 0 || row >= rows || col < 0 || col >= cols) return false
  if (blocked.has(`${col},${row}`)) return false
  return true
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
  blocked: Set<string> = new Set(),
): Array<{ col: number; row: number }> {
  if (startCol === endCol && startRow === endRow) return []
  // Allow walking TO a blocked tile (e.g. standing in front of furniture)
  // but not THROUGH blocked tiles
  if (!isWalkable(endCol, endRow, grid, new Set())) return []

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
      if (visited.has(nk) || !isWalkable(nc, nr, grid, blocked)) continue
      visited.add(nk)
      parent.set(nk, currKey)
      queue.push({ col: nc, row: nr })
    }
  }

  return []
}
