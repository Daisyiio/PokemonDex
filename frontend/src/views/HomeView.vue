<script setup lang="ts">
import { onMounted, onBeforeUnmount, onActivated, onDeactivated, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { listPokemon, listTypes } from '../api'
import { imageUrl, typeColor } from '../types'
import { listState } from '../store'
import { useScrollMemory } from '../composables/useScrollMemory'
import TypeBadge from '../components/TypeBadge.vue'
import SafeImage from '../components/SafeImage.vue'
import CustomSelect from '../components/CustomSelect.vue'
import type { PokemonSummary } from '../types'

useScrollMemory()

const router = useRouter()

const types = ref<{ name: string; count: number }[]>([])
const items = ref<PokemonSummary[]>([])
const total = ref(0)
const pageSize = 24
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
const viewMode = ref<'grid' | 'list'>('grid')

// --- dropdown search ---
const searchResults = ref<PokemonSummary[]>([])
const showDropdown = ref(false)
const activeIndex = ref(-1)
const searchInputEl = ref<HTMLInputElement | null>(null)
const dropStyle = ref<{ top: string; left: string; width: string }>({
  top: '0px',
  left: '0px',
  width: '0px',
})
let debounceTimer: number | undefined

const gens = Array.from({ length: 9 }, (_, i) => i + 1)
const genOptions = [
  { value: '', label: '全部世代' },
  ...gens.map((g) => ({ value: String(g), label: `第 ${g} 世代` })),
]

async function load(append = false) {
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
  }
  try {
    const res = await listPokemon({
      search: listState.search || undefined,
      type: listState.type || undefined,
      gen: listState.gen ? Number(listState.gen) : undefined,
      page: listState.page,
      pageSize,
    })
    items.value = append ? [...items.value, ...res.items] : res.items
    total.value = res.total
    hasMore.value = items.value.length < res.total
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  listState.page++
  load(true)
}

function onScroll() {
  if (loadingMore.value || !hasMore.value) return
  const bottom = document.documentElement.scrollHeight - document.documentElement.scrollTop - document.documentElement.clientHeight
  if (bottom < 300) loadMore()
}

function applyFilters() {
  listState.page = 1
  hasMore.value = true
  load()
}

function toggleType(t: string) {
  listState.type = listState.type === t ? '' : t
  applyFilters()
}

function goDetail(id: string) {
  closeDropdown()
  router.push(`/pokemon/${id}`)
}

function splitHit(text: string, kw: string): { text: string; hit: boolean }[] {
  const key = kw.trim().toLowerCase()
  if (!key || !text) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const parts: { text: string; hit: boolean }[] = []
  let i = 0
  let idx = lower.indexOf(key)
  while (idx !== -1) {
    if (idx > i) parts.push({ text: text.slice(i, idx), hit: false })
    parts.push({ text: text.slice(idx, idx + key.length), hit: true })
    i = idx + key.length
    idx = lower.indexOf(key, i)
  }
  if (i < text.length) parts.push({ text: text.slice(i), hit: false })
  return parts.length ? parts : [{ text, hit: false }]
}

function positionDropdown() {
  const el = searchInputEl.value
  if (!el) return
  const r = el.getBoundingClientRect()
  dropStyle.value = {
    top: `${r.bottom + 6}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
  }
}

function onWindowMove() {
  if (showDropdown.value) positionDropdown()
}

function openDropdown() {
  showDropdown.value = true
  activeIndex.value = -1
  positionDropdown()
  window.addEventListener('scroll', onWindowMove, true)
  window.addEventListener('resize', onWindowMove)
}

function closeDropdown() {
  showDropdown.value = false
  activeIndex.value = -1
  window.removeEventListener('scroll', onWindowMove, true)
  window.removeEventListener('resize', onWindowMove)
}

async function runSuggest() {
  const kw = listState.search.trim()
  if (!kw) {
    searchResults.value = []
    closeDropdown()
    return
  }
  const res = await listPokemon({ search: kw, pageSize: 8 })
  searchResults.value = res.items
  openDropdown()
}

function onSearchInput() {
  clearTimeout(debounceTimer)
  debounceTimer = window.setTimeout(runSuggest, 200)
}

function onKeydown(e: KeyboardEvent) {
  if (e.isComposing) return
  if (e.key === 'Enter') {
    const hit = searchResults.value[activeIndex.value]
    if (hit) {
      e.preventDefault()
      goDetail(hit.id)
      return
    }
    e.preventDefault()
    if (showDropdown.value) closeDropdown()
    applyFilters()
    return
  }
  if (!showDropdown.value) return
  const n = searchResults.value.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = activeIndex.value >= n - 1 ? 0 : activeIndex.value + 1
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = activeIndex.value <= 0 ? n - 1 : activeIndex.value - 1
  } else if (e.key === 'Escape') {
    closeDropdown()
  }
}

function onInputBlur() {
  window.setTimeout(() => {
    closeDropdown()
  }, 120)
}

function onOutsideClick(e: MouseEvent) {
  const el = (e.target as HTMLElement).closest('.search-box')
  if (!el) {
    closeDropdown()
  }
}

watch(() => [listState.type, listState.gen], applyFilters)

onMounted(async () => {
  load()
  types.value = await listTypes()
  document.addEventListener('click', onOutsideClick)
})

onActivated(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
  if (items.value.length === 0) load()
})

onDeactivated(() => {
  window.removeEventListener('scroll', onScroll)
})

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
  closeDropdown()
  document.removeEventListener('click', onOutsideClick)
  window.removeEventListener('scroll', onScroll)
})
</script>

<template>
  <div class="home">
    <div class="filters">
      <div class="search-box">
        <input
          ref="searchInputEl"
          v-model="listState.search"
          class="search-input"
          type="text"
          placeholder="搜索名称 / 编号 / 英文名…"
          @input="onSearchInput"
          @keydown="onKeydown"
          @blur="onInputBlur"
        />
        <Transition name="drop">
          <div v-if="showDropdown" class="dropdown" :style="dropStyle">
            <router-link
              v-for="(p, i) in searchResults"
              :key="p.id"
              :to="`/pokemon/${p.id}`"
              class="drop-item"
              :class="{ active: i === activeIndex }"
              :style="{ animationDelay: `${i * 28}ms` }"
              @mouseenter="activeIndex = i"
            >
            <span class="drop-img">
              <SafeImage
                v-if="p.image"
                :src="imageUrl('official', p.image)"
                :alt="p.nameZh"
              />
            </span>
            <span class="drop-name">
              <template
                v-for="(part, j) in splitHit(p.nameZh, listState.search)"
                :key="j"
              >
                <mark v-if="part.hit" class="hit">{{ part.text }}</mark
                ><template v-else>{{ part.text }}</template>
              </template>
            </span>
            <span class="drop-en">
              <template
                v-for="(part, j) in splitHit(p.nameEn || '', listState.search)"
                :key="j"
              >
                <mark v-if="part.hit" class="hit">{{ part.text }}</mark
                ><template v-else>{{ part.text }}</template>
              </template>
            </span>
            <span class="drop-id">#{{ p.id }}</span>
            <span class="drop-types">
              <span
                v-for="t in p.types"
                :key="t"
                class="drop-type"
                :style="{ background: typeColor(t) }"
              >
                {{ t }}
              </span>
            </span>
          </router-link>
          <div v-if="searchResults.length === 0" class="drop-empty">
            未找到「{{ listState.search }}」
          </div>
          </div>
        </Transition>
      </div>
      <div class="select-wrap">
        <CustomSelect
          v-model="listState.gen"
          :options="genOptions"
          placeholder="全部世代"
        />
      </div>
      <span class="count">共 {{ total }} 只</span>
    </div>

    <div class="type-chips">
      <button
        v-for="t in types"
        :key="t.name"
        class="chip"
        :class="{ active: listState.type === t.name }"
        :style="
          listState.type === t.name
            ? { background: typeColor(t.name), borderColor: typeColor(t.name) }
            : {}
        "
        @click="toggleType(t.name)"
      >
        <span class="chip-icon" :style="{ background: typeColor(t.name) }">
          <span class="picon" :class="`picon-t-${t.name}`" />
        </span>
        <span class="chip-name">{{ t.name }}</span>
        <span class="chip-count">{{ t.count }}</span>
      </button>
    </div>

    <div class="toolbar">
      <span class="toolbar-total">共 {{ total }} 只</span>
      <div class="view-toggle">
        <button class="vt-btn" :class="{ active: viewMode === 'grid' }" @click="viewMode = 'grid'" title="网格视图">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1.5"/><rect x="9" y="1" width="6" height="6" rx="1.5"/><rect x="1" y="9" width="6" height="6" rx="1.5"/><rect x="9" y="9" width="6" height="6" rx="1.5"/></svg>
        </button>
        <button class="vt-btn" :class="{ active: viewMode === 'list' }" @click="viewMode = 'list'" title="列表视图">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="2" width="14" height="3" rx="1"/><rect x="1" y="7" width="14" height="3" rx="1"/><rect x="1" y="12" width="14" height="3" rx="1"/></svg>
        </button>
      </div>
    </div>

    <div v-if="loading && items.length === 0" class="grid">
      <div v-for="n in 12" :key="n" class="card">
        <div class="card-img">
          <div class="skeleton sk-img" />
        </div>
        <div class="skeleton sk-line" style="margin-top: 10px; width: 60%" />
        <div class="skeleton sk-line" style="width: 40%" />
      </div>
    </div>

    <div v-else-if="viewMode === 'grid'" class="grid">
      <router-link
        v-for="p in items"
        :key="p.id"
        :to="`/pokemon/${p.id}`"
        class="card"
      >
        <div
          class="card-img"
          :style="{ background: `linear-gradient(160deg, ${typeColor(p.types[0] || '一般')}26, var(--surface-2))` }"
        >
          <SafeImage
            v-if="p.image"
            :src="imageUrl('official', p.image)"
            :alt="p.nameZh"
          />
        </div>
        <div class="card-id">#{{ p.id }}</div>
        <div class="card-name">{{ p.nameZh }}</div>
        <div class="card-gen" v-if="p.gen">第 {{ p.gen }} 世代</div>
        <div class="card-types">
          <TypeBadge v-for="t in p.types" :key="t" :type="t" size="sm" />
        </div>
      </router-link>
    </div>

    <!-- 列表视图 -->
    <div v-else class="list">
      <router-link
        v-for="p in items"
        :key="p.id"
        :to="`/pokemon/${p.id}`"
        class="list-row"
      >
        <div
          class="list-img"
          :style="{ background: `linear-gradient(160deg, ${typeColor(p.types[0] || '一般')}26, var(--surface-2))` }"
        >
          <SafeImage
            v-if="p.image"
            :src="imageUrl('official', p.image)"
            :alt="p.nameZh"
          />
        </div>
        <div class="list-info">
          <div class="list-id">#{{ p.id }}</div>
          <div class="list-name">{{ p.nameZh }}</div>
          <div class="list-en" v-if="p.nameEn">{{ p.nameEn }}</div>
        </div>
        <div class="list-types">
          <TypeBadge v-for="t in p.types" :key="t" :type="t" size="sm" />
        </div>
        <div class="list-gen" v-if="p.gen">第 {{ p.gen }} 世代</div>
        <div class="list-arrow">›</div>
      </router-link>
    </div>

    <div v-if="loadingMore" class="scroll-loading">
      <div class="scroll-spinner" />
      <span>加载中...</span>
    </div>
    <div v-else-if="!hasMore && items.length > 0" class="scroll-end">已展示全部 {{ total }} 只</div>
  </div>
</template>

<style scoped>
.filters {
  display: flex;
  flex-wrap: nowrap;
  gap: 10px;
  align-items: center;
  margin-bottom: 14px;
  position: relative;
}
.search-box {
  flex: 1;
  min-width: 220px;
  position: relative;
}
.search-input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  font-size: 14px;
  background: var(--input-bg);
  color: var(--text);
  transition: border-color 0.15s, box-shadow 0.15s;
}
.search-input::placeholder {
  color: var(--text-faint);
}
.search-input:focus {
  outline: none;
  border-color: var(--text-faint);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.dropdown {
  position: fixed;
  background: var(--drop-bg);
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  box-shadow: var(--shadow-hover);
  overflow: hidden;
  overflow-y: auto;
  max-height: 60vh;
  z-index: 30;
}
.drop-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 12px;
  text-decoration: none;
  color: inherit;
  cursor: pointer;
  animation: drop-item-in 0.28s ease both;
}
@keyframes drop-item-in {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
}
.drop-item:hover,
.drop-item.active {
  background: var(--drop-hover);
}
.drop-img {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  background: var(--surface-3);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.drop-img img {
  max-width: 30px;
  max-height: 30px;
}
.drop-name {
  font-weight: 600;
  font-size: 14px;
}
.drop-en {
  color: var(--text-3);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.drop-id {
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
}
.drop-types {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.drop-type {
  color: #fff;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
}
.drop-empty {
  padding: 16px;
  text-align: center;
  color: var(--text-3);
  font-size: 13px;
}
.drop-enter-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
  transform-origin: top center;
}
.drop-leave-active {
  transition: opacity 0.12s ease;
}
.drop-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}
.drop-leave-to {
  opacity: 0;
}
.hit {
  background: var(--accent-soft);
  color: var(--accent);
  border-radius: 2px;
  padding: 0 1px;
}
.sk-img {
  width: 84%;
  height: 84%;
  margin: auto;
}
.sk-line {
  height: 12px;
  margin: 6px auto 0;
}
.select-wrap {
  position: relative;
  display: flex;
  flex: 0 0 auto;
}
.count {
  color: var(--text-3);
  font-size: 13px;
}

.type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 20px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 4px 12px 4px 4px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 22px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-2);
  transition: all 0.15s;
}
.chip:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.chip.active {
  color: #fff;
}
.chip-icon {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.chip.active .chip-icon {
  outline: 2px solid rgba(255, 255, 255, 0.6);
  outline-offset: 1px;
}
.chip-name {
  font-weight: 500;
  line-height: 1;
}
.chip-count {
  font-size: 11px;
  opacity: 0.75;
  line-height: 1;
}

.loading {
  text-align: center;
  color: var(--text-3);
  padding: 60px 0;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 14px;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.toolbar-total {
  font-size: 13px;
  color: var(--text-3);
}
.view-toggle {
  display: flex;
  gap: 2px;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
}
.vt-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 28px;
  border: none;
  background: var(--surface);
  color: var(--text-3);
  cursor: pointer;
  transition: all 0.15s;
}
.vt-btn.active {
  background: var(--accent);
  color: var(--on-accent);
}
.vt-btn:not(.active):hover {
  background: var(--surface-2);
  color: var(--text);
}
.list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.list-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  background: var(--surface);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, background 0.15s;
}
.list-row:hover {
  border-color: var(--border);
  background: var(--surface-2);
}
.list-img {
  width: 44px;
  height: 44px;
  flex-shrink: 0;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.list-img :deep(img) {
  max-width: 38px;
  max-height: 38px;
}
.list-info {
  min-width: 0;
  flex: 1;
}
.list-id {
  font-size: 11px;
  color: var(--text-3);
  font-weight: 600;
}
.list-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.list-en {
  font-size: 11px;
  color: var(--text-faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.list-types {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.list-gen {
  font-size: 11px;
  color: var(--text-faint);
  flex-shrink: 0;
  white-space: nowrap;
}
.list-arrow {
  font-size: 18px;
  color: var(--text-faint);
  flex-shrink: 0;
}
.card {
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  padding: 12px;
  text-align: center;
  text-decoration: none;
  color: inherit;
  background: var(--surface);
  transition: transform 0.18s, box-shadow 0.18s, border-color 0.18s;
}
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-hover);
  border-color: var(--border);
}
.card-img {
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
}
.card-img img {
  max-width: 96px;
  max-height: 96px;
  transition: transform 0.18s;
}
.card:hover .card-img img {
  transform: scale(1.06);
}
.card-id {
  margin-top: 8px;
  color: var(--text-3);
  font-size: 12px;
  font-weight: 600;
}
.card-name {
  font-weight: 600;
  margin: 3px 0 2px;
}
.card-gen {
  color: var(--text-faint);
  font-size: 11px;
  margin-bottom: 6px;
}
.card-types {
  display: flex;
  justify-content: center;
  gap: 4px;
}

.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 6px;
  margin-top: 28px;
  flex-wrap: wrap;
}
.page-btn {
  padding: 8px 16px;
  border: 1px solid var(--accent);
  background: var(--surface);
  color: var(--accent);
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  transition: all 0.15s;
}
.page-btn:hover:not(:disabled) {
  background: var(--accent);
  color: #fff;
}
.page-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.page-num {
  min-width: 36px;
  height: 36px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  transition: all 0.15s;
}
.page-num:hover {
  border-color: var(--border);
  color: var(--text);
  background: var(--hover-bg);
}
.page-num.current {
  background: var(--accent);
  border-color: var(--accent);
  color: #fff;
  font-weight: 600;
}
.page-ellipsis {
  color: var(--text-faint);
  padding: 0 2px;
  user-select: none;
}
.page-info {
  color: var(--text-3);
  font-size: 13px;
  font-weight: 600;
  margin-left: 6px;
}

@media (max-width: 640px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(108px, 1fr));
    gap: 10px;
  }
  .card {
    padding: 8px;
    border-radius: 12px;
  }
  .card-img {
    height: 92px;
  }
  .card-img img {
    max-width: 78px;
    max-height: 78px;
  }
  .type-chips {
    gap: 6px;
  }
  .chip {
    padding: 3px 10px 3px 3px;
    font-size: 12px;
    gap: 5px;
  }
  .chip-icon {
    width: 19px;
    height: 19px;
  }
  .search-box {
    min-width: 0;
  }
  .select-wrap {
    flex: 0 0 auto;
  }
  .count {
    display: none;
  }
  .drop-item {
    gap: 8px;
    padding: 8px 10px;
  }
  .drop-img {
    width: 32px;
    height: 32px;
  }
  .drop-img img {
    max-width: 26px;
    max-height: 26px;
  }
  .drop-name {
    font-size: 13px;
  }
  .drop-en {
    display: none;
  }
  .drop-id {
    font-size: 11px;
  }
  .drop-types {
    gap: 3px;
  }
  .drop-type {
    font-size: 10px;
    padding: 1px 6px;
  }
  .pagination {
    gap: 4px;
  }
  .page-btn {
    padding: 7px 12px;
    font-size: 12px;
  }
  .page-num {
    min-width: 32px;
    height: 32px;
    font-size: 12px;
  }
  .page-info {
    display: none;
  }
}
.scroll-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 20px 0;
  color: var(--text-3);
  font-size: 13px;
}
.scroll-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.scroll-end {
  text-align: center;
  padding: 20px 0;
  color: var(--text-faint);
  font-size: 13px;
}
</style>