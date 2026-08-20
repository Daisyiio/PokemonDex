<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  listGeneticsSpecies,
  getGeneticsEggMoves,
  postGeneticsPlan,
} from '../api'
import {
  imageUrl,
  typeColor,
  categoryColor,
  type GeneticsBrief,
  type GeneticsEggMovesResponse,
  type GeneticsPlan,
} from '../types'
import SafeImage from '../components/SafeImage.vue'

const loading = ref(true)
const error = ref('')
const species = ref<GeneticsBrief[]>([])
const search = ref('')
const targetId = ref('')
const eggMovesData = ref<GeneticsEggMovesResponse | null>(null)
const movesLoading = ref(false)
const selectedMoves = ref<string[]>([])
const generation = ref(6)
const plan = ref<GeneticsPlan | null>(null)
const computing = ref(false)

const filteredSpecies = computed(() => {
  const q = search.value.trim()
  if (!q) return species.value
  return species.value.filter(
    (s: GeneticsBrief) => s.nameZh.includes(q) || s.id.includes(q) || s.nameEn?.toLowerCase().includes(q.toLowerCase()),
  )
})

async function pickTarget(id: string) {
  targetId.value = id
  selectedMoves.value = []
  plan.value = null
  error.value = ''
  movesLoading.value = true
  try {
    eggMovesData.value = await getGeneticsEggMoves(id)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    movesLoading.value = false
  }
}

function clearTarget() {
  targetId.value = ''
  eggMovesData.value = null
  selectedMoves.value = []
  plan.value = null
  error.value = ''
}

function toggleMove(name: string) {
  const i = selectedMoves.value.indexOf(name)
  if (i >= 0) selectedMoves.value.splice(i, 1)
  else if (selectedMoves.value.length < 4) selectedMoves.value.push(name)
}

async function compute() {
  if (!targetId.value) return
  computing.value = true
  error.value = ''
  plan.value = null
  try {
    plan.value = await postGeneticsPlan({
      targetId: targetId.value,
      moves: selectedMoves.value,
      generation: generation.value,
    })
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    computing.value = false
  }
}

onMounted(async () => {
  try {
    species.value = await listGeneticsSpecies()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="page">
    <div class="page-head">
      <h1>蛋招式遗传规划</h1>
      <div class="page-total">自动推导遗传路径 · 直接配对 / 连锁遗传</div>
    </div>

    <p class="intro">
      选择目标宝可梦和想要的蛋招式，系统自动计算孵蛋方案：优先输出直接配对方案，无法直接配对则推导连锁遗传路径。
    </p>

    <div v-if="error" class="error">{{ error }}</div>

    <!-- 输入区 -->
    <div class="input-area">
      <!-- 目标选择 -->
      <div class="search-box">
        <input v-model="search" type="text" placeholder="搜索目标宝可梦（名称 / 编号）" :disabled="!!targetId" />
        <button v-if="targetId" class="btn-back" @click="clearTarget">换一个</button>
      </div>

      <div v-if="!targetId && loading" class="grid">
        <div v-for="i in 10" :key="i" class="sk-card"></div>
      </div>
      <div v-if="!targetId && !loading" class="grid">
        <button
          v-for="s in filteredSpecies"
          :key="s.id"
          class="card"
          @click="pickTarget(s.id)"
        >
          <div class="card-img" :style="{ background: `linear-gradient(160deg, ${typeColor(s.types[0] || '一般')}22, var(--surface-2))` }">
            <SafeImage v-if="s.image" :src="imageUrl('official', s.image)" :alt="s.nameZh" />
          </div>
          <div class="card-id">#{{ s.id }}</div>
          <div class="card-name">{{ s.nameZh }}</div>
          <div class="card-eg">{{ s.eggGroups.join(' / ') }}</div>
        </button>
      </div>

      <!-- 蛋招式选择 -->
      <div v-if="targetId && eggMovesData" class="moves-panel">
        <div class="panel-head">
          <SafeImage v-if="eggMovesData.target.image" :src="imageUrl('official', eggMovesData.target.image)" :alt="eggMovesData.target.nameZh" class="panel-img" />
          <div class="panel-info">
            <span class="panel-name">{{ eggMovesData.target.nameZh }}</span>
            <span class="panel-eg">{{ eggMovesData.eggGroups.join(' / ') }}</span>
          </div>
        </div>

        <div v-if="eggMovesData.eggMoves.length === 0" class="empty">该宝可梦没有蛋招式。</div>
        <div v-else class="moves-list">
          <div class="moves-title">
            期望蛋招式（已选 {{ selectedMoves.length }}/4）
          </div>
          <label
            v-for="m in eggMovesData.eggMoves"
            :key="m.name"
            class="move-item"
            :class="{ on: selectedMoves.includes(m.name), dis: selectedMoves.length >= 4 && !selectedMoves.includes(m.name) }"
          >
            <input
              type="checkbox"
              :checked="selectedMoves.includes(m.name)"
              :disabled="selectedMoves.length >= 4 && !selectedMoves.includes(m.name)"
              @change="toggleMove(m.name)"
            />
            <span class="move-name">{{ m.name }}</span>
            <span class="chip" :style="{ color: typeColor(m.type), borderColor: typeColor(m.type) + '55' }">{{ m.type }}</span>
            <span class="chip" :style="{ color: categoryColor(m.category) }">{{ m.category }}</span>
            <span class="move-parents">父方：{{ m.parents.map((p) => p.name).join('、') }}</span>
          </label>
        </div>

        <!-- 世代选择 -->
        <div class="gen-select">
          <span class="gen-label">世代规则</span>
          <select v-model="generation" class="gen-dropdown">
            <option :value="5">第5世代及更早（仅父方传递）</option>
            <option :value="6">第6~9世代（父母双方均可传递）</option>
          </select>
        </div>

        <button class="btn-main" :disabled="selectedMoves.length === 0 || computing" @click="compute">
          {{ computing ? '计算中…' : '开始计算' }}
        </button>
      </div>
    </div>

    <!-- 结果区 -->
    <div v-if="plan" class="results">
      <div v-if="plan.specialNote" class="special-note">{{ plan.specialNote }}</div>

      <!-- 合并方案 -->
      <div v-if="plan.combinedDirect && !plan.specialNote" class="result-card combined">
        <div class="rc-head">
          <span class="rc-badge ok">一站式方案</span>
          <span class="rc-title">一个父方即可遗传全部招式</span>
        </div>
        <div class="rc-body">
          <div class="rc-step">
            <span class="rc-role">母方</span>
            <router-link :to="`/pokemon/${plan.target.id}`" class="rc-link">{{ plan.target.nameZh }}</router-link>
            <span class="rc-gender">♀</span>
            <span class="rc-x">×</span>
            <span class="rc-role">父方</span>
            <router-link :to="`/pokemon/${plan.combinedDirect.father.id}`" class="rc-link">{{ plan.combinedDirect.father.nameZh }}</router-link>
            <span class="rc-gender">♂</span>
          </div>
          <div class="rc-eg">共享蛋组：{{ plan.combinedDirect.sharedEggGroup }}</div>
          <div v-if="plan.combinedDirect.learnInfo" class="rc-learn">
            <span v-for="li in plan.combinedDirect.learnInfo" :key="li.move" class="learn-tag">
              {{ li.move }}：{{ li.level === '—' ? '初始' : 'Lv.' + li.level }}
            </span>
          </div>
          <div class="rc-note">父方需先习得上述招式，放入饲育屋后子代{{ plan.target.nameZh }}自带全部所选蛋招式</div>
          <div v-if="plan.combinedDirect.candidates.length > 1" class="rc-cands">
            其他候选父本：
            <span v-for="c in plan.combinedDirect.candidates.slice(1)" :key="c.id" class="cand-tag">
              <router-link :to="`/pokemon/${c.id}`" class="rc-link">{{ c.nameZh }}</router-link>
            </span>
          </div>
        </div>
      </div>

      <!-- 逐招式结果 -->
      <div v-for="mr in plan.moveResults" :key="mr.move" class="result-card" :class="{ bad: !mr.valid }">
        <div class="rc-head">
          <span class="rc-badge" :class="mr.valid ? 'ok' : 'no'">{{ mr.valid ? '蛋招式' : '不可遗传' }}</span>
          <span class="rc-title">{{ mr.move }}</span>
        </div>

        <div v-if="!mr.valid" class="rc-reason">{{ mr.reason }}</div>

        <div v-else-if="mr.reason && (!mr.solutions || mr.solutions.length === 0)" class="rc-reason">{{ mr.reason }}</div>

        <div v-else>
          <div v-for="(sol, si) in mr.solutions" :key="si" class="solution">
            <div class="sol-head">
              <span class="sol-badge" :class="sol.type === 'direct' ? 'ok' : 'chain'">
                {{ sol.type === 'direct' ? '直接孵蛋方案（一步完成）' : `连锁遗传（${sol.stepCount}步完成）` }}
              </span>
            </div>

            <div v-for="(step, ti) in sol.steps" :key="ti" class="step">
              <div class="step-num">第{{ ti + 1 }}步</div>
              <div class="step-body">
                <span class="rc-role">父</span>
                <router-link :to="`/pokemon/${step.father.id}`" class="rc-link">{{ step.father.nameZh }}</router-link>
                <span class="rc-gender">♂</span>
                <span class="rc-x">×</span>
                <span class="rc-role">母</span>
                <router-link :to="`/pokemon/${step.mother.id}`" class="rc-link">{{ step.mother.nameZh }}</router-link>
                <span v-if="step.mother.genderRatio.female > 0" class="rc-gender">♀</span>
                <span v-else class="rc-gender">⚲</span>
              </div>
              <div class="step-eg">共享蛋组：{{ step.sharedEggGroup }}</div>
              <div class="step-note">{{ step.note }}</div>
            </div>

            <div v-if="sol.type === 'direct' && sol.candidates && sol.candidates.length > 1" class="sol-cands">
              其他候选父本：
              <span v-for="c in sol.candidates.slice(1)" :key="c.id" class="cand-tag">
                <router-link :to="`/pokemon/${c.id}`" class="rc-link">{{ c.nameZh }}</router-link>
                <span class="cand-lv">{{ c.learnLevel === '—' ? '初始' : 'Lv.' + c.learnLevel }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page { min-height: 60vh; }
.page-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 8px;
}
.page-head h1 { font-size: 24px; margin: 0; color: var(--text); }
.page-total { font-size: 13px; color: var(--text-3); }
.intro {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-3);
  line-height: 1.7;
}
.error {
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid var(--danger);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 13px;
  margin-bottom: 14px;
}
.search-box {
  display: flex;
  gap: 10px;
  margin-bottom: 14px;
}
.search-box input {
  flex: 1;
  max-width: 400px;
  padding: 9px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  outline: none;
}
.search-box input:focus { border-color: var(--accent); }
.btn-back {
  padding: 8px 16px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.btn-back:hover { border-color: var(--accent); color: var(--accent); }
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(104px, 1fr));
  gap: 10px;
}
.card {
  text-align: center;
  padding: 10px;
  border-radius: 12px;
  border: 1px solid var(--border-faint);
  background: var(--surface);
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s, box-shadow 0.15s;
  font: inherit;
  color: inherit;
}
.card:hover {
  transform: translateY(-2px);
  border-color: var(--accent);
  box-shadow: var(--shadow-hover);
}
.card-img {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
.card-img img { max-width: 56px; max-height: 56px; }
.card-id { margin-top: 5px; font-size: 10px; color: var(--text-faint); font-weight: 600; }
.card-name { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card-eg { font-size: 10px; color: var(--text-3); }
.moves-panel {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  padding: 16px;
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.panel-img { width: 40px; height: 40px; object-fit: contain; }
.panel-name { font-size: 16px; font-weight: 800; color: var(--text); }
.panel-eg { font-size: 12px; color: var(--text-3); display: block; }
.moves-title { font-size: 13px; font-weight: 700; color: var(--text-2); margin-bottom: 8px; }
.moves-list {
  max-height: 320px;
  overflow-y: auto;
  border: 1px solid var(--border-faint);
  border-radius: 10px;
  padding: 6px;
  background: var(--surface-2);
}
.move-item {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-2);
}
.move-item:hover { background: var(--surface-3); }
.move-item.on { background: var(--accent-soft); color: var(--text); }
.move-item.dis { opacity: 0.4; cursor: not-allowed; }
.move-item input { accent-color: var(--accent); }
.move-name { font-weight: 600; }
.chip { font-size: 10px; border: 1px solid transparent; border-radius: 999px; padding: 1px 7px; }
.move-parents { font-size: 11px; color: var(--text-faint); width: 100%; padding-left: 24px; }
.gen-select {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 0;
}
.gen-label { font-size: 13px; font-weight: 700; color: var(--text-2); }
.gen-dropdown {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  outline: none;
}
.btn-main {
  padding: 11px 28px;
  border-radius: 12px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s;
}
.btn-main:hover:not(:disabled) { opacity: 0.92; }
.btn-main:disabled { opacity: 0.4; cursor: not-allowed; }
.empty { font-size: 13px; color: var(--text-3); padding: 20px; text-align: center; }

.results { margin-top: 20px; }
.special-note {
  background: var(--danger-soft);
  color: var(--danger);
  border: 1px solid var(--danger);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 13px;
  margin-bottom: 14px;
  line-height: 1.6;
}
.result-card {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  padding: 14px 16px;
  margin-bottom: 12px;
}
.result-card.combined { border-color: var(--ok); }
.result-card.bad { border-color: var(--danger); }
.rc-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.rc-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
}
.rc-badge.ok { background: var(--ok-soft); color: var(--ok); }
.rc-badge.no { background: var(--danger-soft); color: var(--danger); }
.rc-title { font-size: 15px; font-weight: 700; color: var(--text); }
.rc-body { font-size: 14px; color: var(--text-2); }
.rc-step { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; margin-bottom: 6px; }
.rc-role { font-size: 12px; color: var(--text-3); }
.rc-link { color: var(--accent); text-decoration: none; font-weight: 600; }
.rc-link:hover { text-decoration: underline; }
.rc-gender { font-size: 14px; font-weight: 700; }
.rc-gender { color: var(--text-3); }
.rc-x { color: var(--text-faint); margin: 0 4px; }
.rc-eg { font-size: 12px; color: var(--text-3); margin-bottom: 4px; }
.rc-note { font-size: 12px; color: var(--text-3); line-height: 1.5; }
.rc-cands { font-size: 12px; color: var(--text-3); margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }
.rc-reason { font-size: 13px; color: var(--danger); line-height: 1.6; }
.solution {
  border: 1px solid var(--border-faint);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 8px;
  background: var(--surface-2);
}
.sol-head { margin-bottom: 8px; }
.sol-badge {
  font-size: 12px;
  font-weight: 700;
  padding: 3px 12px;
  border-radius: 999px;
}
.sol-badge.ok { background: var(--ok-soft); color: var(--ok); }
.sol-badge.chain { background: var(--accent-soft); color: var(--accent); }
.step {
  padding: 8px 10px;
  border-left: 3px solid var(--accent);
  margin-bottom: 6px;
  background: var(--surface);
  border-radius: 0 8px 8px 0;
}
.step-num { font-size: 11px; font-weight: 700; color: var(--accent); margin-bottom: 4px; }
.step-body { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; font-size: 14px; }
.step-eg { font-size: 12px; color: var(--text-3); margin: 4px 0; }
.step-note { font-size: 12px; color: var(--text-3); line-height: 1.5; }
.sol-cands { font-size: 12px; color: var(--text-3); margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
.cand-tag { display: inline-flex; align-items: center; gap: 4px; }
.cand-lv { font-size: 10px; color: var(--accent); background: var(--accent-soft); border-radius: 999px; padding: 1px 6px; }
.rc-learn { display: flex; flex-wrap: wrap; gap: 6px; margin: 6px 0; }
.learn-tag { font-size: 11px; color: var(--ok); background: var(--ok-soft); border-radius: 999px; padding: 2px 8px; }
.sk-card {
  height: 120px;
  border-radius: 12px;
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
  .grid { grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); }
}
</style>