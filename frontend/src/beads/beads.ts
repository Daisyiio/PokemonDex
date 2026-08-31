import { MARD_PALETTE, type MardColor } from './mard-palette'

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

export function sampleGrid(
  img: HTMLImageElement,
  n: number
): (RGB | null)[] {
  const w = img.naturalWidth || img.width
  const h = img.naturalHeight || img.height
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

  return cells.map((c) =>
    c
      ? {
          r: Math.round(c.rs / c.cnt),
          g: Math.round(c.gs / c.cnt),
          b: Math.round(c.bs / c.cnt),
        }
      : null
  )
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

export function buildGrid(rgbGrid: (RGB | null)[], n: number): BeadGrid {
  const cells: BeadCell[] = new Array(n * n)
  const counts: Record<string, number> = {}
  const usedSet = new Set<string>()

  for (let i = 0; i < n * n; i++) {
    const rgb = rgbGrid[i]
    const color = rgb ? nearestColor(rgb) : null
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
  const colW = 96
  const cols = Math.max(1, Math.floor(gridPx / colW))
  const legendRows = Math.ceil(legend.length / cols)
  const legendH = legend.length ? 26 + legendRows * 30 : 0

  canvas.width = gridPx + pad * 2
  canvas.height = headH + gridPx + pad * 2 + legendH + 14

  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法创建画布上下文')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.fillStyle = '#111111'
  ctx.font = '700 18px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(
    `拼豆图纸 · ${n}×${n} 格 · Mard 色号`,
    canvas.width / 2,
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

  if (opts.labels && cell >= 9) {
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

  ctx.strokeStyle = '#000000'
  ctx.lineWidth = 2
  ctx.strokeRect(originX - 0.5, originY - 0.5, gridPx + 1, gridPx + 1)

  if (legend.length) {
    ctx.font = '600 13px sans-serif'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    legend.forEach((c, i) => {
      const x = pad + (i % cols) * colW
      const y = originY + gridPx + 26 + Math.floor(i / cols) * 30
      ctx.fillStyle = `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})`
      ctx.fillRect(x, y - 10, 20, 20)
      ctx.strokeStyle = '#00000044'
      ctx.lineWidth = 1
      ctx.strokeRect(x, y - 10, 20, 20)
      ctx.fillStyle = '#111111'
      ctx.fillText(
        `${c.no} ×${grid.counts[c.no] || 0}`,
        x + 28,
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
