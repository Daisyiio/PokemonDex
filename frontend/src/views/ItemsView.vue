<script setup lang="ts">
import { onBeforeUnmount, onActivated, onDeactivated, ref } from 'vue'
import { listItems, listItemCategories, type ItemListItem } from '../api'
import { imageUrl } from '../types'
import SafeImage from '../components/SafeImage.vue'
import { useScrollMemory } from '../composables/useScrollMemory'

useScrollMemory()

const items = ref<ItemListItem[]>([])
const categories = ref<{ id: number; nameZh: string }[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const loadingMore = ref(false)
const hasMore = ref(true)
const search = ref('')
const categoryFilter = ref('')
let timer: number | undefined

async function load(append = false) {
  if (append) {
    loadingMore.value = true
  } else {
    loading.value = true
  }
  try {
    const res = await listItems({
      search: search.value || undefined,
      category: categoryFilter.value || undefined,
      page: page.value,
      pageSize: 24,
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
  page.value++
  load(true)
}

function onScroll() {
  if (loadingMore.value || !hasMore.value) return
  const bottom = document.documentElement.scrollHeight - document.documentElement.scrollTop - document.documentElement.clientHeight
  if (bottom < 300) loadMore()
}

function onSearch() {
  clearTimeout(timer)
  timer = window.setTimeout(() => {
    page.value = 1
    hasMore.value = true
    load()
  }, 250)
}

function setCategory(c: string) {
  categoryFilter.value = c === categoryFilter.value ? '' : c
  page.value = 1
  hasMore.value = true
  load()
}

onActivated(() => {
  window.addEventListener('scroll', onScroll, { passive: true })
})

onDeactivated(() => {
  window.removeEventListener('scroll', onScroll)
})

onBeforeUnmount(() => {
  clearTimeout(timer)
  window.removeEventListener('scroll', onScroll)
})

listItemCategories().then((cs) => {
  categories.value = cs
})

load()
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>道具图鉴</h1>
      <div class="page-total">共 {{ total }} 个道具</div>
    </div>

    <div class="toolbar">
      <div class="search-box">
        <input
          v-model="search"
          type="text"
          placeholder="搜索道具名称…"
          @input="onSearch"
        />
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </div>
    </div>

    <div class="filter-row">
      <button
        class="chip"
        :class="{ on: categoryFilter === '' }"
        @click="categoryFilter = ''; load()"
      >
        全部
      </button>
      <button
        v-for="c in categories"
        :key="c.id"
        class="chip"
        :class="{ on: categoryFilter === c.nameZh }"
        @click="setCategory(c.nameZh)"
      >
        {{ c.nameZh }}
      </button>
    </div>

    <div v-if="loading && items.length === 0" class="grid">
      <div v-for="i in 12" :key="i" class="sk-card"></div>
    </div>

    <div v-else class="grid">
      <div v-for="it in items" :key="it.id" class="it-card">
        <div class="it-icon">
          <SafeImage
            v-if="it.icon"
            :src="imageUrl('items', it.icon)"
            :alt="it.nameZh"
          />
          <span v-else class="it-unknown">?</span>
        </div>
        <div class="it-body">
          <div class="it-head">
            <span class="it-name">{{ it.nameZh }}</span>
          </div>
          <div class="it-cat" v-if="it.category">{{ it.category }}</div>
          <p class="it-desc" v-if="it.description">{{ it.description }}</p>
        </div>
      </div>
    </div>

    <div v-if="loadingMore" class="scroll-loading">
      <div class="scroll-spinner" />
      <span>加载中...</span>
    </div>
    <div v-else-if="!hasMore && items.length > 0" class="scroll-end">已展示全部 {{ total }} 个道具</div>
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
  margin-bottom: 16px;
}
.page-head h1 {
  font-size: 24px;
  margin: 0;
  color: var(--text);
}
.page-total {
  font-size: 13px;
  color: var(--text-3);
}
.toolbar {
  margin-bottom: 12px;
}
.search-box {
  position: relative;
  max-width: 320px;
}
.search-box input {
  width: 100%;
  padding: 9px 36px 9px 12px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  outline: none;
  transition: border-color 0.15s;
}
.search-box input:focus {
  border-color: var(--text-faint);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.search-icon {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
  color: var(--text-faint);
}
.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}
.chip {
  padding: 5px 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 999px;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.chip:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.chip.on {
  color: var(--accent);
  background: var(--accent-soft);
  font-weight: 600;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.it-card {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  gap: 12px;
  align-items: flex-start;
  transition: border-color 0.15s, transform 0.15s, box-shadow 0.15s;
}
.it-card:hover {
  border-color: var(--border);
  transform: translateY(-2px);
}
.it-icon {
  width: 52px;
  height: 52px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border-radius: 12px;
  overflow: hidden;
}
.it-icon :deep(img) {
  max-width: 44px;
  max-height: 44px;
  object-fit: contain;
}
.it-icon :deep(.img-fallback) {
  color: var(--text-faint);
}
.it-unknown {
  font-size: 20px;
  color: var(--text-3);
}
.it-body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.it-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.it-cat {
  font-size: 11px;
  color: var(--text-3);
}
.it-desc {
  margin: 0;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-2);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.sk-card {
  height: 86px;
  border-radius: 14px;
  background: var(--surface);
  position: relative;
  overflow: hidden;
}
.sk-card::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, var(--surface-2) 50%, transparent);
  animation: shimmer 1.2s infinite;
}
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
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