<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'
import { listMoves, type MoveListItem } from '../api'
import { TYPE_COLORS } from '../types'
import TypeBadge from '../components/TypeBadge.vue'
import CategoryBadge from '../components/CategoryBadge.vue'
import Pagination from '../components/Pagination.vue'

const items = ref<MoveListItem[]>([])
const total = ref(0)
const totalPages = ref(1)
const page = ref(1)
const loading = ref(false)
const search = ref('')
const typeFilter = ref('')
const categoryFilter = ref('')

const types = Object.keys(TYPE_COLORS)
const categories = ['物理', '特殊', '变化']
let timer: number | undefined

async function load() {
  loading.value = true
  try {
    const res = await listMoves({
      search: search.value || undefined,
      type: typeFilter.value || undefined,
      category: categoryFilter.value || undefined,
      page: page.value,
      pageSize: 24,
    })
    items.value = res.items
    total.value = res.total
    totalPages.value = Math.max(1, Math.ceil(res.total / res.pageSize))
  } finally {
    loading.value = false
  }
}

function onSearch() {
  clearTimeout(timer)
  timer = window.setTimeout(() => {
    page.value = 1
    load()
  }, 250)
}

function setType(t: string) {
  typeFilter.value = t === typeFilter.value ? '' : t
  page.value = 1
  load()
}

function setCategory(c: string) {
  categoryFilter.value = c === categoryFilter.value ? '' : c
  page.value = 1
  load()
}

watch(page, load)

onBeforeUnmount(() => clearTimeout(timer))

load()
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>招式图鉴</h1>
      <div class="page-total">共 {{ total }} 个招式</div>
    </div>

    <div class="toolbar">
      <div class="search-box">
        <input
          v-model="search"
          type="text"
          placeholder="搜索招式名称…"
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
        v-for="c in categories"
        :key="c"
        class="chip"
        :class="{ on: categoryFilter === c }"
        @click="setCategory(c)"
      >
        {{ c }}
      </button>
      <span class="filter-sep"></span>
      <button
        v-for="t in types"
        :key="t"
        class="chip type-chip"
        :class="{ on: typeFilter === t }"
        :style="typeFilter === t ? { background: TYPE_COLORS[t], borderColor: TYPE_COLORS[t] } : {}"
        @click="setType(t)"
      >
        <span class="dot" :style="{ background: TYPE_COLORS[t] }"></span>
        {{ t }}
      </button>
    </div>

    <div v-if="loading" class="grid">
      <div v-for="i in 12" :key="i" class="sk-card"></div>
    </div>

    <div v-else class="grid">
      <router-link
        v-for="m in items"
        :key="m.id"
        :to="`/moves/${m.id}`"
        class="move-card"
      >
        <div class="mc-head">
          <span class="mc-id">{{ m.id }}</span>
          <span class="mc-name">{{ m.nameZh }}</span>
        </div>
        <div class="mc-badges">
          <TypeBadge v-if="m.type" :type="m.type" size="sm" />
          <CategoryBadge v-if="m.category" :category="m.category" size="sm" />
        </div>
        <div class="mc-stats">
          <span class="stat">
            <span class="stat-label">威力</span>
            <b>{{ m.power || '—' }}</b>
          </span>
          <span class="stat">
            <span class="stat-label">命中</span>
            <b>{{ m.accuracy || '—' }}</b>
          </span>
          <span class="stat">
            <span class="stat-label">PP</span>
            <b>{{ m.pp || '—' }}</b>
          </span>
        </div>
        <p class="mc-desc" v-if="m.description">{{ m.description }}</p>
        <div class="mc-learn">
          查看可学宝可梦
          <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="m9 18 6-6-6-6" />
          </svg>
        </div>
      </router-link>
    </div>

    <Pagination v-if="totalPages > 1" :page="page" :total-pages="totalPages" @change="page = $event" />
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
  border-color: var(--accent);
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
  align-items: center;
  margin-bottom: 16px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
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
  border-color: var(--accent);
  color: var(--accent);
}
.chip.on {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
  font-weight: 600;
}
.type-chip.on {
  color: #fff;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.filter-sep {
  width: 1px;
  height: 20px;
  background: var(--border);
  margin: 0 4px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}
.move-card {
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
.move-card:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}
.mc-learn {
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
.move-card:hover .mc-learn {
  color: var(--accent);
}
.mc-head {
  display: flex;
  align-items: center;
  gap: 8px;
}
.mc-id {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  min-width: 28px;
  text-align: right;
}
.mc-name {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.mc-badges {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.mc-stats {
  display: flex;
  gap: 14px;
  border-top: 1px dashed var(--border-faint);
  padding-top: 8px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stat-label {
  font-size: 11px;
  color: var(--text-3);
}
.stat b {
  font-size: 14px;
  color: var(--text);
}
.mc-machines {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.tm-chip {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
  letter-spacing: 0.5px;
}
.tm-chip.tm {
  color: var(--accent);
  background: var(--accent-soft);
}
.tm-chip.tr {
  color: #8b5cf6;
  background: rgba(139, 92, 246, 0.12);
}
.mc-desc {
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
  height: 150px;
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
@media (max-width: 640px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  }
}
</style>