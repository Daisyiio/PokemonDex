<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { getMove, type MoveDetail, type MoveLearner } from '../api'
import { imageUrl } from '../types'
import TypeBadge from '../components/TypeBadge.vue'
import CategoryBadge from '../components/CategoryBadge.vue'
import SafeImage from '../components/SafeImage.vue'
import { useScrollMemory } from '../composables/useScrollMemory'

useScrollMemory()

const route = useRoute()
const router = useRouter()
const move = ref<MoveDetail | null>(null)
const loading = ref(true)
const error = ref('')

const GENS = [2, 3, 4, 5, 6, 7, 8, 9]

function goBack() {
  if (window.history.length > 1) router.back()
  else router.push('/moves')
}

const methodLabel: Record<string, string> = {
  升级: '升级',
  机器: '招式机',
  蛋: '蛋孵化',
  教授: '教授',
}

// 每只宝可梦的世代学习数据
interface GenRow {
  id: string
  nameZh: string
  image: string | null
  levels: Record<number, string> // gen -> level text
}

const levelUpRows = computed(() => {
  if (!move.value) return []
  const learners = move.value.learners.filter((l) => l.methods.some((m) => m.method === '升级'))
  return learners.map((l) => {
    const levels: Record<number, string> = {}
    for (const g of GENS) {
      const entries = l.methods.filter((m) => m.method === '升级' && m.gen === g)
      if (entries.length === 0) {
        levels[g] = '—'
      } else {
        const lvs = entries.map((e) => e.level).filter(Boolean)
        if (lvs.length === 0) {
          levels[g] = '✓'
        } else {
          const nums = lvs.map(Number).filter((n) => !isNaN(n))
          if (nums.length > 0) {
            const min = Math.min(...nums)
            const max = Math.max(...nums)
            levels[g] = min === max ? `Lv.${min}` : `Lv.${min}-${max}`
          } else {
            levels[g] = lvs[0] === '—' ? '初始' : '✓'
          }
        }
      }
    }
    return { id: l.id, nameZh: l.nameZh, image: l.image, levels } as GenRow
  })
})
const eggLearners = computed(() => {
  if (!move.value) return []
  return move.value.learners.filter((l) => l.methods.some((m) => m.method === '蛋'))
})
const machineLearners = computed(() => {
  if (!move.value) return []
  return move.value.learners.filter((l) => l.methods.some((m) => m.method === '机器'))
})
const tutorLearners = computed(() => {
  if (!move.value) return []
  return move.value.learners.filter((l) => l.methods.some((m) => m.method === '教授'))
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    move.value = await getMove(route.params.id as string)
    if (!move.value?.nameZh) error.value = '未找到该招式'
  } catch {
    error.value = '加载失败，请重试'
  } finally {
    loading.value = false
  }
}

watch(() => route.params.id, load)

onMounted(load)
</script>

<template>
  <div class="page">
    <button class="back" @click="goBack">
      <span class="back-icon">‹</span> 返回招式图鉴
    </button>

    <div v-if="loading" class="sk-hero"></div>

    <div v-else-if="error" class="error">{{ error }}</div>

    <template v-else-if="move">
      <section class="mv-hero">
        <div class="mv-head">
          <h1>{{ move.nameZh }}</h1>
          <span class="mv-gen" v-if="move.generation">第 {{ move.generation }} 世代</span>
        </div>
        <div class="mv-badges">
          <TypeBadge v-if="move.type" :type="move.type" size="lg" />
          <CategoryBadge v-if="move.category" :category="move.category" size="lg" />
        </div>
        <div class="mv-stats">
          <div class="stat">
            <span class="stat-label">威力</span>
            <b>{{ move.power || '—' }}</b>
          </div>
          <div class="stat">
            <span class="stat-label">命中</span>
            <b>{{ move.accuracy || '—' }}</b>
          </div>
          <div class="stat">
            <span class="stat-label">PP</span>
            <b>{{ move.pp || '—' }}</b>
          </div>
        </div>
        <div class="mv-machines" v-if="move.machines.length">
          <span
            v-for="mc in move.machines"
            :key="mc"
            class="tm-chip"
            :class="mc.startsWith('TM') ? 'tm' : 'tr'"
          >
            {{ mc }}
          </span>
        </div>
        <p class="mv-desc" v-if="move.description">{{ move.description }}</p>
      </section>

      <!-- 额外数据：标志、Z招式、效果等 -->
      <div v-if="move.extra" class="extra-section">
        <div v-if="move.extra.flags && move.extra.flags.length" class="flag-list">
          <span v-for="f in move.extra.flags" :key="f" class="flag-tag">{{ f }}</span>
        </div>

        <div v-if="move.extra.z" class="extra-row">
          <span class="extra-label">Ｚ招式</span>
          <span class="extra-val">{{ move.extra.z.move || '—' }}</span>
          <span v-if="move.extra.z.crystal" class="extra-sub">{{ move.extra.z.crystal }}</span>
          <span v-if="move.extra.z.power" class="extra-sub">威力 {{ move.extra.z.power }}</span>
        </div>

        <div v-if="move.extra.max" class="extra-row">
          <span class="extra-label">极巨招式</span>
          <span class="extra-val">{{ move.extra.max.move || '—' }}</span>
          <span v-if="move.extra.max.power" class="extra-sub">威力 {{ move.extra.max.power }}</span>
        </div>

        <div v-if="move.extra.contest && move.extra.contest.length" class="extra-row">
          <span class="extra-label">华丽大赛</span>
          <span class="extra-val">{{ move.extra.contest[0].type || '—' }}</span>
          <span v-if="move.extra.contest[0].appeal" class="extra-sub">表演 {{ move.extra.contest[0].appeal }}</span>
          <span v-if="move.extra.contest[0].jam" class="extra-sub">妨害 {{ move.extra.contest[0].jam }}</span>
          <span v-if="move.extra.contest[0].gen" class="extra-sub">第{{ move.extra.contest[0].gen }}世代</span>
        </div>

        <div v-if="move.extra.effect" class="extra-effect">
          <h3>招式附加效果</h3>
          <p>{{ move.extra.effect }}</p>
        </div>
      </div>

<section class="learners">
        <h2>升级学习 <span class="count">{{ levelUpRows.length }} 只</span></h2>
        <div v-if="levelUpRows.length === 0" class="no-learners">
          没有宝可梦能通过升级学会此招式
        </div>
        <div v-else class="gen-table-wrap">
          <table class="gen-table">
            <thead>
              <tr>
                <th>宝可梦</th>
                <th v-for="g in GENS" :key="g" class="gen-th">第{{ g }}世代</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in levelUpRows" :key="row.id">
                <td class="td-mon">
                  <router-link :to="`/pokemon/${row.id}`" class="td-link">
                    <SafeImage v-if="row.image" :src="imageUrl('official', row.image)" :alt="row.nameZh" class="td-img" />
                    <span class="td-name">{{ row.nameZh }}</span>
                    <span class="td-id">#{{ row.id }}</span>
                  </router-link>
                </td>
                <td v-for="g in GENS" :key="g" class="td-lv" :class="{ dim: row.levels[g] === '—' }">{{ row.levels[g] }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section class="learners" v-if="eggLearners.length">
        <h2>蛋招式 <span class="count">{{ eggLearners.length }} 只</span></h2>
        <div class="learner-grid">
          <router-link
            v-for="l in eggLearners"
            :key="l.id"
            :to="`/pokemon/${l.id}`"
            class="learner"
          >
            <div class="learner-img">
              <SafeImage
                v-if="l.image"
                :src="imageUrl('official', l.image)"
                :alt="l.nameZh"
              />
              <span v-else class="learner-unknown">?</span>
            </div>
            <div class="learner-id">#{{ l.id }}</div>
            <div class="learner-name">{{ l.nameZh }}</div>
            <div class="learner-lv egg">蛋</div>
          </router-link>
        </div>
      </section>

      <section class="learners" v-if="machineLearners.length">
        <h2>招式学习器 <span class="count">{{ machineLearners.length }} 只</span></h2>
        <div class="learner-grid">
          <router-link
            v-for="l in machineLearners"
            :key="l.id"
            :to="`/pokemon/${l.id}`"
            class="learner"
          >
            <div class="learner-img">
              <SafeImage
                v-if="l.image"
                :src="imageUrl('official', l.image)"
                :alt="l.nameZh"
              />
              <span v-else class="learner-unknown">?</span>
            </div>
            <div class="learner-id">#{{ l.id }}</div>
            <div class="learner-name">{{ l.nameZh }}</div>
            <div class="learner-lv tm">TM</div>
          </router-link>
        </div>
      </section>

      <section class="learners" v-if="tutorLearners.length">
        <h2>教授招式 <span class="count">{{ tutorLearners.length }} 只</span></h2>
        <div class="learner-grid">
          <router-link
            v-for="l in tutorLearners"
            :key="l.id"
            :to="`/pokemon/${l.id}`"
            class="learner"
          >
            <div class="learner-img">
              <SafeImage
                v-if="l.image"
                :src="imageUrl('official', l.image)"
                :alt="l.nameZh"
              />
              <span v-else class="learner-unknown">?</span>
            </div>
            <div class="learner-id">#{{ l.id }}</div>
            <div class="learner-name">{{ l.nameZh }}</div>
            <div class="learner-lv tutor">教授</div>
          </router-link>
        </div>
      </section>
    </template>
  </div>
</template>

<style scoped>
.page {
  min-height: 60vh;
}
.back {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: var(--text-2);
  font-size: 14px;
  cursor: pointer;
  padding: 6px 10px;
  margin-bottom: 16px;
  border-radius: 8px;
  transition: background 0.15s, color 0.15s;
}
.back:hover {
  background: var(--surface-3);
  color: var(--text);
}
.back-icon {
  font-size: 18px;
  line-height: 1;
}
.sk-hero {
  height: 220px;
  border-radius: 18px;
  background: var(--surface);
  position: relative;
  overflow: hidden;
}
.sk-hero::after {
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
.error {
  padding: 40px;
  text-align: center;
  color: var(--text-3);
  font-size: 15px;
}
.mv-hero {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 18px;
  padding: 24px;
  margin-bottom: 20px;
  box-shadow: var(--shadow);
}
.mv-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.mv-head h1 {
  margin: 0;
  font-size: 26px;
  color: var(--text);
}
.mv-gen {
  font-size: 12px;
  color: var(--text-3);
  background: var(--surface-3);
  padding: 3px 10px;
  border-radius: 999px;
}
.mv-badges {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}
.mv-stats {
  display: flex;
  gap: 32px;
  margin-bottom: 14px;
}
.stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.stat-label {
  font-size: 12px;
  color: var(--text-3);
}
.stat b {
  font-size: 18px;
  color: var(--text);
}
.mv-machines {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 14px;
}
.tm-chip {
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  letter-spacing: 0.5px;
}
.tm-chip.tm {
  color: var(--accent);
  background: var(--accent-soft);
}
.tm-chip.tr {
  color: var(--z-move);
  background: var(--z-move-soft);
}
.mv-desc {
  margin: 0;
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-2);
}
.extra-section {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  padding: 16px 20px;
  margin-bottom: 20px;
  box-shadow: var(--shadow);
}
.flag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 12px;
}
.flag-tag {
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--surface-3);
  color: var(--text-2);
}
.extra-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 13px;
}
.extra-label {
  font-weight: 700;
  color: var(--text-3);
  min-width: 72px;
}
.extra-val {
  font-weight: 600;
  color: var(--text);
}
.extra-sub {
  color: var(--text-3);
  font-size: 12px;
}
.extra-sub::before {
  content: '·';
  margin-right: 4px;
}
.extra-effect {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--border-faint);
}
.extra-effect h3 {
  font-size: 14px;
  font-weight: 700;
  margin: 0 0 8px;
  color: var(--text);
}
.extra-effect p {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-2);
  white-space: pre-line;
}
.learners h2 {
  margin: 0 0 16px;
  font-size: 18px;
  color: var(--text);
}
.learners .count {
  font-size: 13px;
  color: var(--text-3);
  font-weight: 400;
}
.no-learners {
  padding: 40px;
  text-align: center;
  color: var(--text-3);
  font-size: 14px;
  background: var(--surface);
  border: 1px dashed var(--border);
  border-radius: 14px;
}
.gen-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-faint);
  border-radius: 12px;
  background: var(--surface);
}
.gen-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 640px;
}
.gen-table th {
  text-align: center;
  padding: 8px 6px;
  font-weight: 600;
  color: var(--text-3);
  background: var(--surface-2);
  border-bottom: 1px solid var(--border-faint);
  white-space: nowrap;
}
.gen-table th:first-child {
  text-align: left;
  padding-left: 12px;
  position: sticky;
  left: 0;
  z-index: 2;
  background: var(--surface-2);
}
.gen-table td {
  text-align: center;
  padding: 8px 6px;
  border-bottom: 1px solid var(--border-faint);
  vertical-align: middle;
}
.gen-table tr:last-child td {
  border-bottom: none;
}
.gen-table tr:hover td {
  background: var(--hover-bg);
}
.td-mon {
  text-align: left;
  padding-left: 12px;
  position: sticky;
  left: 0;
  background: var(--surface);
  z-index: 1;
}
.gen-table tr:hover .td-mon {
  background: var(--hover-bg);
}
.td-link {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: inherit;
}
.td-img {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  object-fit: contain;
  background: var(--surface-2);
}
.td-name {
  font-weight: 600;
  color: var(--text);
  white-space: nowrap;
}
.td-id {
  color: var(--text-faint);
  font-size: 11px;
  margin-left: -2px;
}
.td-lv {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}
.td-lv.dim {
  color: var(--text-faint);
}
.learner-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 12px;
}
.learner {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  padding: 12px 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, transform 0.15s;
}
.learner:hover {
  border-color: var(--border);
  transform: translateY(-2px);
}
.learner-img {
  width: 76px;
  height: 76px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-2);
  border-radius: 12px;
  overflow: hidden;
}
.learner-img :deep(img) {
  max-width: 68px;
  max-height: 68px;
}
.learner-img :deep(.img-fallback) {
  color: var(--text-faint);
}
.learner-unknown {
  font-size: 24px;
  color: var(--text-3);
}
.learner-name {
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  text-align: center;
  word-break: break-word;
  line-height: 1.4;
}
.learner-id {
  font-size: 11px;
  color: var(--text-3);
  text-align: center;
}
.learner-lvs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
  margin-top: 4px;
}
.learner-lv {
  font-size: 10px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
  color: var(--text-2);
  background: var(--surface-3);
  white-space: nowrap;
  line-height: 1.3;
}
.learner-lv.egg {
  background: var(--method-pink);
}
.learner-lv.tm {
  background: var(--method-blue);
}
.learner-lv.tutor {
  background: var(--method-purple);
}
.learner-methods {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: center;
}
.method {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 7px;
  border-radius: 999px;
}
.method-升级 {
  color: var(--accent);
  background: var(--accent-soft);
}
.method-机器 {
  color: var(--method-blue);
  background: var(--method-blue-bg);
}
.method-蛋 {
  color: var(--method-pink);
  background: var(--method-pink-bg);
}
</style>