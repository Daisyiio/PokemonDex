<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { listPokemon, type ListParams } from '../api'
import type { PokemonSummary } from '../types'
import { MARD_PALETTE } from '../beads/mard-palette'
import {
  buildGrid,
  drawPattern,
  exportPNG,
  loadImageFromFile,
  loadImageFromUrl,
  sampleGrid,
  type BeadGrid,
} from '../beads/beads'
import { useScrollMemory } from '../composables/useScrollMemory'

useScrollMemory()

const gridN = ref(32)
const showLabels = ref(true)
const dragging = ref(false)
const errorMsg = ref('')

const sourceImg = ref<HTMLImageElement | null>(null)
const sourceName = ref('')
const grid = ref<BeadGrid | null>(null)
const canvasEl = ref<HTMLCanvasElement | null>(null)
const previewVisible = ref(false)

const totalBeads = computed(() => gridN.value * gridN.value)
const placedBeads = computed(() => {
  const g = grid.value
  if (!g) return 0
  return g.cells.filter((c) => c.color).length
})

// ---- 本地上传 / 拖拽 / 粘贴 ----
const fileInput = ref<HTMLInputElement | null>(null)

function pickFile() {
  fileInput.value?.click()
}

async function handleFile(file: File | undefined | null) {
  if (!file) return
  if (!file.type.startsWith('image/')) {
    errorMsg.value = '请选择图片文件'
    return
  }
  errorMsg.value = ''
  try {
    sourceImg.value = await loadImageFromFile(file)
    sourceName.value = file.name
    previewVisible.value = true
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

// ---- 宝可梦像素素材 ----
const pokeSearch = ref('')
const pokeResults = ref<PokemonSummary[]>([])
const searching = ref(false)
const selectedPoke = ref<PokemonSummary | null>(null)
const pokeLoading = ref(false)
let searchTimer: number | undefined

async function searchPoke() {
  searching.value = true
  const params: ListParams = { pageSize: 60 }
  if (pokeSearch.value.trim()) params.search = pokeSearch.value.trim()
  try {
    const res = await listPokemon(params)
    pokeResults.value = res.items
  } catch {
    pokeResults.value = []
  } finally {
    searching.value = false
  }
}

function onSearchInput() {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(searchPoke, 250)
}

function pokeThumb(p: PokemonSummary): string {
  return `/images/pixel-assets/pokemon/${p.id}.png`
}

async function selectPoke(p: PokemonSummary) {
  selectedPoke.value = p
  errorMsg.value = ''
  pokeLoading.value = true
  try {
    sourceImg.value = await loadImageFromUrl(pokeThumb(p))
    sourceName.value = `#${p.id} ${p.nameZh}`
    previewVisible.value = true
  } catch {
    errorMsg.value = '像素素材加载失败'
  } finally {
    pokeLoading.value = false
  }
}

// ---- 生成图纸 ----
function renderGrid() {
  const img = sourceImg.value
  if (!img || !canvasEl.value) return
  try {
    const rgbGrid = sampleGrid(img, gridN.value)
    grid.value = buildGrid(rgbGrid, gridN.value)
    drawPattern(canvasEl.value, grid.value, {
      cell: 24,
      labels: showLabels.value,
      withLegend: true,
    })
  } catch {
    grid.value = null
    errorMsg.value = '图纸生成失败'
  }
}

watch([sourceImg, gridN, showLabels], renderGrid, { flush: 'post' })

// ---- 导出 ----
function onExport() {
  const g = grid.value
  if (!g) return
  const canvas = document.createElement('canvas')
  const cell = gridN.value > 40 ? 16 : 28
  drawPattern(canvas, g, { cell, labels: showLabels.value, withLegend: true })
  const name = sourceName.value.replace(/[\\/:*?"<>|]/g, '_') || 'beads'
  exportPNG(canvas, `拼豆图纸-${name}-${gridN.value}格.png`)
}

// ---- 键盘粘贴事件 ----
onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
  window.removeEventListener('paste', onPaste)
})

window.addEventListener('paste', onPaste)
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
            @click="pickFile"
            @dragover.prevent="dragging = true"
            @dragleave="dragging = false"
            @drop.prevent="onDrop"
            tabindex="0"
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
            <div class="poke-label">或选择宝可梦像素素材</div>
            <input
              v-model="pokeSearch"
              class="poke-search"
              type="text"
              placeholder="搜索宝可梦编号 / 名称"
              @input="onSearchInput"
              @keyup.enter="searchPoke"
            />
            <div class="poke-grid" :class="{ loading: pokeLoading }">
              <button
                v-for="p in pokeResults"
                :key="p.id"
                class="poke-item"
                :class="{ on: selectedPoke?.id === p.id }"
                @click="selectPoke(p)"
              >
                <img :src="pokeThumb(p)" :alt="p.nameZh" loading="lazy" />
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
            min="10"
            max="64"
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
            </div>
            <div class="canvas-wrap">
              <canvas ref="canvasEl" class="pattern-canvas"></canvas>
            </div>
            <p v-if="placedBeads < totalBeads" class="transparent-note">
              透明区域已自动留空（共 {{ totalBeads - placedBeads }} 格），不会计入耗材。
            </p>
          </section>

          <section v-if="grid && grid.used.length" class="panel legend-panel">
            <h2 class="panel-title">材料清单</h2>
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
  margin-bottom: 6px;
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
  grid-template-columns: repeat(auto-fill, minmax(52px, 1fr));
  gap: 6px;
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
  padding: 6px 2px;
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
  width: 30px;
  height: 30px;
  object-fit: contain;
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
.canvas-wrap {
  overflow-x: auto;
  background: #ffffff;
  border: 1px solid var(--border-faint);
  border-radius: 12px;
  padding: 8px;
}
.pattern-canvas {
  display: block;
  margin: 0 auto;
  max-width: 100%;
  height: auto;
  image-rendering: auto;
}
.transparent-note {
  font-size: 12px;
  color: var(--text-3);
  margin: 8px 2px 0;
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
