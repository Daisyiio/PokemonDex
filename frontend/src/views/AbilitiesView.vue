<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { listAbilities, type AbilityInfo } from '../api'
import { useScrollMemory } from '../composables/useScrollMemory'
import { useInfiniteScroll } from '../composables/useInfiniteScroll'

useScrollMemory()

const items = ref<AbilityInfo[]>([])
const total = ref(0)
const page = ref(1)
const loading = ref(false)
const hasMore = ref(true)
const search = ref('')
let timer: number | undefined

async function load(append = false) {
  if (!append) loading.value = true
  try {
    const res = await listAbilities({
      search: search.value || undefined,
      page: page.value,
      pageSize: 24,
    })
    items.value = append ? [...items.value, ...res.items] : res.items
    total.value = res.total
    hasMore.value = items.value.length < res.total
  } finally {
    loading.value = false
  }
}

const { loadingMore, onScroll } = useInfiniteScroll(
  async () => { page.value++; await load(true) },
  () => hasMore.value,
)

function onSearch() {
  clearTimeout(timer)
  timer = window.setTimeout(() => {
    page.value = 1
    hasMore.value = true
    load()
  }, 250)
}

onBeforeUnmount(() => {
  clearTimeout(timer)
  window.removeEventListener('scroll', onScroll)
})

load()
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>特性图鉴</h1>
      <div class="page-total">共 {{ total }} 个特性</div>
    </div>

    <div class="toolbar">
      <div class="search-box">
        <input
          v-model="search"
          type="text"
          placeholder="搜索特性名称…"
          @input="onSearch"
        />
        <svg class="search-icon" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
      </div>
    </div>

    <div v-if="loading && items.length === 0" class="grid">
      <div v-for="i in 12" :key="i" class="sk-card"></div>
    </div>

    <div v-else class="grid">
      <router-link
        v-for="a in items"
        :key="a.id"
        :to="`/abilities/${a.id}`"
        class="ab-card"
      >
        <div class="ab-head">
          <span class="ab-name">{{ a.nameZh }}</span>
          <span class="ab-gen" v-if="a.generation">第 {{ a.generation }} 世代</span>
        </div>
        <div class="ab-count" v-if="a.commonCount != null || a.hiddenCount != null">
          <span v-if="a.commonCount">常见 {{ a.commonCount }} 只</span>
          <span v-if="a.hiddenCount" class="ab-hidden">隐藏 {{ a.hiddenCount }} 只</span>
        </div>
        <p class="ab-desc" v-if="a.description">{{ a.description }}</p>
        <div class="ab-learn">
          查看拥有宝可梦
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </router-link>
    </div>

    <div v-if="loadingMore" class="scroll-loading">
      <div class="scroll-spinner" />
      <span>加载中...</span>
    </div>
    <div v-else-if="!hasMore && items.length > 0" class="scroll-end">已展示全部 {{ total }} 个特性</div>
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
  margin-bottom: 16px;
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
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
}
.ab-card {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, transform 0.15s;
}
.ab-card:hover {
  border-color: var(--border);
  transform: translateY(-2px);
}
.ab-learn {
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
  font-size: 11px;
  color: var(--text-3);
  padding-top: 2px;
  transition: color 0.15s;
}
.ab-card:hover .ab-learn {
  color: var(--accent);
}
.ab-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.ab-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.ab-gen {
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
}
.ab-count {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-3);
}
.ab-hidden {
  color: var(--ability-hidden-text);
}
.ab-desc {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-2);
}
.sk-card {
  height: 140px;
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