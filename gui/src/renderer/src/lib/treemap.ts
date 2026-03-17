/**
 * Squarified treemap layout algorithm.
 *
 * Based on Bruls, Huizing, van Wijk (2000) "Squarified Treemaps".
 * Produces rectangles with aspect ratios as close to 1:1 as possible.
 */

export interface TreemapItem {
  name: string
  bytes: number
  category: string
  detail?: string
}

export interface TreemapRect {
  x: number
  y: number
  w: number
  h: number
  item: TreemapItem
}

/**
 * Layout items as a squarified treemap within the given dimensions.
 * Items with bytes <= 0 are filtered out.
 * Returns positioned rectangles filling the entire width x height area.
 */
export function layoutTreemap(
  items: TreemapItem[],
  width: number,
  height: number,
): TreemapRect[] {
  const filtered = items.filter((it) => it.bytes > 0)
  if (filtered.length === 0 || width <= 0 || height <= 0) return []

  const totalBytes = filtered.reduce((sum, it) => sum + it.bytes, 0)
  if (totalBytes <= 0) return []

  // Sort descending by size (squarified algorithm requires this)
  const sorted = [...filtered].sort((a, b) => b.bytes - a.bytes)

  // Normalize to area units
  const totalArea = width * height
  const areas = sorted.map((it) => (it.bytes / totalBytes) * totalArea)

  const rects: TreemapRect[] = []
  squarify(sorted, areas, { x: 0, y: 0, w: width, h: height }, rects)
  return rects
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function squarify(
  items: TreemapItem[],
  areas: number[],
  container: Rect,
  out: TreemapRect[],
): void {
  if (items.length === 0) return
  if (items.length === 1) {
    out.push({ x: container.x, y: container.y, w: container.w, h: container.h, item: items[0] })
    return
  }

  const { x, y, w, h } = container
  const shortSide = Math.min(w, h)
  const totalArea = areas.reduce((s, a) => s + a, 0)

  // Find the optimal row: add items until aspect ratio worsens
  let rowArea = 0
  let bestIdx = 0
  let bestWorst = Infinity

  for (let i = 0; i < items.length; i++) {
    rowArea += areas[i]
    const worst = worstAspect(areas.slice(0, i + 1), rowArea, shortSide)
    if (worst <= bestWorst) {
      bestWorst = worst
      bestIdx = i
    } else {
      break
    }
  }

  // Layout the chosen row
  const rowItems = items.slice(0, bestIdx + 1)
  const rowAreas = areas.slice(0, bestIdx + 1)
  const rowTotal = rowAreas.reduce((s, a) => s + a, 0)

  if (w >= h) {
    // Lay out row along the left edge (vertical strip)
    const stripWidth = totalArea > 0 ? rowTotal / h : 0
    let cy = y
    for (let i = 0; i < rowItems.length; i++) {
      const itemH = stripWidth > 0 ? rowAreas[i] / stripWidth : 0
      out.push({ x, y: cy, w: stripWidth, h: itemH, item: rowItems[i] })
      cy += itemH
    }
    // Recurse with remaining items in the remaining rectangle
    const remaining = { x: x + stripWidth, y, w: w - stripWidth, h }
    squarify(items.slice(bestIdx + 1), areas.slice(bestIdx + 1), remaining, out)
  } else {
    // Lay out row along the top edge (horizontal strip)
    const stripHeight = totalArea > 0 ? rowTotal / w : 0
    let cx = x
    for (let i = 0; i < rowItems.length; i++) {
      const itemW = stripHeight > 0 ? rowAreas[i] / stripHeight : 0
      out.push({ x: cx, y, w: itemW, h: stripHeight, item: rowItems[i] })
      cx += itemW
    }
    // Recurse with remaining items
    const remaining = { x, y: y + stripHeight, w, h: h - stripHeight }
    squarify(items.slice(bestIdx + 1), areas.slice(bestIdx + 1), remaining, out)
  }
}

/**
 * Worst aspect ratio in a row of items.
 * Lower is better (1.0 = perfect square).
 */
function worstAspect(rowAreas: number[], rowTotal: number, shortSide: number): number {
  if (shortSide <= 0 || rowTotal <= 0) return Infinity
  const s2 = shortSide * shortSide
  let worst = 0
  for (const area of rowAreas) {
    if (area <= 0) continue
    // aspect = max(w/h, h/w) for a rectangle with given area in the row
    const r1 = (s2 * area) / (rowTotal * rowTotal)
    const r2 = (rowTotal * rowTotal) / (s2 * area)
    worst = Math.max(worst, Math.max(r1, r2))
  }
  return worst
}
