<script setup lang="ts">
import { computed, ref } from 'vue'
import { TYPE_COLORS } from '../types'
import {
  CHART_TYPES,
  typeMultiplier,
  resultMeta,
} from '../typechart'
import TypeBadge from '../components/TypeBadge.vue'
import { useScrollMemory } from '../composables/useScrollMemory'

useScrollMemory()

const mode = ref<'attack' | 'defend'>('attack')
const attacker = ref('电')
const defenders = ref<string[]>([])

const attackResults = computed(() =>
  CHART_TYPES.map((d) => ({
    type: d,
    m: typeMultiplier(attacker.value, d),
    meta: resultMeta(typeMultiplier(attacker.value, d)),
  }))
)

const defendResults = computed(() => {
  if (defenders.value.length === 0) return []
  return CHART_TYPES.map((a) => {
    const m = defenders.value.reduce(
      (acc, d) => acc * typeMultiplier(a, d),
      1
    )
    return { type: a, m, meta: resultMeta(m) }
  })
})

function toggleDefender(t: string) {
  const i = defenders.value.indexOf(t)
  if (i >= 0) defenders.value.splice(i, 1)
  else if (defenders.value.length < 2) defenders.value.push(t)
}

function mClass(m: number): string {
  if (m === 0) return '0'
  if (m === 0.25) return '25'
  if (m === 0.5) return '5'
  if (m === 2) return '2'
  if (m === 4) return '4'
  return '1'
}

function mText(m: number): string {
  if (m === 1) return '1'
  return String(m)
}

function pickAttack(t: string) {
  mode.value = 'attack'
  attacker.value = t
}

function pickDefend(t: string) {
  mode.value = 'defend'
  toggleDefender(t)
}
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>属性克制</h1>
      <div class="page-total">克制 · 抵抗 · 无效</div>
    </div>

    <div class="mode-toggle">
      <button
        class="mode-btn"
        :class="{ on: mode === 'attack' }"
        @click="mode = 'attack'"
      >
        进攻
        <span class="mode-sub">我的招式属性</span>
      </button>
      <button
        class="mode-btn"
        :class="{ on: mode === 'defend' }"
        @click="mode = 'defend'"
      >
        防守
        <span class="mode-sub">我的宝可梦属性</span>
      </button>
    </div>

    <div v-if="mode === 'attack'" class="select-zone">
      <div class="zone-label">选择攻击属性</div>
      <div class="type-chips">
        <button
          v-for="t in CHART_TYPES"
          :key="t"
          class="chip"
          :class="{ on: attacker === t }"
          :style="attacker === t ? { background: TYPE_COLORS[t], borderColor: TYPE_COLORS[t], color: '#fff' } : {}"
          @click="attacker = t"
        >
          <span class="dot" :style="{ background: TYPE_COLORS[t] }"></span>
          {{ t }}
        </button>
      </div>
      <div class="result-note">
        <span class="result-label">「{{ attacker }}」属性招式对目标属性</span>
      </div>
      <div class="result-grid">
        <div
          v-for="r in attackResults"
          :key="r.type"
          class="result-card"
          :class="`rc-${r.meta.cls}`"
        >
          <TypeBadge :type="r.type" size="sm" />
          <span class="result-meta">{{ r.meta.label }}</span>
          <span class="result-num">{{ r.m }}×</span>
        </div>
      </div>
    </div>

    <div v-else class="select-zone">
      <div class="zone-label">选择宝可梦属性（最多 2 个）</div>
      <div class="type-chips">
        <button
          v-for="t in CHART_TYPES"
          :key="t"
          class="chip"
          :class="{ on: defenders.includes(t) }"
          :style="defenders.includes(t) ? { background: TYPE_COLORS[t], borderColor: TYPE_COLORS[t], color: '#fff' } : {}"
          @click="toggleDefender(t)"
        >
          <span class="dot" :style="{ background: TYPE_COLORS[t] }"></span>
          {{ t }}
        </button>
      </div>
      <div v-if="defenders.length" class="result-note">
        <span class="result-label">
          「{{ defenders.join(' / ') }}」受到的招式伤害
        </span>
      </div>
      <div v-else class="result-note muted">请选择属性查看防守克制</div>
      <div v-if="defendResults.length" class="result-grid">
        <div
          v-for="r in defendResults"
          :key="r.type"
          class="result-card"
          :class="`rc-${r.meta.cls}`"
        >
          <TypeBadge :type="r.type" size="sm" />
          <span class="result-meta">{{ r.meta.label }}</span>
          <span class="result-num">{{ r.m }}×</span>
        </div>
      </div>
    </div>

    <section class="overall">
      <div class="overall-head">
        <h2>总体克制表</h2>
        <span class="overall-sub">行 = 攻击属性，列 = 防御属性 · 点击行/列表头可直接查看</span>
      </div>
      <div class="legend">
        <span class="lg"><i class="lg-dot c-4"></i>四倍克制</span>
        <span class="lg"><i class="lg-dot c-2"></i>克制</span>
        <span class="lg"><i class="lg-dot c-1"></i>普通</span>
        <span class="lg"><i class="lg-dot c-05"></i>抵抗</span>
        <span class="lg"><i class="lg-dot c-025"></i>四倍抵抗</span>
        <span class="lg"><i class="lg-dot c-0"></i>无效</span>
      </div>
      <div class="tbl-wrap">
        <table class="chart-table">
          <thead>
            <tr>
              <th class="corner">攻击＼防御</th>
              <th v-for="t in CHART_TYPES" :key="t" class="col-head">
                <button
                  class="head-chip"
                  :style="{ background: TYPE_COLORS[t] }"
                  @click="pickDefend(t)"
                >
                  {{ t }}
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="a in CHART_TYPES" :key="a">
              <th class="row-head">
                <button
                  class="head-chip"
                  :style="{ background: TYPE_COLORS[a] }"
                  @click="pickAttack(a)"
                >
                  {{ a }}
                </button>
              </th>
              <td
                v-for="d in CHART_TYPES"
                :key="d"
                :class="`cell cell-${mClass(typeMultiplier(a, d))}`"
              >
                {{ mText(typeMultiplier(a, d)) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
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
.mode-toggle {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
}
.mode-btn {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 10px 18px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.mode-btn:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.mode-btn.on {
  color: var(--accent);
  background: var(--accent-soft);
}
.mode-sub {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-3);
}
.select-zone {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--shadow);
}
.zone-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
  margin-bottom: 10px;
}
.type-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 18px;
}
.chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
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
  color: var(--on-accent);
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}
.result-note {
  margin-bottom: 12px;
  font-size: 13px;
  color: var(--text-2);
}
.result-note.muted {
  color: var(--text-3);
}
.result-label {
  background: var(--surface-3);
  padding: 4px 12px;
  border-radius: 999px;
}
.result-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 8px;
}
.result-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 12px;
  border: 1px solid var(--border-faint);
  background: var(--surface-2);
}
.result-card :deep(.type-badge) {
  flex-shrink: 0;
}
.result-meta {
  font-size: 12px;
  font-weight: 600;
  flex: 1;
}
.result-num {
  font-size: 11px;
  font-weight: 700;
  opacity: 0.75;
}
.rc-sup {
  background: var(--eff-resist-bg);
  border-color: var(--eff-resist-border);
  color: var(--eff-resist-text);
}
.rc-sup-strong {
  background: var(--eff-resist-bg);
  border-color: var(--eff-resist-border);
  color: var(--eff-resist-text);
  font-weight: 700;
  border-width: 2px;
}
.rc-res {
  background: var(--eff-weak2-bg);
  border-color: var(--eff-weak2-border);
  color: var(--eff-weak2-text);
}
.rc-res-strong {
  background: var(--eff-weak2-bg);
  border-color: var(--eff-weak2-border);
  color: var(--eff-weak2-text);
  font-weight: 700;
  border-width: 2px;
}
.rc-imm {
  background: var(--eff-immune-bg);
  border-color: var(--eff-immune-border);
  color: var(--eff-immune-text);
  text-decoration: line-through;
}
.rc-norm {
  background: var(--eff-normal-bg);
  border-color: var(--border-faint);
  color: var(--text-2);
}

.overall {
  margin-top: 24px;
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 16px;
  padding: 20px;
  box-shadow: var(--shadow);
}
.overall-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 12px;
}
.overall-head h2 {
  font-size: 18px;
  margin: 0;
  color: var(--text);
}
.overall-sub {
  font-size: 12px;
  color: var(--text-3);
}
.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 16px;
  margin-bottom: 14px;
  font-size: 12px;
  color: var(--text-2);
}
.lg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.lg-dot {
  width: 12px;
  height: 12px;
  border-radius: 3px;
}
.lg-dot.c-4 {
  background: var(--eff-resist-text);
}
.lg-dot.c-2 {
  background: var(--eff-resist-border);
}
.lg-dot.c-1 {
  background: var(--eff-normal-bg);
  border: 1px solid var(--border);
}
.lg-dot.c-05 {
  background: var(--eff-weak2-border);
}
.lg-dot.c-025 {
  background: var(--eff-weak2-bg);
  border: 1px solid var(--eff-weak2-border);
}
.lg-dot.c-0 {
  background: var(--eff-immune-border);
}
.tbl-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  background: var(--surface);
  -webkit-overflow-scrolling: touch;
}
.chart-table {
  border-collapse: separate;
  border-spacing: 0;
  font-size: 12px;
  width: max-content;
  min-width: 100%;
}
.chart-table th,
.chart-table td {
  padding: 0;
}
.chart-table .corner,
.chart-table .col-head,
.chart-table .row-head {
  position: sticky;
  background: var(--surface-3);
  z-index: 1;
  padding: 6px;
}
.chart-table .col-head {
  top: 0;
  border-bottom: 2px solid var(--border);
}
.chart-table .row-head {
  left: 0;
  z-index: 2;
  border-right: 2px solid var(--border);
}
.chart-table .corner {
  top: 0;
  left: 0;
  z-index: 3;
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
  min-width: 56px;
  text-align: center;
  border-bottom: 2px solid var(--border);
  border-right: 2px solid var(--border);
}
.chart-table tbody tr:hover .row-head {
  background: var(--surface-3);
}
.head-chip {
  border: none;
  color: var(--on-accent);
  font-size: 11px;
  font-weight: 600;
  border-radius: 999px;
  padding: 3px 8px;
  cursor: pointer;
  transition: filter 0.15s;
  white-space: nowrap;
}
.head-chip:hover {
  filter: brightness(1.15);
}
.chart-table .cell {
  text-align: center;
  min-width: 34px;
  height: 36px;
  border: 1px solid var(--border);
}
.cell-4 {
  background: var(--eff-resist-bg);
  color: var(--eff-resist-text);
  font-weight: 700;
  border: 2px solid var(--eff-resist-border);
}
.cell-2 {
  background: var(--eff-resist-bg);
  color: var(--eff-resist-text);
  font-weight: 600;
}
.cell-1 {
  background: var(--eff-normal-bg);
  color: var(--text-2);
}
.cell-5 {
  background: var(--eff-weak2-bg);
  color: var(--eff-weak2-text);
  font-weight: 600;
}
.cell-25 {
  background: var(--eff-weak2-bg);
  color: var(--eff-weak2-text);
}
.cell-0 {
  background: var(--eff-immune-bg);
  color: var(--eff-immune-text);
  text-decoration: line-through;
}
.chart-table tbody tr:hover .cell {
  filter: brightness(0.96);
}
.chart-table tbody tr:hover .cell-1 {
  background: var(--surface-3);
  color: var(--text);
}
@media (max-width: 640px) {
  .overall-sub {
    display: none;
  }
  .chart-table .cell {
    min-width: 30px;
    height: 32px;
  }
}
</style>