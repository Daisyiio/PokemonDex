<script setup lang="ts">
import { computed, nextTick, onActivated, onBeforeUnmount, onDeactivated, onMounted, reactive, ref, watch } from 'vue'
import { listPokemon, getPokemonSpritesIndex, type ListParams, type PokemonSprites } from '../api'
import type { PokemonSummary } from '../types'
import { imageUrl } from '../types'
import { MARD_PALETTE, MARD_NO_MAP } from '../beads/mard-palette'
import {
  buildGrid,
  createWorkingCanvas,
  cropImageToContent,
  drawPattern,
  exportPNG,
  loadImageFromFile,
  loadImageFromUrl,
  sampleGrid,
  type BeadGrid,
} from '../beads/beads'
import { useScrollMemory } from '../composables/useScrollMemory'

useScrollMemory()

onMounted(loadSpritesIndex)

const gridN = ref(32)
const showLabels = ref(true)
const showGuides = ref(true)
const showOutline = ref(false)
const outlineThickness = ref(1)
const outlineColorNo = ref('H7')
const dragging = ref(false)
const errorMsg = ref('')

const sourceImg = ref<HTMLImageElement | null>(null)
const workImg = ref<HTMLCanvasElement | null>(null)
const sourceName = ref('')
const grid = ref<BeadGrid | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const canvasWrapEl = ref<HTMLDivElement | null>(null)
const previewVisible = ref(false)

const totalBeads = computed(() => gridN.value * gridN.value)
const placedBeads = computed(() => {
  const g = grid.value
  if (!g) return 0
  return g.cells.filter((c) => c.color).length
})

// ---- 豆子描边 ----
const OUTLINE_COMMON: { no: string; label: string }[] = [
  { no: 'H7', label: '黑' },
  { no: 'H6', label: '深灰' },
  { no: 'H5', label: '中灰' },
  { no: 'F4', label: '红' },
  { no: 'D8', label: '浅紫' },
  { no: 'C8', label: '蓝' },
  { no: 'M12', label: '深棕' },
  { no: 'A7', label: '橙' },
]
const outlineColorObj = computed(() => MARD_NO_MAP[outlineColorNo.value])

// ---- 本地上传 / 拖拽 / 粘贴 ----
const fileInput = ref<HTMLInputElement | null>(null)

function pickFile() {
  fileInput.value?.click()
}

function onDropZoneKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    pickFile()
  }
}

function setSource(img: HTMLImageElement, name: string) {
  sourceImg.value = img
  workImg.value = createWorkingCanvas(img)
  sourceName.value = name
  previewVisible.value = true
}

async function handleFile(file: File | undefined | null) {
  if (!file) return
  if (!file.type.startsWith('image/')) {
    errorMsg.value = '请选择图片文件'
    return
  }
  errorMsg.value = ''
  try {
    setSource(await loadImageFromFile(file), file.name)
  } catch {
    errorMsg.value = '图片读取失败'
  }
}

function onDrop(e: DragEvent) {
  dragging.value = false
  const file = e.dataTransfer?.files?.[0]
  handleFile(file)
}

function onPaste(e: ClipboardEvent) {
  const items = e.clipboardData?.items
  if (!items) return
  for (const it of items) {
    if (it.type.startsWith('image/')) {
      const file = it.getAsFile()
      if (file) {
        handleFile(file)
        return
      }
    }
  }
}

// ---- 宝可梦素材 ----
const pokeSearch = ref('')
const pokeResults = ref<PokemonSummary[]>([])
const searching = ref(false)
const selectedPoke = ref<PokemonSummary | null>(null)
const pokeLoading = ref(false)
let searchTimer: number | undefined

type PokeSource = 'pixel' | 'official' | 'home' | 'dream'

const pokeSources: { id: PokeSource; label: string }[] = [
  { id: 'pixel', label: '像素图标' },
  { id: 'official', label: '官方立绘' },
  { id: 'home', label: 'Home' },
  { id: 'dream', label: '梦世界' },
]
const pokeSource = ref<PokeSource>('pixel')
const POKE_SOURCE_NEEDS_CROP: Record<PokeSource, boolean> = {
  pixel: true,
  official: false,
  home: false,
  dream: false,
}

const spritesIndex = ref<Record<string, PokemonSprites>>({})

async function loadSpritesIndex() {
  if (Object.keys(spritesIndex.value).length) return
  try {
    spritesIndex.value = await getPokemonSpritesIndex()
  } catch {
    /* keep empty */
  }
}

function pokeThumb(p: PokemonSummary, src: PokeSource): string {
  const sprites = spritesIndex.value[p.id]
  return sprites?.[src] || sprites?.official || imageUrl('official', p.image)
}

const thumbCache = reactive(new Map<string, string>())
const THUMB_CACHE_MAX = 200
const thumbKey = (p: PokemonSummary, src: PokeSource) => `${src}:${p.id}`

function cacheThumb(key: string, dataUrl: string) {
  if (thumbCache.has(key)) thumbCache.delete(key)
  thumbCache.set(key, dataUrl)
  if (thumbCache.size > THUMB_CACHE_MAX) {
    const oldest = thumbCache.keys().next().value
    if (oldest !== undefined) thumbCache.delete(oldest)
  }
}

// 并发裁剪池：同一时间最多 3 个任务
let cropQueue: (() => Promise<void>)[] = []
let cropRunning = 0
const CROP_CONCURRENCY = 3

async function runCropQueue() {
  while (cropRunning < CROP_CONCURRENCY && cropQueue.length) {
    const task = cropQueue.shift()!
    cropRunning++
    try {
      await task()
    } catch {
      /* ignore */
    } finally {
      cropRunning--
      runCropQueue()
    }
  }
}

async function croppedThumb(p: PokemonSummary): Promise<void> {
  const src = pokeSource.value
  const key = thumbKey(p, src)
  if (thumbCache.has(key) || !POKE_SOURCE_NEEDS_CROP[src]) return

  const task = async () => {
    try {
      const img = await loadImageFromUrl(pokeThumb(p, src))
      const cropped = cropImageToContent(img, 2)
      if (cropped) cacheThumb(key, cropped)
    } catch {
      /* keep original */
    }
  }
  cropQueue.push(task)
  runCropQueue()
}

function thumbSrc(p: PokemonSummary): string {
  const src = pokeSource.value
  return thumbCache.get(thumbKey(p, src)) ?? pokeThumb(p, src)
}

let searchSeq = 0

async function searchPoke() {
  searching.value = true
  const params: ListParams = { pageSize: 60 }
  if (pokeSearch.value.trim()) params.search = pokeSearch.value.trim()
  const mySeq = ++searchSeq
  try {
    const res = await listPokemon(params)
    if (mySeq !== searchSeq) return
    pokeResults.value = res.items
  } catch {
    if (mySeq === searchSeq) pokeResults.value = []
  } finally {
    if (mySeq === searchSeq) searching.value = false
  }
}

function onSearchInput() {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(searchPoke, 250)
}

function switchPokeSource(src: PokeSource) {
  if (pokeSource.value === src) return
  pokeSource.value = src
  reObserveAllImgs()
}

async function selectPoke(p: PokemonSummary) {
  selectedPoke.value = p
  errorMsg.value = ''
  pokeLoading.value = true
  try {
    if (POKE_SOURCE_NEEDS_CROP[pokeSource.value]) await croppedThumb(p)
    const src = thumbCache.get(thumbKey(p, pokeSource.value)) ?? pokeThumb(p, pokeSource.value)
    setSource(await loadImageFromUrl(src), `#${p.id} ${p.nameZh}`)
  } catch {
    errorMsg.value = '像素素材加载失败'
  } finally {
    pokeLoading.value = false
  }
}

// ---- 视口懒加载 ----
let gridObserver: IntersectionObserver | null = null

function getObserver(): IntersectionObserver {
  if (gridObserver) return gridObserver
  gridObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const target = e.target as HTMLElement
          const id = target.dataset.pokeId
          if (id) {
            const p = pokeResults.value.find((x) => x.id === id)
            if (p) croppedThumb(p)
            gridObserver?.unobserve(e.target)
          }
        }
      }
    },
    { rootMargin: '120px' }
  )
  return gridObserver
}

function observePokeImg(el: Element | null, p: PokemonSummary) {
  const target = el as HTMLElement | null
  if (!target || !POKE_SOURCE_NEEDS_CROP[pokeSource.value]) return
  target.setAttribute('data-poke-id', p.id)
  getObserver().observe(target)
}

function reObserveAllImgs() {
  if (!POKE_SOURCE_NEEDS_CROP[pokeSource.value]) return
  gridObserver?.disconnect()
  gridObserver = null
  // 断连后重新观察当前所有图片，视口内的会立即触发裁剪
  pokeResults.value.forEach((p) => {
    const el = document.querySelector(`[data-poke-id="${p.id}"]`)
    if (el) getObserver().observe(el)
  })
}

function resetGridObserver() {
  gridObserver?.disconnect()
  gridObserver = null
}

// ---- 生成图纸 ----
const viewMode = ref<'fit' | 'actual'>('fit')

function previewCell(): number {
  const wrapW = canvasWrapEl.value?.clientWidth ?? 800
  if (viewMode.value === 'actual') {
    const isMobile = window.innerWidth <= 640
    return isMobile ? 16 : 24
  }
  const avail = wrapW - 48
  return Math.max(4, Math.floor(avail / gridN.value))
}

function renderGrid() {
  const img = workImg.value ?? sourceImg.value
  if (!img || !canvasEl.value) return
  try {
    const rgbGrid = sampleGrid(img, gridN.value)
    grid.value = buildGrid(rgbGrid, gridN.value, {
      outline: showOutline.value,
      outlineThickness: outlineThickness.value,
      outlineColor: outlineColorObj.value,
    })
    drawPattern(canvasEl.value, grid.value, {
      cell: previewCell(),
      labels: showLabels.value,
      withLegend: true,
      guides: showGuides.value,
      // 适应宽度时按 dpr 渲染，高分屏更锐利；100% 视图保持 1:1
      scale: viewMode.value === 'actual' ? 1 : window.devicePixelRatio || 1,
    })
  } catch {
    grid.value = null
    errorMsg.value = '图纸生成失败'
  }
}

let renderRaf = 0

// 拖动滑杆等高频变化时按 rAF 合并重绘
function scheduleRender() {
  if (renderRaf) return
  renderRaf = requestAnimationFrame(() => {
    renderRaf = 0
    renderGrid()
  })
}

watch([sourceImg, gridN, showLabels, showGuides, showOutline, outlineThickness, outlineColorNo, viewMode], scheduleRender, { flush: 'post' })

// ---- 导出 ----
function onExport() {
  const g = grid.value
  if (!g) return
  const canvas = document.createElement('canvas')
  const cell = gridN.value > 40 ? 16 : 28
  drawPattern(canvas, g, {
    cell,
    labels: showLabels.value,
    withLegend: true,
    guides: showGuides.value,
  })
  const name = sourceName.value.replace(/[\\/:*?"<>|]/g, '_') || 'beads'
  exportPNG(canvas, `拼豆图纸-${name}-${gridN.value}格.png`)
}

// ---- 点击放大预览（lightbox）----
const lightboxOpen = ref(false)
const lightboxZoom = ref(1)
const lightboxEl = ref<HTMLCanvasElement | null>(null)
const LIGHTBOX_MAX_ZOOM = 8

function renderLightbox() {
  const g = grid.value
  if (!g || !lightboxEl.value) return
  const cell = gridN.value > 40 ? 16 : 28
  drawPattern(lightboxEl.value, g, {
    cell,
    labels: showLabels.value,
    withLegend: true,
    guides: showGuides.value,
  })
}

function openLightbox() {
  if (!grid.value) return
  lensVisible.value = false
  lightboxZoom.value = 1
  lightboxOpen.value = true
  nextTick(renderLightbox)
}

function closeLightbox() {
  lightboxOpen.value = false
}

function zoomLightbox(delta: number) {
  lightboxZoom.value = Math.min(
    LIGHTBOX_MAX_ZOOM,
    Math.max(1, Math.round(lightboxZoom.value * delta * 2) / 2)
  )
}

// ---- 弹层拖拽平移 ----
const lightboxStageEl = ref<HTMLDivElement | null>(null)
const lbDragging = ref(false)
let lbDragStartX = 0
let lbDragStartY = 0
let lbScrollStartX = 0
let lbScrollStartY = 0

function onStagePointerDown(e: PointerEvent) {
  const stage = lightboxStageEl.value
  if (!stage) return
  lbDragging.value = true
  lbDragStartX = e.clientX
  lbDragStartY = e.clientY
  lbScrollStartX = stage.scrollLeft
  lbScrollStartY = stage.scrollTop
  try {
    stage.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
}

function onStagePointerMove(e: PointerEvent) {
  if (!lbDragging.value) return
  const stage = lightboxStageEl.value
  if (!stage) return
  stage.scrollLeft = lbScrollStartX - (e.clientX - lbDragStartX)
  stage.scrollTop = lbScrollStartY - (e.clientY - lbDragStartY)
}

function onStagePointerUp() {
  lbDragging.value = false
}

function resetLightboxView() {
  lightboxZoom.value = 1
}

// 滚轮缩放（以光标为中心），拖拽负责平移
function onStageWheel(e: WheelEvent) {
  const stage = lightboxStageEl.value
  if (!stage) return
  e.preventDefault()
  const oldZoom = lightboxZoom.value
  let factor = Math.pow(2, -e.deltaY * 0.001)
  factor = Math.min(2, Math.max(0.5, factor))
  const newZoom = Math.min(LIGHTBOX_MAX_ZOOM, Math.max(1, oldZoom * factor))
  if (newZoom === oldZoom) return
  const rect = stage.getBoundingClientRect()
  const px = e.clientX - rect.left
  const py = e.clientY - rect.top
  const ratio = newZoom / oldZoom
  lightboxZoom.value = newZoom
  nextTick(() => {
    stage.scrollLeft = (stage.scrollLeft + px) * ratio - px
    stage.scrollTop = (stage.scrollTop + py) * ratio - py
  })
}

watch(
  [grid, gridN, showLabels, showGuides, showOutline, outlineThickness, outlineColorNo],
  () => {
    if (lightboxOpen.value) renderLightbox()
  }
)

// ---- 悬停放大镜 ----
const lensVisible = ref(false)
const lensStyle = ref({ left: '0px', top: '0px' })
const lensEl = ref<HTMLCanvasElement | null>(null)
const LENS_PX = 180
const LENS_MAG = 3

let lensRaf = 0
let lensSrcX = 0
let lensSrcY = 0

function drawLens() {
  lensRaf = 0
  const canvas = canvasEl.value
  const lens = lensEl.value
  if (!canvas || !lens) return
  const ctx = lens.getContext('2d')
  if (!ctx) return
  const sw = Math.min(LENS_PX / LENS_MAG, canvas.width)
  const sh = Math.min(LENS_PX / LENS_MAG, canvas.height)
  const sx = Math.min(Math.max(0, lensSrcX - sw / 2), canvas.width - sw)
  const sy = Math.min(Math.max(0, lensSrcY - sh / 2), canvas.height - sh)
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, LENS_PX, LENS_PX)
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(canvas, sx, sy, sw, sh, 0, 0, LENS_PX, LENS_PX)
}

function onCanvasMove(e: MouseEvent) {
  const canvas = canvasEl.value
  const wrap = canvasWrapEl.value
  if (!canvas || !wrap || !grid.value) return
  const rect = canvas.getBoundingClientRect()
  if (rect.width === 0 || rect.height === 0) return
  lensSrcX = ((e.clientX - rect.left) / rect.width) * canvas.width
  lensSrcY = ((e.clientY - rect.top) / rect.height) * canvas.height

  const wrapRect = wrap.getBoundingClientRect()
  let left = e.clientX - wrapRect.left + 18
  let top = e.clientY - wrapRect.top - LENS_PX / 2
  const maxLeft = Math.max(0, wrapRect.width - LENS_PX - 8)
  const maxTop = Math.max(0, wrapRect.height - LENS_PX - 8)
  left = Math.max(4, Math.min(left, maxLeft))
  top = Math.max(4, Math.min(top, maxTop))
  lensStyle.value = { left: `${left}px`, top: `${top}px` }
  lensVisible.value = true

  if (!lensRaf) {
    lensRaf = requestAnimationFrame(drawLens)
  }
}

function hideLens() {
  lensVisible.value = false
}

// ---- 键盘粘贴事件 ----
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && lightboxOpen.value) closeLightbox()
}

let resizeTimer: number | undefined
function onResize() {
  window.clearTimeout(resizeTimer)
  resizeTimer = window.setTimeout(scheduleRender, 150)
}

onActivated(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('paste', onPaste)
  window.addEventListener('resize', onResize)
})

onDeactivated(() => {
  window.clearTimeout(searchTimer)
  window.clearTimeout(resizeTimer)
  if (renderRaf) cancelAnimationFrame(renderRaf)
  if (lensRaf) cancelAnimationFrame(lensRaf)
  renderRaf = 0
  lensRaf = 0
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('paste', onPaste)
  window.removeEventListener('resize', onResize)
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
  window.clearTimeout(resizeTimer)
  if (renderRaf) cancelAnimationFrame(renderRaf)
  if (lensRaf) cancelAnimationFrame(lensRaf)
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('paste', onPaste)
  window.removeEventListener('resize', onResize)
  resetGridObserver()
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>拼豆图纸</h1>
      <div class="page-total">图片 → Mard 色号网格图纸</div>
    </div>

    <div class="layout">
      <div class="side">
        <section class="panel">
          <h2 class="panel-title">图片来源</h2>

          <div
            class="drop-zone"
            :class="{ on: dragging }"
            role="button"
            tabindex="0"
            @click="pickFile"
            @keydown="onDropZoneKeydown"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="onDrop"
          >
            <svg class="dz-icon" viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
              <path d="M12 16V4M7 9l5-5 5 5" />
              <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            <div class="dz-title">上传 / 拖拽 / 粘贴图片</div>
            <div class="dz-sub">支持 PNG、JPG、GIF · 点击选择文件</div>
            <input
              ref="fileInput"
              type="file"
              accept="image/*"
              class="dz-input"
              @change="handleFile(($event.target as HTMLInputElement).files?.[0])"
            />
          </div>

          <div class="poke-block">
            <div class="poke-label">或选择宝可梦素材</div>
            <div class="src-chips">
              <button
                v-for="s in pokeSources"
                :key="s.id"
                class="src-chip"
                :class="{ on: pokeSource === s.id }"
                @click="switchPokeSource(s.id)"
              >
                {{ s.label }}
              </button>
            </div>
            <input
              v-model="pokeSearch"
              class="poke-search"
              type="text"
              placeholder="搜索宝可梦编号 / 名称"
              @input="onSearchInput"
              @keyup.enter="searchPoke"
            />
            <div class="poke-grid" :class="{ loading: pokeLoading, pixel: pokeSource === 'pixel' }">
              <button
                v-for="p in pokeResults"
                :key="p.id"
                class="poke-item"
                :class="{ on: selectedPoke?.id === p.id }"
                @click="selectPoke(p)"
              >
                <img :ref="(el: unknown) => observePokeImg(el as Element | null, p)" :src="thumbSrc(p)" :alt="p.nameZh" loading="lazy" />
                <span class="poke-id">#{{ p.id }}</span>
                <span class="poke-name">{{ p.nameZh }}</span>
              </button>
              <div v-if="searching" class="poke-empty">搜索中…</div>
              <div v-else-if="!pokeResults.length" class="poke-empty">输入关键字开始搜索</div>
            </div>
          </div>
        </section>

        <section class="panel">
          <h2 class="panel-title">图纸参数</h2>
          <div class="param-row">
            <span class="param-label">网格大小（珠子数）</span>
            <span class="param-value">{{ gridN }}×{{ gridN }}</span>
          </div>
          <input
            v-model.number="gridN"
            class="range"
            type="range"
            min="8"
            max="128"
            step="1"
          />
          <div class="param-row">
            <span class="param-label">格子内标注色号</span>
            <button
              class="switch"
              :class="{ on: showLabels }"
              @click="showLabels = !showLabels"
            >
              <span class="switch-knob"></span>
            </button>
          </div>
          <div class="param-row">
            <span class="param-label">定位辅助线（每 5/10 格）</span>
            <button
              class="switch"
              :class="{ on: showGuides }"
              @click="showGuides = !showGuides"
            >
              <span class="switch-knob"></span>
            </button>
          </div>
          <div class="param-row">
            <span class="param-label">豆子描边</span>
            <button
              class="switch"
              :class="{ on: showOutline }"
              @click="showOutline = !showOutline"
            >
              <span class="switch-knob"></span>
            </button>
          </div>
          <template v-if="showOutline">
            <div class="param-row">
              <span class="param-label">描边厚度</span>
              <div class="thick-btns">
                <button
                  v-for="t in [1, 2, 3]"
                  :key="t"
                  class="thick-btn"
                  :class="{ on: outlineThickness === t }"
                  @click="outlineThickness = t"
                >
                  {{ t }} 圈
                </button>
              </div>
            </div>
            <div class="param-row">
              <span class="param-label">描边颜色</span>
              <select v-model="outlineColorNo" class="outline-select">
                <optgroup label="常用">
                  <option v-for="c in OUTLINE_COMMON" :key="c.no" :value="c.no">
                    {{ c.no }} · {{ c.label }}
                  </option>
                </optgroup>
                <optgroup label="全部 Mard 色">
                  <option v-for="c in MARD_PALETTE" :key="c.no" :value="c.no">
                    {{ c.no }} · {{ c.seriesName }}
                  </option>
                </optgroup>
              </select>
              <span
                v-if="outlineColorObj"
                class="outline-swatch"
                :style="{ background: `rgb(${outlineColorObj.rgb[0]},${outlineColorObj.rgb[1]},${outlineColorObj.rgb[2]})` }"
              ></span>
            </div>
          </template>
        </section>

        <button class="export-btn" :disabled="!grid" @click="onExport">
          <svg class="btn-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          导出 PNG 图纸
        </button>
        <p v-if="errorMsg" class="error">{{ errorMsg }}</p>
      </div>

      <div class="main">
        <section v-if="!previewVisible" class="panel empty-panel">
          <p class="empty-text">上传一张图片，或从左侧选择宝可梦像素素材，即可生成拼豆网格图纸。</p>
          <p class="empty-sub">图纸每个格子对应一颗 Mard 珠子，格内标注色号，底部附带材料用量清单。</p>
        </section>

        <template v-else>
          <section class="panel result-panel">
            <div class="result-head">
              <h2 class="panel-title">{{ sourceName }}</h2>
              <div class="stat">
                <span class="stat-chip">已用 {{ placedBeads }} / {{ totalBeads }} 格</span>
                <span v-if="grid" class="stat-chip">{{ grid.used.length }} 种颜色</span>
              </div>
              <button class="view-toggle" @click="viewMode = viewMode === 'fit' ? 'actual' : 'fit'">
                {{ viewMode === 'fit' ? '适应宽度' : '100% 原始大小' }}
              </button>
            </div>
            <div class="canvas-wrap" :class="{ actual: viewMode === 'actual' }" @mousemove="onCanvasMove" @mouseleave="hideLens">
              <canvas ref="canvasEl" class="pattern-canvas" :class="{ actual: viewMode === 'actual' }" @click="openLightbox"></canvas>
              <div v-if="lensVisible" class="lens" :style="lensStyle">
                <canvas ref="lensEl" width="180" height="180" class="lens-canvas"></canvas>
              </div>
            </div>
            <p v-if="placedBeads < totalBeads" class="transparent-note">
              透明/留空区域不耗珠（{{ totalBeads - placedBeads }} 格）· 实耗珠子 {{ placedBeads }} 颗
            </p>
          </section>

          <section v-if="grid && grid.used.length" class="panel legend-panel">
            <h2 class="panel-title">材料清单</h2>
            <div class="legend-summary">
              <span class="ls-item"><b>{{ placedBeads }}</b> 颗</span>
              <span class="ls-sep">·</span>
              <span class="ls-item"><b>{{ grid.used.length }}</b> 种颜色</span>
              <span class="ls-sep">·</span>
              <span class="ls-item">留空 {{ totalBeads - placedBeads }} 格</span>
            </div>
            <div class="legend-list">
              <div v-for="c in grid.used" :key="c.no" class="legend-item">
                <span class="legend-swatch" :style="{ background: `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})` }"></span>
                <span class="legend-no">{{ c.no }}</span>
                <span class="legend-series">{{ c.seriesName }}</span>
                <span class="legend-count">×{{ grid.counts[c.no] }}</span>
              </div>
            </div>
          </section>
        </template>

        <section v-if="grid" class="panel palette-panel">
          <h2 class="panel-title">Mard 色卡速览（{{ MARD_PALETTE.length }} 色）</h2>
          <div class="palette">
            <span
              v-for="c in MARD_PALETTE"
              :key="c.no"
              class="palette-swatch"
              :title="`${c.no} ${c.seriesName}`"
              :style="{ background: `rgb(${c.rgb[0]},${c.rgb[1]},${c.rgb[2]})` }"
            ></span>
          </div>
        </section>
      </div>
    </div>

    <div v-if="lightboxOpen" class="lightbox-backdrop" role="dialog" aria-modal="true" aria-label="拼豆图纸放大预览" @click.self="closeLightbox">
      <div class="lightbox-modal">
        <div class="lightbox-head">
          <span class="lightbox-title">{{ sourceName }} · 放大预览</span>
          <span class="lightbox-hint">滚轮缩放 · 拖拽平移</span>
          <div class="lightbox-zoom">
            <button class="lightbox-btn" :disabled="lightboxZoom <= 1" @click="zoomLightbox(0.5)">-</button>
            <span class="lightbox-zoom-label">{{ lightboxZoom.toFixed(1) }}×</span>
            <button class="lightbox-btn" :disabled="lightboxZoom >= LIGHTBOX_MAX_ZOOM" @click="zoomLightbox(2)">+</button>
            <button class="lightbox-btn" @click="lightboxZoom = 1">重置</button>
          </div>
          <button class="lightbox-close" title="关闭" @click="closeLightbox">✕</button>
        </div>
        <div
          ref="lightboxStageEl"
          class="lightbox-stage"
          :class="{ dragging: lbDragging }"
          @pointerdown="onStagePointerDown"
          @pointermove="onStagePointerMove"
          @pointerup="onStagePointerUp"
          @pointercancel="onStagePointerUp"
          @wheel="onStageWheel"
          @dblclick="resetLightboxView"
        >
          <canvas
            ref="lightboxEl"
            class="lightbox-canvas"
            draggable="false"
            :style="{ zoom: String(lightboxZoom), maxWidth: lightboxZoom > 1 ? 'none' : '100%' }"
          ></canvas>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 60vh;
}
.page-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 18px;
}
.page-head h1 {
  font-size: 24px;
  margin: 0;
  color: var(--text);
  font-weight: 800;
  letter-spacing: 0.5px;
}
.page-total {
  font-size: 13px;
  color: var(--text-3);
}
.layout {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 16px;
  align-items: start;
}
.layout > * {
  min-width: 0;
}
.panel {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 16px;
  padding: 16px;
  box-shadow: var(--shadow);
  margin-bottom: 16px;
}
.panel-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 12px;
}
.drop-zone {
  border: 1.5px dashed var(--border);
  border-radius: 12px;
  padding: 22px 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.15s;
  color: var(--text-3);
  outline: none;
}
.drop-zone:hover,
.drop-zone.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  color: var(--accent);
}
.dz-icon {
  margin: 0 auto 8px;
  display: block;
}
.dz-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.drop-zone.on .dz-title,
.drop-zone:hover .dz-title {
  color: var(--accent);
}
.dz-sub {
  font-size: 12px;
  margin-top: 4px;
  color: var(--text-faint);
}
.dz-input {
  display: none;
}
.poke-block {
  margin-top: 14px;
}
.poke-label {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 8px;
}
.src-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 10px;
}
.src-chip {
  flex: 1;
  min-width: 0;
  padding: 5px 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 9px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.src-chip:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.src-chip.on {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
}
.poke-search {
  width: 100%;
  box-sizing: border-box;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  background: var(--input-bg);
  color: var(--text);
  border-radius: 10px;
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}
.poke-search:focus {
  border-color: var(--accent);
}
.poke-grid {
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(64px, 1fr));
  gap: 8px;
  max-height: 220px;
  overflow-y: auto;
  opacity: 1;
  transition: opacity 0.15s;
}
.poke-grid.loading {
  opacity: 0.4;
  pointer-events: none;
}
.poke-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 8px 4px;
  border: 1px solid var(--border-faint);
  background: var(--surface-2);
  border-radius: 10px;
  cursor: pointer;
  transition: all 0.13s;
}
.poke-item:hover {
  border-color: var(--border);
  background: var(--hover-bg);
}
.poke-item.on {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.poke-item img {
  width: 48px;
  height: 48px;
  object-fit: contain;
  image-rendering: auto;
}
.poke-grid.pixel .poke-item img {
  image-rendering: pixelated;
}
.poke-id {
  font-size: 10px;
  color: var(--text-faint);
}
.poke-name {
  font-size: 11px;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
}
.poke-item.on .poke-name {
  color: var(--accent);
  font-weight: 600;
}
.poke-empty {
  grid-column: 1 / -1;
  text-align: center;
  color: var(--text-faint);
  font-size: 12px;
  padding: 14px 0;
}
.param-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.param-label {
  font-size: 13px;
  color: var(--text-2);
}
.param-value {
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
}
.range {
  width: 100%;
  accent-color: var(--accent);
  margin-bottom: 14px;
  cursor: pointer;
}
.switch {
  width: 44px;
  height: 24px;
  border-radius: 999px;
  border: none;
  background: var(--surface-3);
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  padding: 0;
  flex-shrink: 0;
}
.switch.on {
  background: var(--accent);
}
.switch-knob {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  transition: left 0.2s;
}
.switch.on .switch-knob {
  left: 23px;
}
.thick-btns {
  display: flex;
  gap: 6px;
}
.thick-btn {
  padding: 4px 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 9px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.thick-btn:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.thick-btn.on {
  color: var(--accent);
  background: var(--accent-soft);
  border-color: var(--accent);
}
.outline-select {
  min-width: 0;
  flex: 1;
  height: 32px;
  padding: 0 8px;
  border: 1px solid var(--border);
  background: var(--input-bg);
  color: var(--text);
  border-radius: 9px;
  font-size: 13px;
  outline: none;
}
.outline-swatch {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  flex-shrink: 0;
  border: 1px solid var(--border-soft);
}
.export-btn {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px;
  border: none;
  border-radius: 12px;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.export-btn:hover:not(:disabled) {
  background: var(--accent-deep);
}
.export-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-icon {
  flex-shrink: 0;
}
.error {
  margin: 10px 0 0;
  font-size: 13px;
  color: var(--danger);
}
.empty-panel {
  min-height: 240px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.empty-text {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-2);
  margin: 0 0 6px;
}
.empty-sub {
  font-size: 13px;
  color: var(--text-faint);
  margin: 0;
}
.result-panel {
  padding: 12px;
}
.result-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  flex-wrap: wrap;
  padding: 4px 4px 8px;
}
.result-head .panel-title {
  margin: 0;
}
.stat {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.stat-chip {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 999px;
  padding: 3px 10px;
}
.view-toggle {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent);
  background: var(--accent-soft);
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 4px 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.view-toggle:hover {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.canvas-wrap {
  position: relative;
  overflow-x: auto;
  background: #ffffff;
  border: 1px solid var(--border-faint);
  border-radius: 12px;
  padding: 8px;
}
.canvas-wrap.actual {
  overflow: auto;
}
.pattern-canvas {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
  image-rendering: auto;
  cursor: zoom-in;
}
.pattern-canvas.actual {
  max-width: none;
}
.lens {
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid #ffffff;
  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.38);
  background: #ffffff;
  pointer-events: none;
  z-index: 20;
}
.lens-canvas {
  display: block;
  width: 100%;
  height: 100%;
  image-rendering: pixelated;
}
.lightbox-backdrop {
  position: fixed;
  inset: 0;
  z-index: 1000;
  background: rgba(10, 12, 18, 0.72);
  display: flex;
  align-items: center;
  justify-content: center;
  animation: lb-fade 0.15s ease;
}
@keyframes lb-fade {
  from { opacity: 0; }
  to { opacity: 1; }
}
.lightbox-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 14px;
  width: min(96vw, 1200px);
  max-height: 92vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.45);
}
.lightbox-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-faint);
}
.lightbox-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.lightbox-hint {
  font-size: 11px;
  color: var(--text-faint);
  white-space: nowrap;
  margin-left: 8px;
  user-select: none;
}
.lightbox-zoom {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 6px;
}
.lightbox-btn {
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-2);
  border-radius: 8px;
  padding: 5px 11px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.13s;
}
.lightbox-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.lightbox-btn:disabled {
  opacity: 0.4;
  cursor: default;
}
.lightbox-btn:disabled:hover {
  border-color: var(--border);
  color: var(--text-2);
}
.lightbox-zoom-label {
  font-size: 12px;
  color: var(--text-3);
  min-width: 34px;
  text-align: center;
}
.lightbox-close {
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 16px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.13s;
}
.lightbox-close:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.lightbox-stage {
  overflow: hidden;
  padding: 12px;
  background: #fafafa;
  cursor: grab;
  user-select: none;
  touch-action: none;
}
.lightbox-stage.dragging {
  cursor: grabbing;
}
.lightbox-canvas {
  display: block;
  margin: 0 auto;
}
@media (max-width: 768px) {
  .pattern-canvas {
    margin: 0;
  }
}
@media (max-width: 640px) {
  .poke-grid {
    max-height: 180px;
  }
  .page-head h1 {
    font-size: 20px;
  }
}
.transparent-note {
  font-size: 12px;
  color: var(--text-3);
  margin: 8px 2px 0;
}
.legend-summary {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  margin-bottom: 10px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--accent-soft);
  color: var(--text-2);
  font-size: 13px;
}
.legend-summary b {
  font-size: 15px;
  font-weight: 800;
  color: var(--accent);
}
.ls-sep {
  color: var(--border);
}
.legend-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 6px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 8px;
  border: 1px solid var(--border-faint);
  border-radius: 8px;
  background: var(--surface-2);
}
.legend-swatch {
  width: 20px;
  height: 20px;
  border-radius: 6px;
  flex-shrink: 0;
  border: 1px solid var(--border-soft);
}
.legend-no {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.legend-series {
  font-size: 11px;
  color: var(--text-faint);
}
.legend-count {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}
.palette {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}
.palette-swatch {
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1px solid var(--border-faint);
  cursor: default;
}
@media (max-width: 860px) {
  .layout {
    grid-template-columns: 1fr;
  }
}
</style>
