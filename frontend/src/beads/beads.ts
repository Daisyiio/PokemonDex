import { MARD_PALETTE, MARD_NO_MAP, type MardColor } from './mard-palette'

export interface RGB {
  r: number
  g: number
  b: number
}

export interface BeadCell {
  color: MardColor | null
  x: number
  y: number
}

export interface BeadGrid {
  n: number
  cells: BeadCell[]
  used: MardColor[]
  counts: Record<string, number>
}

export interface DrawOptions {
  cell: number
  labels: boolean
  withLegend: boolean
  guides?: boolean
  /** 画布内部分辨率放大倍数（如 devicePixelRatio），逻辑坐标不变 */
  scale?: number
}

const ALPHA_THRESHOLD = 128

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片加载失败'))
    img.src = url
  })
}

export function cropImageToContent(
  img: HTMLImageElement,
  pad = 2
): string {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, w, h)

  let minX = w
  let minY = h
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return ''

  minX = Math.max(0, minX - pad)
  minY = Math.max(0, minY - pad)
  maxX = Math.min(w - 1, maxX + pad)
  maxY = Math.min(h - 1, maxY + pad)
  const cw = maxX - minX + 1
  const ch = maxY - minY + 1

  const side = Math.max(cw, ch)
  const out = document.createElement('canvas')
  out.width = side
  out.height = side
  const octx = out.getContext('2d')
  if (!octx) throw new Error('无法创建画布上下文')
  octx.drawImage(
    canvas,
    minX,
    minY,
    cw,
    ch,
    (side - cw) / 2,
    (side - ch) / 2,
    cw,
    ch
  )
  return out.toDataURL('image/png')
}

type SampleSource = HTMLImageElement | HTMLCanvasElement

function sourceSize(img: SampleSource): [number, number] {
  if (img instanceof HTMLImageElement) {
    return [img.naturalWidth || img.width, img.naturalHeight || img.height]
  }
  return [img.width, img.height]
}

// 降采样一次成工作副本，滑杆拖动时不再整幅读像素
export function createWorkingCanvas(
  img: HTMLImageElement,
  maxSide = 1024
): HTMLCanvasElement {
  const [w, h] = sourceSize(img)
  const scale = Math.min(1, maxSide / Math.max(w, h))
  const cw = Math.max(1, Math.round(w * scale))
  const ch = Math.max(1, Math.round(h * scale))
  const canvas = document.createElement('canvas')
  canvas.width = cw
  canvas.height = ch
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.drawImage(img, 0, 0, cw, ch)
  return canvas
}

export function sampleGrid(
  img: SampleSource,
  n: number
): (RGB | null)[] {
  const [w, h] = sourceSize(img)
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('无法创建画布上下文')
  ctx.drawImage(img, 0, 0)
  const { data } = ctx.getImageData(0, 0, w, h)

  const cells: {
    rs: number
    gs: number
    bs: number
    cnt: number
  }[] = new Array(n * n).fill(null)

  const stride = Math.max(1, Math.floor(Math.max(w, h) / (n * 4)))
  for (let sy = 0; sy < h; sy += stride) {
    const cy = Math.min(n - 1, Math.floor((sy / h) * n))
    const row = cy * n
    for (let sx = 0; sx < w; sx += stride) {
      const idx = (sy * w + sx) * 4
      if (data[idx + 3] < ALPHA_THRESHOLD) continue
      const cx = Math.min(n - 1, Math.floor((sx / w) * n))
      const cell = cells[row + cx]
      if (!cell) {
        cells[row + cx] = {
          rs: data[idx],
          gs: data[idx + 1],
          bs: data[idx + 2],
          cnt: 1,
        }
      } else {
        cell.rs += data[idx]
        cell.gs += data[idx + 1]
        cell.bs += data[idx + 2]
        cell.cnt++
      }
    }
  }

  const grid = cells.map((c) =>
    c
      ? {
          r: Math.round(c.rs / c.cnt),
          g: Math.round(c.gs / c.cnt),
          b: Math.round(c.bs / c.cnt),
        }
      : null
  )

  // 填补图案内部的空白格（大网格下像素图 1px 缝隙/跳格会导致空洞切断内容物）
  fillInteriorHoles(grid, n)
  return grid
}

const ORTHO_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
]
const DIAG_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [1, -1],
  [-1, 1],
  [1, 1],
]

function fillInteriorHoles(grid: (RGB | null)[], n: number): void {
  const idx = (x: number, y: number) => y * n + x
  const inBounds = (x: number, y: number) => x >= 0 && x < n && y >= 0 && y < n

  for (let iter = 0; iter < 3; iter++) {
    const fills: { i: number; color: RGB }[] = []
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = idx(x, y)
        if (grid[i]) continue

        let orthoCnt = 0
        let totalCnt = 0
        let rs = 0
        let gs = 0
        let bs = 0
        for (const [dx, dy] of ORTHO_OFFSETS) {
          const nx = x + dx
          const ny = y + dy
          if (!inBounds(nx, ny)) continue
          const nb = grid[idx(nx, ny)]
          if (nb) {
            orthoCnt++
            totalCnt++
            rs += nb.r
            gs += nb.g
            bs += nb.b
          }
        }
        for (const [dx, dy] of DIAG_OFFSETS) {
          const nx = x + dx
          const ny = y + dy
          if (!inBounds(nx, ny)) continue
          const nb = grid[idx(nx, ny)]
          if (nb) {
            totalCnt++
            rs += nb.r
            gs += nb.g
            bs += nb.b
          }
        }

        // 正交邻居 ≥2 且周围有一定覆盖才判定为图案内部空洞（避免侵蚀外轮廓/背景）
        if (orthoCnt >= 2 && totalCnt >= 4) {
          fills.push({
            i,
            color: {
              r: Math.round(rs / totalCnt),
              g: Math.round(gs / totalCnt),
              b: Math.round(bs / totalCnt),
            },
          })
        }
      }
    }
    if (fills.length === 0) break
    for (const f of fills) grid[f.i] = f.color
  }
}

export function nearestColor(rgb: RGB): MardColor {
  let best: MardColor | null = null
  let bestDist = Infinity
  for (const c of MARD_PALETTE) {
    const d = colorDist(rgb, { r: c.rgb[0], g: c.rgb[1], b: c.rgb[2] })
    if (d < bestDist) {
      bestDist = d
      best = c
    }
  }
  return best!
}

// RGB → 最接近色号的小型 LRU 缓存，网格量化高频命中同一批颜色
const NEAREST_CACHE_MAX = 8192
const nearestCache = new Map<number, MardColor>()

function nearestColorCached(rgb: RGB): MardColor {
  const key = (rgb.r << 16) | (rgb.g << 8) | rgb.b
  const hit = nearestCache.get(key)
  if (hit) return hit
  const color = nearestColor(rgb)
  if (nearestCache.size >= NEAREST_CACHE_MAX) {
    const first = nearestCache.keys().next().value as number | undefined
    if (first !== undefined) nearestCache.delete(first)
  }
  nearestCache.set(key, color)
  return color
}

function colorDist(a: RGB, b: RGB): number {
  const rmean = (a.r + b.r) / 2
  const dr = a.r - b.r
  const dg = a.g - b.g
  const db = a.b - b.b
  return (
    (2 + rmean / 256) * dr * dr +
    4 * dg * dg +
    (2 + (255 - rmean) / 256) * db * db
  )
}

export interface BuildGridOptions {
  outline?: boolean
  outlineThickness?: number
  outlineColor?: MardColor
}

export function buildGrid(
  rgbGrid: (RGB | null)[],
  n: number,
  opts?: BuildGridOptions
): BeadGrid {
  {
    const useOutline = !!opts?.outline
    const thickness = Math.max(1, Math.min(3, Math.round(opts?.outlineThickness || 1)))
    const outlineColor = opts?.outlineColor || MARD_NO_MAP['H7'] || MARD_PALETTE[0]

    // 第一步：先按正常量化出基础内容层
    const content: (MardColor | null)[] = new Array(n * n)
    for (let i = 0; i < n * n; i++) {
      const rgb = rgbGrid[i]
      content[i] = rgb ? nearestColorCached(rgb) : null
    }

    let colors = content
    if (useOutline) {
      // 第二步：从内容轮廓逐层向外扩张，描边豆紧贴内容物
      const filled: boolean[] = content.map((c) => c !== null)
      const result: (MardColor | null)[] = [...content]
      for (let layer = 0; layer < thickness; layer++) {
        const frontier: [number, number][] = []
        for (let y = 0; y < n; y++) {
          for (let x = 0; x < n; x++) {
            if (filled[y * n + x]) continue
            const hasNeighborColor =
              (x > 0 && filled[y * n + x - 1]) ||
              (x < n - 1 && filled[y * n + x + 1]) ||
              (y > 0 && filled[(y - 1) * n + x]) ||
              (y < n - 1 && filled[(y + 1) * n + x])
            if (hasNeighborColor) frontier.push([x, y])
          }
        }
        for (const [x, y] of frontier) {
          filled[y * n + x] = true
          result[y * n + x] = outlineColor
        }
        if (frontier.length === 0) break
      }
      colors = result
    }

    const cells: BeadCell[] = new Array(n * n)
    const counts: Record<string, number> = {}
    const usedSet = new Set<string>()

    for (let i = 0; i < n * n; i++) {
      const color = colors[i]
      cells[i] = { color, x: i % n, y: Math.floor(i / n) }
      if (color) {
        counts[color.no] = (counts[color.no] || 0) + 1
        usedSet.add(color.no)
      }
    }

    const used = MARD_PALETTE.filter((c) => usedSet.has(c.no)).sort(
      (a, b) =>
        a.series.localeCompare(b.series) ||
        parseInt(a.no.slice(1), 10) - parseInt(b.no.slice(1), 10)
    )

    return { n, cells, used, counts }
  }
}

export function drawPattern(
  canvas: HTMLCanvasElement,
  grid: BeadGrid,
  opts: DrawOptions
): void {
  const n = grid.n
  const cell = opts.cell
  const gridPx = n * cell
  const pad = 16
  const headH = 44

  const legend = opts.withLegend ? grid.used : []
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')

  let colW = 96
  if (legend.length) {
    ctx.font = '600 14px sans-serif'
    let maxTextW = 0
    for (const c of legend) {
      const text = `${c.no} ×${grid.counts[c.no] || 0}`
      const w = ctx.measureText(text).width
      if (w > maxTextW) maxTextW = w
    }
    colW = Math.max(96, Math.ceil(maxTextW) + 30 + 16)
  }
  const cols = Math.max(1, Math.floor(gridPx / colW))
  const legendRows = Math.ceil(legend.length / cols)
  const legendH = legend.length ? 28 + legendRows * 32 + 8 : 0

  const scale = opts.scale ?? 1
  const logW = gridPx + pad * 2
  const logH = headH + gridPx + pad * 2 + legendH + 14
  canvas.width = Math.round(logW * scale)
  canvas.height = Math.round(logH * scale)
  if (scale !== 1) ctx.scale(scale, scale)

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, logW, logH)

  ctx.fillStyle = '#111111'
  ctx.font = '700 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    `拼豆图纸 · ${n}×${n} 格 · Mard 色号`,
    logW / 2,
    22
  )

  const originX = pad
  const originY = headH + pad

  ctx.imageSmoothingEnabled = true
  for (const c of grid.cells) {
    const px = originX + c.x * cell
    const py = originY + c.y * cell
    if (c.color) {
      ctx.fillStyle = `rgb(${c.color.rgb[0]},${c.color.rgb[1]},${c.color.rgb[2]})`
      ctx.fillRect(px, py, cell, cell)
    }
  }

  if (opts.labels) {
    ctx.font = `700 ${Math.round(cell * 0.52)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    for (const c of grid.cells) {
      if (!c.color) continue
      const px = originX + c.x * cell
      const py = originY + c.y * cell
      const [r, g, b] = c.color.rgb
      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255
      ctx.fillStyle = lum > 0.55 ? '#1a1a1a' : '#ffffff'
      ctx.fillText(c.color.no, px + cell / 2, py + cell / 2 + 0.5)
    }
  }

  ctx.strokeStyle = '#00000022'
  ctx.lineWidth = 1
  ctx.beginPath()
  for (let i = 0; i <= n; i++) {
    const x = originX + i * cell
    ctx.moveTo(x, originY)
    ctx.lineTo(x, originY + gridPx)
    const y = originY + i * cell
    ctx.moveTo(originX, y)
    ctx.lineTo(originX + gridPx, y)
  }
  ctx.stroke()

  if (opts.guides) {
    const step = n <= 32 ? 5 : 10
    ctx.strokeStyle = '#00000066'
    ctx.lineWidth = 2
    ctx.beginPath()
    for (let i = 0; i <= n; i += step) {
      const x = originX + i * cell
      ctx.moveTo(x, originY)
      ctx.lineTo(x, originY + gridPx)
      const y = originY + i * cell
      ctx.moveTo(originX, y)
      ctx.lineTo(originX + gridPx, y)
    }
    ctx.stroke()
  }

  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 2
  ctx.strokeRect(originX - 0.5, originY - 0.5, gridPx + 1, gridPx + 1)

  if (legend.length) {
    ctx.font = '600 14px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    legend.forEach((c, i) => {
      const x = pad + (i % cols) * colW
      const y = originY + gridPx + 28 + Math.floor(i / cols) * 32
      ctx.fillStyle = `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})`
      ctx.fillRect(x, y - 11, 22, 22)
      ctx.strokeStyle = '#00000044'
      ctx.lineWidth = 1
      ctx.strokeRect(x, y - 11, 22, 22)
      ctx.fillStyle = '#111111'
      ctx.fillText(
        `${c.no} ×${grid.counts[c.no] || 0}`,
        x + 30,
        y + 1
      )
    })
  }
}

export function exportPNG(canvas: HTMLCanvasElement, filename: string): void {
  const a = document.createElement('a')
  a.href = canvas.toDataURL('image/png')
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}
