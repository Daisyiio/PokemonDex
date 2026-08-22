<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  listBreedingSpecies,
  getBreedingMoves,
  postBreedingPlan,
  postBreedingSimulate,
} from '../api'
import {
  imageUrl,
  typeColor,
  categoryColor,
  type BreedingSpecies,
  type BreedingMovesResponse,
  type BreedingPlan,
  type BreedingBrief,
  type BreedingResult,
} from '../types'
import SafeImage from '../components/SafeImage.vue'

const NATURES = [
  '勤奋', '坦率', '害羞', '认真', '浮躁',
  '孤僻', '固执', '顽皮', '勇敢',
  '大胆', '淘气', '悠闲', '乐天',
  '内敛', '慢吞吞', '冷静', '马虎',
  '温和', '温顺', '自大', '慎重',
  '胆小', '急躁', '爽朗', '天真',
]

const step = ref<1 | 2 | 3>(1)
const loading = ref(true)
const error = ref('')
const species = ref<BreedingSpecies[]>([])
const search = ref('')
const targetId = ref('')
const movesData = ref<BreedingMovesResponse | null>(null)
const movesLoading = ref(false)
const selectedMoves = ref<string[]>([])
const plan = ref<BreedingPlan | null>(null)
const motherId = ref('')
const fatherId = ref('')
const everstone = ref(false)
const destinyKnot = ref(false)
const motherNature = ref('')
const fatherNature = ref('')
const result = ref<BreedingResult | null>(null)
const simulating = ref(false)

const targetOptions = computed(() => {
  const q = search.value.trim()
  const list = species.value.filter((s) => s.breedable && s.isBaseForm)
  if (!q) return list
  return list.filter(
    (s) =>
      s.nameZh.includes(q) ||
      s.nameEn?.toLowerCase().includes(q.toLowerCase()) ||
      s.id.includes(q),
  )
})

async function pickTarget(id: string) {
  targetId.value = id
  selectedMoves.value = []
  plan.value = null
  motherId.value = ''
  fatherId.value = ''
  result.value = null
  movesLoading.value = true
  error.value = ''
  try {
    movesData.value = await getBreedingMoves(id)
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    movesLoading.value = false
  }
}

function clearTarget() {
  targetId.value = ''
  movesData.value = null
  selectedMoves.value = []
}

function toggleMove(name: string) {
  const i = selectedMoves.value.indexOf(name)
  if (i >= 0) selectedMoves.value.splice(i, 1)
  else selectedMoves.value.push(name)
}

async function goPlan() {
  if (!targetId.value) return
  error.value = ''
  try {
    const p = await postBreedingPlan({ targetId: targetId.value, moves: selectedMoves.value })
    plan.value = p
    motherId.value = ''
    fatherId.value = ''
    result.value = null
    step.value = 2
  } catch (e) {
    error.value = (e as Error).message
  }
}

function genderText(s: BreedingBrief) {
  if (s.genderRatio.male === 0 && s.genderRatio.female === 0) return '无性别'
  return `♀${s.genderRatio.female}% / ♂${s.genderRatio.male}%`
}

async function simulate() {
  if (!plan.value || !motherId.value || !fatherId.value) return
  simulating.value = true
  error.value = ''
  try {
    const r = await postBreedingSimulate({
      targetId: plan.value.target.id,
      moves: selectedMoves.value,
      motherId: motherId.value,
      fatherId: fatherId.value,
      everstone: everstone.value,
      destinyKnot: destinyKnot.value,
      motherNature: motherNature.value || undefined,
      fatherNature: fatherNature.value || undefined,
    })
    result.value = r
    step.value = 3
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    simulating.value = false
  }
}

function restart() {
  step.value = 1
  targetId.value = ''
  movesData.value = null
  selectedMoves.value = []
  plan.value = null
  motherId.value = ''
  fatherId.value = ''
  everstone.value = false
  destinyKnot.value = false
  result.value = null
  error.value = ''
}

function ivClass(v: number) {
  if (v >= 31) return 'iv-max'
  if (v >= 25) return 'iv-good'
  if (v >= 16) return 'iv-mid'
  if (v >= 6) return 'iv-low'
  return 'iv-bad'
}

onMounted(async () => {
  try {
    species.value = await listBreedingSpecies()
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
      <h1>孵蛋模拟器</h1>
      <div class="page-total">目标驱动 · 遗传模拟</div>
    </div>

    <div class="steps">
      <div class="step" :class="{ on: step === 1, done: step > 1 }">
        <span class="step-no">1</span> 选择目标
      </div>
      <div class="step" :class="{ on: step === 2, done: step > 2 }">
        <span class="step-no">2</span> 选择父母
      </div>
      <div class="step" :class="{ on: step === 3 }">
        <span class="step-no">3</span> 孵化结果
      </div>
    </div>

    <div v-if="error" class="error">{{ error }}</div>

    <!-- 步骤1：选择目标 -->
    <template v-if="step === 1">
      <p class="intro">
        先定一个最终目标：想要什么样的宝可梦（比如<b>会「双倍奉还」的小锯鳄</b>）。
        选好种族并勾选想要的招式，我们会反推父方与母方各自需要满足的条件。
      </p>

      <div class="search-box">
        <input v-model="search" type="text" placeholder="搜索名称 / 编号 / 英文名…" />
        <span class="search-count">可选 {{ targetOptions.length }} 只</span>
      </div>

      <div v-if="!targetId && loading" class="grid">
        <div v-for="i in 12" :key="i" class="sk-card"></div>
      </div>
      <div v-if="!targetId && !loading" class="grid">
        <button
          v-for="s in targetOptions"
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

      <div v-if="targetId" class="moves-panel">
        <div class="panel-head">
          <div class="panel-title">
            <SafeImage v-if="movesData?.target.image" :src="imageUrl('official', movesData.target.image)" :alt="movesData.target.nameZh" class="panel-img" />
            <span>{{ movesData?.target.nameZh }} 可获得的招式</span>
          </div>
          <button class="panel-back" @click="clearTarget">换一个</button>
        </div>
        <div v-if="movesLoading" class="hint">加载中…</div>
        <div v-else class="moves-groups">
          <div class="mg">
            <div class="mg-title">升级招式（自学）</div>
            <div class="mg-list">
              <label v-for="m in movesData?.learnable ?? []" :key="'l' + m.name" class="mi" :class="{ on: selectedMoves.includes(m.name) }">
                <input type="checkbox" :checked="selectedMoves.includes(m.name)" @change="toggleMove(m.name)" />
                <span class="mi-level">{{ m.level }}</span>
                <span class="mi-name">{{ m.name }}</span>
                <span class="chip" :style="{ color: typeColor(m.type), borderColor: typeColor(m.type) + '55' }">{{ m.type }}</span>
                <span class="chip" :style="{ color: categoryColor(m.category) }">{{ m.category }}</span>
              </label>
            </div>
          </div>
          <div class="mg">
            <div class="mg-title">招式学习器（自学）</div>
            <div class="mg-list">
              <label v-for="m in movesData?.machine ?? []" :key="'m' + m.name" class="mi" :class="{ on: selectedMoves.includes(m.name) }">
                <input type="checkbox" :checked="selectedMoves.includes(m.name)" @change="toggleMove(m.name)" />
                <span class="mi-level">TM</span>
                <span class="mi-name">{{ m.name }}</span>
                <span class="chip" :style="{ color: typeColor(m.type), borderColor: typeColor(m.type) + '55' }">{{ m.type }}</span>
                <span class="chip" :style="{ color: categoryColor(m.category) }">{{ m.category }}</span>
              </label>
            </div>
          </div>
          <div class="mg">
            <div class="mg-title">蛋招式（需父方遗传）</div>
            <div class="mg-list">
              <label v-for="m in movesData?.egg ?? []" :key="'e' + m.name" class="mi" :class="{ on: selectedMoves.includes(m.name) }">
                <input type="checkbox" :checked="selectedMoves.includes(m.name)" @change="toggleMove(m.name)" />
                <span class="mi-level">蛋</span>
                <span class="mi-name">{{ m.name }}</span>
                <span class="chip" :style="{ color: typeColor(m.type), borderColor: typeColor(m.type) + '55' }">{{ m.type }}</span>
                <span class="chip" :style="{ color: categoryColor(m.category) }">{{ m.category }}</span>
                <span class="mi-tip">父方可遗传：{{ m.parents.map((p) => p.name).join('、') }}</span>
              </label>
            </div>
          </div>
        </div>
        <button class="btn-main" :disabled="!targetId" @click="goPlan">下一步：选择父母 →</button>
      </div>
    </template>

    <!-- 步骤2：选择父母 -->
    <template v-else-if="step === 2 && plan">
      <div class="goal-bar">
        <SafeImage v-if="plan.target.image" :src="imageUrl('official', plan.target.image)" :alt="plan.target.nameZh" class="goal-img" />
        <div class="goal-info">
          <div class="goal-name">目标：{{ plan.target.nameZh }} <span class="goal-id">#{{ plan.target.id }}</span></div>
          <div v-if="plan.selfMoveNames.length" class="goal-moves">
            可自学：<span v-for="m in plan.selfMoveNames" :key="m" class="mk mk-ok">{{ m }}</span>
          </div>
          <div v-if="plan.requiredEgg.length" class="goal-moves">
            需父方遗传：<span v-for="m in plan.requiredEgg" :key="m.name" class="mk mk-egg">{{ m.name }}</span>
          </div>
          <div v-if="plan.infeasible.length" class="goal-moves">
            无法获得：<span v-for="m in plan.infeasible" :key="m" class="mk mk-bad">{{ m }}</span>
          </div>
        </div>
      </div>

      <div class="parents">
        <div class="pbox">
          <div class="pbox-head">
            <span class="picon" style="color: #e05a7a">♀</span> 母方
            <span class="pneed">条件：{{ plan.mother.requirement }}</span>
          </div>
          <div class="pbox-list">
            <button
              v-for="c in plan.mother.candidates"
              :key="'mo' + c.id"
              class="pcand"
              :class="{ sel: motherId === c.id }"
              @click="motherId = c.id"
            >
              <SafeImage v-if="c.image" :src="imageUrl('official', c.image)" :alt="c.nameZh" class="pcand-img" />
              <div class="pcand-name">{{ c.nameZh }}</div>
              <div class="pcand-eg">{{ c.eggGroups.join(' / ') }}</div>
              <div class="pcand-g">{{ genderText(c) }}</div>
            </button>
            <div v-if="!plan.mother.candidates.length" class="none">无可用母方</div>
          </div>
        </div>

        <div class="pbox">
          <div class="pbox-head">
            <span class="picon" style="color: #4f86e0">♂</span> 父方
            <span class="pneed">条件：{{ plan.father.requirement }}</span>
          </div>
          <div class="pbox-list">
            <button
              v-for="c in plan.father.candidates"
              :key="'fa' + c.id"
              class="pcand"
              :class="{ sel: fatherId === c.id }"
              @click="fatherId = c.id"
            >
              <SafeImage v-if="c.image" :src="imageUrl('official', c.image)" :alt="c.nameZh" class="pcand-img" />
              <div class="pcand-name">{{ c.nameZh }}</div>
              <div class="pcand-eg">{{ c.eggGroups.join(' / ') }}</div>
              <div class="pcand-g">{{ genderText(c) }}</div>
            </button>
            <div v-if="!plan.father.candidates.length" class="none">无可达成目标的父方，请减少蛋招式目标</div>
          </div>
        </div>
      </div>

      <div class="items">
        <label class="it">
          <input v-model="everstone" type="checkbox" />
          <span class="it-name">不变石</span>
          <span class="it-desc">锁定性格，遗传自携带方</span>
        </label>
        <label class="it">
          <input v-model="destinyKnot" type="checkbox" />
          <span class="it-name">红线</span>
          <span class="it-desc">子代继承 5 项个体值</span>
        </label>
      </div>
      <div v-if="everstone" class="natures">
        <label class="nat">
          <span>母方性格</span>
          <select v-model="motherNature">
            <option value="">随机</option>
            <option v-for="n in NATURES" :key="n" :value="n">{{ n }}</option>
          </select>
        </label>
        <label class="nat">
          <span>父方性格</span>
          <select v-model="fatherNature">
            <option value="">随机</option>
            <option v-for="n in NATURES" :key="n" :value="n">{{ n }}</option>
          </select>
        </label>
      </div>

      <button class="btn-main" :disabled="!motherId || !fatherId || simulating" @click="simulate">
        {{ simulating ? '孵蛋中…' : '开始孵蛋 →' }}
      </button>
    </template>

    <!-- 步骤3：结果 -->
    <template v-else-if="step === 3 && result">
      <div class="result" :class="{ shiny: result.shiny }">
        <div v-if="result.shiny" class="shiny-badge">异色！ 1/4096</div>
        <div class="r-head">
          <div class="r-img-wrap">
            <SafeImage v-if="result.child.image" :src="imageUrl('official', result.child.image)" :alt="result.child.nameZh" class="r-img" />
          </div>
          <div class="r-info">
            <div class="r-name">{{ result.child.nameZh }}
              <span class="r-id">#{{ result.child.id }}</span>
              <span class="r-gender">{{ result.gender }}</span>
            </div>
            <div class="r-chips">
              <span v-for="t in result.child.types" :key="t" class="type-chip" :style="{ color: typeColor(t), borderColor: typeColor(t) + '55', background: typeColor(t) + '18' }">{{ t }}</span>
              <span class="type-chip">{{ result.child.eggGroups.join(' / ') }}</span>
            </div>
            <div class="r-parents">
              父母：<router-link :to="`/pokemon/${result.father.id}`" class="r-link">{{ result.father.nameZh }}</router-link>
              ♂ ×
              <router-link :to="`/pokemon/${result.mother.id}`" class="r-link">{{ result.mother.nameZh }}</router-link>
              ♀
            </div>
            <div class="r-steps">孵化需 {{ result.steps ?? '?' }} 步（{{ result.eggCycles }}）</div>
          </div>
        </div>

        <div class="r-grid">
          <div class="r-card">
            <div class="r-card-title">性格</div>
            <div class="r-nature">{{ result.nature.name }}</div>
            <div v-if="result.nature.raised" class="r-nature-mod">
              +{{ result.nature.raised }} <span class="dim">/ −{{ result.nature.lowered }}</span>
            </div>
          </div>
          <div class="r-card">
            <div class="r-card-title">特性</div>
            <div class="r-ability">{{ result.ability.name }}</div>
            <div class="r-ability-tag" :class="{ hid: result.ability.isHidden }">
              {{ result.ability.isHidden ? '隐藏特性' : '普通特性' }}
            </div>
          </div>
          <div class="r-card">
            <div class="r-card-title">个体值（50级）</div>
            <div class="r-ivs">
              <div v-for="iv in result.ivs" :key="iv.key" class="r-iv">
                <span class="r-iv-stat">{{ iv.stat }}</span>
                <span class="r-iv-val" :class="ivClass(iv.value)">{{ iv.value }}</span>
                <span class="r-iv-src">{{ iv.source }}</span>
              </div>
            </div>
          </div>
        </div>

        <div class="r-card r-moves">
          <div class="r-card-title">遗传招式</div>
          <div class="r-moves-list">
            <div v-for="m in result.moves" :key="m.name" class="r-move" :class="{ ok: m.ok }">
              <span class="r-move-name">{{ m.name }}</span>
              <span class="r-move-method">{{ m.method }}</span>
            </div>
            <div v-if="!result.moves.length" class="dim">未选择目标招式</div>
          </div>
        </div>

        <div class="r-card r-stats">
          <div class="r-card-title">能力值（等级 50）</div>
          <div class="r-stats-list">
            <div v-for="st in result.stats" :key="st.key" class="r-stat">
              <span class="r-stat-name">{{ st.stat }}</span>
              <div class="r-stat-bar">
                <div
                  class="r-stat-fill"
                  :style="{ width: Math.min(100, (st.value / 200) * 100) + '%', background: st.value >= 180 ? 'var(--accent)' : st.value >= 120 ? 'var(--ok)' : 'var(--text-3)' }"
                ></div>
              </div>
              <span class="r-stat-val">{{ st.value }} <span class="dim">({{ st.base }})</span></span>
            </div>
          </div>
        </div>

        <div class="result-actions">
          <button class="btn-main" @click="simulate">再孵一次</button>
          <button class="btn-ghost" @click="restart">重新选择</button>
          <router-link :to="`/pokemon/${result.child.id}`" class="btn-ghost link">查看图鉴 →</router-link>
        </div>
      </div>
    </template>
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
  margin-bottom: 8px;
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
.intro {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--text-3);
  line-height: 1.7;
}
.intro b {
  color: var(--text);
}

.steps {
  display: flex;
  gap: 8px;
  margin: 14px 0 18px;
}
.step {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-3);
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid var(--border-faint);
  background: var(--surface);
  transition: all 0.15s;
}
.step .step-no {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  background: var(--surface-3);
}
.step.on {
  color: var(--accent);
  background: var(--accent-soft);
}
.step.on .step-no {
  background: var(--accent);
  color: #fff;
}
.step.done {
  color: var(--ok);
  border-color: var(--ok);
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
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}
.search-box input {
  flex: 1;
  max-width: 380px;
  padding: 9px 14px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 14px;
  outline: none;
}
.search-box input:focus {
  border-color: var(--accent);
}
.search-count {
  font-size: 12px;
  color: var(--text-3);
}

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
.card.sel {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.card-img {
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
.card-img img {
  max-width: 56px;
  max-height: 56px;
}
.card-id {
  margin-top: 5px;
  font-size: 10px;
  color: var(--text-faint);
  font-weight: 600;
}
.card-name {
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.card-eg {
  font-size: 10px;
  color: var(--text-3);
}

.moves-panel {
  margin-top: 18px;
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  padding: 16px;
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.panel-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.panel-back {
  margin-left: auto;
  padding: 6px 14px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface-2);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
  font: inherit;
}
.panel-back:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.panel-img {
  width: 34px;
  height: 34px;
  object-fit: contain;
}
.panel-hint {
  font-size: 12px;
  color: var(--text-3);
}
.moves-groups {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
}
.mg-title {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
  margin-bottom: 8px;
}
.mg-list {
  max-height: 260px;
  overflow-y: auto;
  border: 1px solid var(--border-faint);
  border-radius: 10px;
  padding: 6px;
  background: var(--surface-2);
}
.mi {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  border-radius: 8px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text-2);
}
.mi:hover {
  background: var(--surface-3);
}
.mi.on {
  background: var(--accent-soft);
  color: var(--text);
}
.mi input {
  accent-color: var(--accent);
}
.mi-level {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  min-width: 22px;
}
.mi-name {
  font-weight: 600;
}
.chip {
  font-size: 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  padding: 1px 7px;
}
.mi-tip {
  font-size: 11px;
  color: var(--text-faint);
  width: 100%;
  padding-left: 24px;
}

.btn-main {
  margin-top: 16px;
  padding: 11px 26px;
  border-radius: 12px;
  border: none;
  background: var(--accent);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  cursor: pointer;
  transition: opacity 0.15s, transform 0.15s;
}
.btn-main:hover:not(:disabled) {
  transform: translateY(-1px);
  opacity: 0.92;
}
.btn-main:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn-ghost {
  margin-top: 16px;
  padding: 10px 22px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  transition: border-color 0.15s, color 0.15s;
}
.btn-ghost:hover {
  border-color: var(--accent);
  color: var(--accent);
}

.goal-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--accent-soft);
  border: 1px solid var(--accent);
  border-radius: 14px;
  padding: 12px 16px;
  margin-bottom: 16px;
}
.goal-img {
  width: 52px;
  height: 52px;
  object-fit: contain;
}
.goal-name {
  font-size: 16px;
  font-weight: 800;
  color: var(--text);
}
.goal-id {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
}
.goal-moves {
  font-size: 12px;
  color: var(--text-2);
  margin-top: 4px;
}
.mk {
  display: inline-block;
  margin: 2px 4px 0 0;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.mk-ok {
  background: var(--ok-soft);
  color: var(--ok);
}
.mk-egg {
  background: var(--accent-soft);
  color: var(--accent);
}
.mk-bad {
  background: var(--danger-soft);
  color: var(--danger);
}

.parents {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  margin-bottom: 14px;
}
.pbox {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  padding: 14px;
}
.pbox-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 800;
  color: var(--text);
  margin-bottom: 6px;
  flex-wrap: wrap;
}
.picon {
  font-size: 18px;
  font-weight: 900;
}
.pneed {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-3);
  width: 100%;
  line-height: 1.5;
}
.pbox-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
  gap: 8px;
  max-height: 300px;
  overflow-y: auto;
}
.pcand {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid var(--border-faint);
  background: var(--surface-2);
  cursor: pointer;
  font: inherit;
  color: inherit;
  transition: border-color 0.15s, background 0.15s;
}
.pcand:hover {
  border-color: var(--accent);
}
.pcand.sel {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.pcand-img {
  width: 44px;
  height: 44px;
  object-fit: contain;
}
.pcand-name {
  font-size: 12px;
  font-weight: 600;
  text-align: center;
}
.pcand-eg {
  font-size: 10px;
  color: var(--text-faint);
}
.pcand-g {
  font-size: 10px;
  color: var(--text-3);
}
.none {
  grid-column: 1 / -1;
  text-align: center;
  font-size: 12px;
  color: var(--danger);
  padding: 12px;
}

.items {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.it {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border: 1px solid var(--border-faint);
  border-radius: 12px;
  background: var(--surface);
  cursor: pointer;
}
.it input {
  accent-color: var(--accent);
}
.it-name {
  font-weight: 700;
  font-size: 14px;
  color: var(--text);
}
.it-desc {
  font-size: 12px;
  color: var(--text-3);
}
.natures {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.nat {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-2);
}
.nat select {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  cursor: pointer;
}
.nat select:hover { border-color: var(--accent); }

.result {
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 16px;
  padding: 18px;
  position: relative;
  transition: border-color 0.3s, box-shadow 0.3s;
}
.result.shiny {
  border-color: #f5c518;
  box-shadow: 0 0 0 3px rgba(245, 197, 24, 0.25), var(--shadow-hover);
}
.shiny-badge {
  position: absolute;
  top: -12px;
  right: 16px;
  background: linear-gradient(90deg, #f5c518, #ff8a00);
  color: #fff;
  font-weight: 800;
  font-size: 13px;
  padding: 5px 14px;
  border-radius: 999px;
  box-shadow: var(--shadow);
}
.r-head {
  display: flex;
  gap: 16px;
  align-items: center;
  margin-bottom: 14px;
}
.r-img-wrap {
  width: 110px;
  height: 110px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 16px;
  background: linear-gradient(160deg, var(--accent-soft), var(--surface-2));
}
.r-img {
  width: 92px;
  height: 92px;
  object-fit: contain;
}
.r-name {
  font-size: 22px;
  font-weight: 800;
  color: var(--text);
}
.r-id {
  font-size: 13px;
  color: var(--text-3);
  font-weight: 600;
  margin-left: 4px;
}
.r-gender {
  margin-left: 8px;
  font-size: 13px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 2px 10px;
  border-radius: 999px;
}
.r-chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin: 8px 0;
}
.type-chip {
  font-size: 11px;
  font-weight: 600;
  border: 1px solid;
  border-radius: 999px;
  padding: 2px 10px;
}
.r-parents {
  font-size: 13px;
  color: var(--text-2);
}
.r-link {
  color: var(--accent);
  text-decoration: none;
  font-weight: 600;
}
.r-link:hover {
  text-decoration: underline;
}
.r-steps {
  font-size: 12px;
  color: var(--text-3);
  margin-top: 4px;
}

.r-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 12px;
}
.r-card {
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 12px;
  padding: 12px 14px;
}
.r-card-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  margin-bottom: 8px;
  letter-spacing: 1px;
}
.r-nature {
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
}
.r-nature-mod {
  font-size: 12px;
  color: var(--ok);
  margin-top: 2px;
}
.dim {
  color: var(--text-faint);
}
.r-ability {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
}
.r-ability-tag {
  display: inline-block;
  margin-top: 4px;
  font-size: 11px;
  font-weight: 600;
  padding: 1px 9px;
  border-radius: 999px;
  background: var(--surface-3);
  color: var(--text-2);
}
.r-ability-tag.hid {
  background: var(--accent-soft);
  color: var(--accent);
}
.r-ivs {
  display: grid;
  grid-template-columns: 1fr auto auto;
  gap: 4px 10px;
  align-items: center;
}
.r-iv-stat {
  font-size: 12px;
  color: var(--text-2);
}
.r-iv-val {
  font-size: 13px;
  font-weight: 800;
  min-width: 24px;
  text-align: right;
}
.r-iv-src {
  font-size: 10px;
  color: var(--text-faint);
  min-width: 20px;
  text-align: left;
}
.iv-max { color: var(--accent); }
.iv-good { color: var(--ok); }
.iv-mid { color: var(--text); }
.iv-low { color: var(--text-3); }
.iv-bad { color: var(--danger); }

.r-moves-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.r-move {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 8px;
  background: var(--surface);
  border: 1px solid var(--border-faint);
}
.r-move.ok {
  border-color: var(--ok);
}
.r-move:not(.ok) {
  border-color: var(--danger);
}
.r-move-name {
  font-weight: 700;
  font-size: 13px;
  color: var(--text);
}
.r-move-method {
  font-size: 11px;
  color: var(--text-3);
}

.r-stats-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.r-stat {
  display: grid;
  grid-template-columns: 44px 1fr 62px;
  gap: 10px;
  align-items: center;
}
.r-stat-name {
  font-size: 12px;
  color: var(--text-2);
}
.r-stat-bar {
  height: 8px;
  border-radius: 999px;
  background: var(--surface-3);
  overflow: hidden;
}
.r-stat-fill {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s;
}
.r-stat-val {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  text-align: right;
}

.result-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}
.result-actions .btn-main,
.result-actions .btn-ghost {
  margin-top: 16px;
}
.link {
  font-size: 14px;
}

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
  .parents {
    grid-template-columns: 1fr;
  }
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(88px, 1fr));
  }
  .r-head {
    flex-direction: column;
    text-align: center;
  }
}
</style>