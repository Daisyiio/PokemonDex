<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  listGeneticsSpecies,
  getGeneticsEggMoves,
  postGeneticsPlan,
  postGeneticsDirectParents,
  getMovesByGen,
  type MovesByGenResponse,
  type DirectParentsResponse,
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
import GenSelect from '../components/GenSelect.vue'
import { useScrollMemory } from '../composables/useScrollMemory'

useScrollMemory()

const loading = ref(true)
const error = ref('')
const species = ref<GeneticsBrief[]>([])
const search = ref('')
const targetId = ref('')
const eggMovesData = ref<GeneticsEggMovesResponse | null>(null)
const movesLoading = ref(false)
const selectedMoves = ref<string[]>([])
const includePrevGen = ref(false)
const generation = ref(6)
const plan = ref<GeneticsPlan | null>(null)
const computing = ref(false)
const simpleLoading = ref(false)
const directParents = ref<DirectParentsResponse | null>(null)
const viewMode = ref<'simple' | 'advanced'>('simple')

const showSugg = ref(false)

const genRuleOptions = [
  { value: 2, label: '第2世代（仅父方传递）' },
  { value: 3, label: '第3世代（仅父方传递）' },
  { value: 4, label: '第4世代（仅父方传递）' },
  { value: 5, label: '第5世代（仅父方传递）' },
  { value: 6, label: '第6世代（父母双方均可传递）' },
  { value: 7, label: '第7世代（父母双方均可传递）' },
  { value: 8, label: '第8世代（父母双方均可传递）' },
  { value: 9, label: '第9世代（父母双方均可传递）' },
]
const popupGenOptions = [2, 3, 4, 5, 6, 7, 8, 9].map((v) => ({
  value: v,
  label: `第${v}世代`,
}))

function onSearchInputGen() {
  showSugg.value = true
}
function onSearchFocusGen() {
  showSugg.value = true
}
function pickSearch(id: string) {
  search.value = ''
  showSugg.value = false
  pickTarget(id)
}
function onDocClickGen() {
  showSugg.value = false
}

const markerDesc: Record<string, string> = {
  '*': '需要连锁遗传，本世代存在会该招式宝可梦，但蛋组不兼容，必须搭桥中转，不需要旧世代卡带',
  '‡': '前代传入招式，本世代没有任何合法途径学会，亲代宝可梦必须从更早世代通过银行传送过来',
  '^': '需要从拥有该蛋招式的野生宝可梦遗传（朱紫太晶团战野生宝可梦携带蛋招式，G8以后才出现）',
}

const markerShort: Record<string, string> = {
  '*': '需要连锁',
  '‡': '前代传入',
  '^': '野生遗传',
}

function moveSource(move: string): string {
  const mk = eggMovesData.value?.eggMoves.find((m) => m.name === move)?.marker
  return (mk && markerShort[mk]) || '直接遗传'
}

function moveSourceClass(move: string): string {
  const mk = eggMovesData.value?.eggMoves.find((m) => m.name === move)?.marker
  if (mk === '‡') return 'src-prev'
  if (mk === '^') return 'src-wild'
  if (mk === '*') return 'src-chain'
  return 'src-ok'
}

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
  directParents.value = null
  error.value = ''
  movesLoading.value = true
  try {
    eggMovesData.value = await getGeneticsEggMoves(id, generation.value <= 8 ? generation.value : undefined)
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
  directParents.value = null
  error.value = ''
}

function toggleMove(name: string) {
  const i = selectedMoves.value.indexOf(name)
  if (i >= 0) selectedMoves.value.splice(i, 1)
  else if (selectedMoves.value.length < 4) selectedMoves.value.push(name)
}

async function compute() {
  if (!targetId.value) return
  if (viewMode.value === 'simple') {
    await fetchDirectParents()
  } else {
    await fetchPlan()
  }
}

async function fetchDirectParents() {
  if (!targetId.value) return
  simpleLoading.value = true
  error.value = ''
  directParents.value = null
  plan.value = null
  try {
    directParents.value = await postGeneticsDirectParents({
      targetId: targetId.value,
      moves: selectedMoves.value,
      generation: generation.value,
      includePrevGen: includePrevGen.value,
    })
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    simpleLoading.value = false
  }
}

async function fetchPlan() {
  if (!targetId.value) return
  computing.value = true
  error.value = ''
  plan.value = null
  directParents.value = null
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

function switchMode(mode: 'simple' | 'advanced') {
  viewMode.value = mode
  plan.value = null
  directParents.value = null
}

const computeHint = computed(() => {
  if (selectedMoves.value.length === 0) return '请先在上方选择期望的蛋招式（最多 4 个）'
  if (viewMode.value === 'simple') return includePrevGen.value
    ? '将推荐历代（含前代传送）可直接遗传以上蛋招式的亲代'
    : '将推荐本世代可直接遗传以上蛋招式的亲代'
  return '将规划完整遗传链，含连锁中转与跨世代传递'
})

watch(includePrevGen, () => {
  if (directParents.value) fetchDirectParents()
})

watch(generation, () => {
  if (targetId.value) {
    selectedMoves.value = []
    plan.value = null
    directParents.value = null
    movesLoading.value = true
    getGeneticsEggMoves(targetId.value, generation.value <= 8 ? generation.value : undefined)
      .then((data) => { eggMovesData.value = data })
      .catch((e) => { error.value = (e as Error).message })
      .finally(() => { movesLoading.value = false })
  }
})

const movePopup = ref<{ pokemonId: string; pokemonName: string; highlightMove: string | null; data: MovesByGenResponse | null; loading: boolean } | null>(null)
const popupTab = ref<'learnable' | 'machine' | 'egg' | 'tutor'>('learnable')
const popupGen = ref(6)
let popupTimer: number | undefined

async function loadPopupMoves(pokemonId: string, gen: number) {
  popupTab.value = 'learnable'
  movePopup.value = { pokemonId, pokemonName: movePopup.value?.pokemonName || '', highlightMove: movePopup.value?.highlightMove || null, data: null, loading: true }
  clearTimeout(popupTimer)
  try {
    const data = await getMovesByGen(pokemonId, gen)
    movePopup.value = { pokemonId, pokemonName: movePopup.value?.pokemonName || '', highlightMove: movePopup.value?.highlightMove || null, data, loading: false }
  } catch {
    movePopup.value = { pokemonId, pokemonName: movePopup.value?.pokemonName || '', highlightMove: movePopup.value?.highlightMove || null, data: null, loading: false }
  }
}

async function showMoveLearn(pokemonId: string, pokemonName: string, highlightMove?: string) {
  popupGen.value = generation.value
  movePopup.value = { pokemonId, pokemonName, highlightMove: highlightMove || null, data: null, loading: true }
  try {
    const data = await getMovesByGen(pokemonId, popupGen.value)
    movePopup.value = { pokemonId, pokemonName, highlightMove: highlightMove || null, data, loading: false }
  } catch {
    movePopup.value = { pokemonId, pokemonName, highlightMove: highlightMove || null, data: null, loading: false }
  }
}

function onPopupGenChange() {
  if (!movePopup.value) return
  const gen = popupGen.value
  clearTimeout(popupTimer)
  popupTimer = window.setTimeout(() => {
    const pid = movePopup.value?.pokemonId
    if (pid) loadPopupMoves(pid, gen)
  }, 250)
}

function closePopup() {
  clearTimeout(popupTimer)
  movePopup.value = null
  popupPos.value = { x: 0, y: 0 }
}

// 弹窗拖动
const popupPos = ref<{ x: number; y: number }>({ x: 0, y: 0 })
let dragging = false
let dragStartX = 0
let dragStartY = 0
let popupStartX = 0
let popupStartY = 0

function onPopupDragStart(e: MouseEvent) {
  dragging = true
  dragStartX = e.clientX
  dragStartY = e.clientY
  popupStartX = popupPos.value.x
  popupStartY = popupPos.value.y
  document.addEventListener('mousemove', onPopupDragMove)
  document.addEventListener('mouseup', onPopupDragEnd)
  document.body.style.userSelect = 'none'
}

function onPopupDragMove(e: MouseEvent) {
  if (!dragging) return
  popupPos.value = {
    x: popupStartX + (e.clientX - dragStartX),
    y: popupStartY + (e.clientY - dragStartY),
  }
}

function onPopupDragEnd() {
  dragging = false
  document.removeEventListener('mousemove', onPopupDragMove)
  document.removeEventListener('mouseup', onPopupDragEnd)
  document.body.style.userSelect = ''
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && movePopup.value) {
    closePopup()
  }
}

onMounted(async () => {
  document.addEventListener('click', onDocClickGen)
  document.addEventListener('keydown', onKeydown)
  try {
    species.value = await listGeneticsSpecies()
  } catch (e) {
    error.value = (e as Error).message
  } finally {
    loading.value = false
  }
})

onBeforeUnmount(() => {
  clearTimeout(popupTimer)
  document.removeEventListener('click', onDocClickGen)
  document.removeEventListener('keydown', onKeydown)
  document.removeEventListener('mousemove', onPopupDragMove)
  document.removeEventListener('mouseup', onPopupDragEnd)
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
      <div class="search-box" @click.stop>
        <input
          v-model="search"
          type="text"
          placeholder="搜索目标宝可梦（名称 / 编号）"
          @input="onSearchInputGen"
          @focus="onSearchFocusGen"
        />
        <button v-if="targetId" class="btn-back" @click="clearTarget">换一个</button>
        <div v-if="showSugg && filteredSpecies.length" class="sugg">
          <button
            v-for="s in filteredSpecies.slice(0, 8)"
            :key="s.id"
            class="sugg-item"
            @click="pickSearch(s.id)"
          >
            <SafeImage v-if="s.image" :src="imageUrl('official', s.image)" :alt="s.nameZh" class="sugg-img" />
            <span class="sugg-info">
              <span class="sugg-name">{{ s.nameZh }}</span>
              <span class="sugg-id">#{{ s.id }}</span>
            </span>
          </button>
        </div>
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
            <span class="move-name">
              {{ m.name }}
              <span v-if="m.marker" class="move-marker" :class="`mk-${m.marker}`" :title="markerDesc[m.marker]">{{ m.marker }}</span>
            </span>
            <span class="chip" :style="{ color: typeColor(m.type), borderColor: typeColor(m.type) + '55' }">{{ m.type }}</span>
            <span class="chip" :style="{ color: categoryColor(m.category) }">{{ m.category }}</span>
          </label>
        </div>
        <div class="marker-legend">
          <span v-for="(desc, sym) in markerDesc" :key="sym" class="marker-item">
            <span class="move-marker" :class="`mk-${sym}`">{{ sym }}</span>
            <span class="marker-text">{{ desc }}</span>
          </span>
        </div>

        <!-- 设置与计算 -->
        <div class="compute-area">
          <div class="compute-options">
            <div class="gen-select">
              <span class="gen-label">世代规则</span>
              <GenSelect v-model="generation" :options="genRuleOptions" />
            </div>

            <div class="mode-toggle">
              <button class="mode-btn" :class="{ active: viewMode === 'simple' }" @click="switchMode('simple')">推荐亲代</button>
              <button class="mode-btn" :class="{ active: viewMode === 'advanced' }" @click="switchMode('advanced')">完整遗传链</button>
            </div>
          </div>

          <div v-if="viewMode === 'simple'" class="prev-gen-toggle">
            <span class="prev-gen-label">查找范围</span>
            <button class="pg-btn" :class="{ active: !includePrevGen }" @click="includePrevGen = false">本世代可学</button>
            <button class="pg-btn" :class="{ active: includePrevGen }" @click="includePrevGen = true">历代均可学（含传送）</button>
          </div>

          <button class="btn-main" :disabled="selectedMoves.length === 0 || computing || simpleLoading" @click="compute">
            <svg v-if="!(computing || simpleLoading)" class="btn-main-icon" viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="10" cy="10" r="3" />
              <path d="M5 12.5 1.5 12a1 1 0 0 1-.9-1.4L3 5.6A1 1 0 0 1 4 5h3.2A1 1 0 0 1 8.1 6l1.1 2.6M15 12.5 18.5 12a1 1 0 0 0 .9-1.4L17 5.6A1 1 0 0 0 16 5h-3.2a1 1 0 0 0-.9.6" />
              <path d="M8 8h4M7 17h6M9 12a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h0a1 1 0 0 1-1-1v-4z" />
            </svg>
            <span class="btn-main-loader" v-if="computing || simpleLoading" />
            {{ (computing || simpleLoading) ? '计算中…' : '开始计算' }}
          </button>
          <div class="compute-hint" :class="{ warn: selectedMoves.length === 0 }">
            <span class="compute-hint-dot" />
            {{ computeHint }}
          </div>
        </div>
      </div>
    </div>

    <!-- 结果区：简易模式 -->
    <div v-if="directParents" class="results">
      <div v-if="directParents.note" class="special-note">{{ directParents.note }}</div>

      <div class="dp-head">
        <span class="dp-title">推荐直接亲代</span>
        <span class="dp-summary">
          共 {{ directParents.summary.total }} 个候选
          <span v-if="directParents.summary.fullCover" class="dp-full">· {{ directParents.summary.fullCover }} 个可全覆盖</span>
        </span>
      </div>

      <div v-if="directParents.parents.length === 0" class="empty">
        没有找到可直接遗传的亲代。请尝试切换世代或使用高级模式查看连锁遗传。
      </div>

      <div v-else class="dp-table-wrap">
        <table class="dp-table">
          <thead>
            <tr>
              <th>亲本</th>
              <th>蛋组</th>
              <th>可遗传招式</th>
              <th>获取方式</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in directParents.parents" :key="p.id" :class="{ 'dp-full-row': p.allMovesCovered }">
              <td class="dp-td-name">
                <router-link :to="`/pokemon/${p.id}`" class="dp-link">
                  <SafeImage v-if="p.image" :src="imageUrl('official', p.image)" :alt="p.nameZh" class="dp-thumb" />
                  <span>
                    <span class="dp-name">{{ p.nameZh }}</span>
                    <span class="dp-id">#{{ p.id }}</span>
                  </span>
                </router-link>
              </td>
              <td class="dp-td-eg">
                <span v-for="eg in p.eggGroups" :key="eg" class="dp-eg-tag">{{ eg }}</span>
              </td>
              <td class="dp-td-moves">
                <span v-for="m in p.sharedMoves" :key="m" class="dp-move-tag" :class="{ covered: p.allMovesCovered }">{{ m }}</span>
              </td>
              <td class="dp-td-learn">
                <div v-for="li in p.learnInfos" :key="li.move" class="dp-learn-item">
                  <span class="dp-learn-move">{{ li.move }}</span>
                  <span class="dp-learn-method" :class="{ tm: li.isTM }">{{ li.note }}</span>
                  <span v-if="li.fromPrevGen" class="dp-prevgen-tag">前代</span>
                </div>
              </td>
              <td class="dp-td-note">
                <div class="dp-src-list">
                  <span
                    v-for="m in p.sharedMoves"
                    :key="m"
                    class="dp-src-tag"
                    :class="moveSourceClass(m)"
                    :title="markerDesc[eggMovesData?.eggMoves.find(x => x.name === m)?.marker ?? '']"
                  >{{ moveSource(m) }}</span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <!-- 结果区 -->
    <div v-if="plan" class="results">
      <div v-if="plan.specialNote" class="special-note">{{ plan.specialNote }}</div>

      <!-- 统一方案（多招式时主输出） -->
      <div v-if="plan.unifiedPlan" class="unified-plan">
        <div v-if="plan.unifiedPlan.type === 'gen5-limit' || plan.unifiedPlan.type === 'mirror-herb'" class="gen5-note">
          {{ plan.unifiedPlan.note }}
        </div>
        <template v-else>
          <div class="up-head">
            <span class="up-badge">{{ plan.unifiedPlan.type === 'mixed' ? '混合遗传' : '顺序叠加' }}</span>
            <span class="up-title">{{ plan.unifiedPlan.totalSteps }} 步 · {{ plan.unifiedPlan.knownMoves?.length || 0 }} 个招式</span>
          </div>

          <!-- 视觉遗传链 -->
          <div class="visual-chain">
            <div v-for="(step, si) in plan.unifiedPlan.steps" :key="si" class="vc-step" :class="step.phase">
              <div class="vc-step-hd">
                <span class="vc-step-num">STEP {{ si + 1 }}</span>
                <span class="vc-step-label" v-if="step.phase === 'chain-prep'">连锁准备</span>
              </div>
              <div class="vc-flow">
                <div class="vc-mons">
                  <div class="vc-mon" @click.stop="showMoveLearn(step.father.id, step.father.nameZh, step.move)" style="cursor:pointer">
                    <SafeImage :src="imageUrl('official', step.father.image)" :alt="step.father.nameZh" class="vc-sprite" />
                    <span class="vc-mon-name">{{ step.father.nameZh }}</span>
                    <span class="vc-gender m">♂</span>
                    <span v-if="step.move" class="vc-mon-move" @click.stop="showMoveLearn(step.father.id, step.father.nameZh, step.move)">
                      {{ step.move }}<span v-if="step.learnLevel && step.learnLevel !== '?' && step.learnLevel !== 'TM'" class="vc-lv-tag">Lv.{{ step.learnLevel }}</span>
                      <span v-if="step.learnLevel === 'TM'" class="vc-lv-tag tm">TM</span>
                      <span v-if="!step.learnLevel || step.learnLevel === '?'" class="vc-lv-tag unknown">查看</span>
                    </span>
                  </div>
                  <div v-for="c in step.candidates" :key="c.id" class="vc-mon" @click.stop="showMoveLearn(c.id, c.nameZh, step.move)" style="cursor:pointer">
                    <SafeImage :src="imageUrl('official', c.image)" :alt="c.nameZh" class="vc-sprite" />
                    <span class="vc-mon-name">{{ c.nameZh }}</span>
                    <span class="vc-gender m">♂</span>
                    <span v-if="step.move" class="vc-mon-move" @click.stop="showMoveLearn(c.id, c.nameZh, step.move)">
                      {{ step.move }}<span v-if="c.learnLevel && c.learnLevel !== '?' && c.learnLevel !== 'TM'" class="vc-lv-tag">Lv.{{ c.learnLevel }}</span>
                      <span v-if="c.learnLevel === 'TM'" class="vc-lv-tag tm">TM</span>
                      <span v-if="!c.learnLevel || c.learnLevel === '?'" class="vc-lv-tag unknown">查看</span>
                    </span>
                  </div>
                </div>
                <span class="vc-x">×</span>
                <div class="vc-mon" @click.stop="showMoveLearn(step.mother.id, step.mother.nameZh)" style="cursor:pointer">
                  <SafeImage :src="imageUrl('official', step.mother.image)" :alt="step.mother.nameZh" class="vc-sprite" />
                  <span class="vc-mon-name">{{ step.mother.nameZh }}</span>
                  <span class="vc-gender" :class="step.mother.genderRatio.female > 0 ? 'f' : 'n'">{{ step.mother.genderRatio.female > 0 ? '♀' : '⚲' }}</span>
                  <div v-if="step.previousMoves?.length" class="vc-prev-moves">
                    <span v-for="pm in step.previousMoves" :key="pm" class="vc-prev-tag">{{ pm }}</span>
                  </div>
                </div>
                <span class="vc-arrow">→</span>
                <div class="vc-mon vc-result" @click.stop="showMoveLearn(plan.target.id, plan.target.nameZh)" style="cursor:pointer">
                  <SafeImage :src="imageUrl('official', plan.target.image)" :alt="plan.target.nameZh" class="vc-sprite" />
                  <span class="vc-mon-name">{{ plan.target.nameZh }}</span>
                  <div class="vc-result-moves">
                    <span v-for="pm in step.previousMoves" :key="pm" class="vc-mon-move vc-prev">{{ pm }}</span>
                    <span v-if="step.move" class="vc-mon-move vc-new">{{ step.move }}</span>
                  </div>
                </div>
              </div>
              <div class="vc-flow-down" v-if="si < plan.unifiedPlan.steps.length - 1">↓</div>
            </div>
          </div>

          <div v-if="plan.unifiedPlan.impossibleMoves && plan.unifiedPlan.impossibleMoves.length > 0" class="up-impossible">
            <div v-for="im in plan.unifiedPlan.impossibleMoves" :key="im.move" class="up-impossible-item">
              <span class="rc-badge no">不可遗传</span> {{ im.move }}：{{ im.reason }}
            </div>
          </div>
        </template>
      </div>

      <!-- 一站式方案（无统一方案时显示） -->
      <div v-else-if="plan.combinedDirect && !plan.specialNote && selectedMoves.length > 1" class="result-card combined">
        <div class="combined-hd">
          <span class="rc-badge ok">一站式</span>
          <span class="rc-title">一个父方即可遗传全部招式</span>
        </div>
        <div class="visual-chain">
          <div class="vc-step">
            <div class="vc-flow">
              <div class="vc-mon" @click.stop="showMoveLearn(plan.target.id, plan.target.nameZh)" style="cursor:pointer">
                <SafeImage :src="imageUrl('official', plan.target.image)" :alt="plan.target.nameZh" class="vc-sprite" />
                <span class="vc-mon-name">{{ plan.target.nameZh }}</span>
                <span class="vc-gender f">♀</span>
              </div>
              <span class="vc-x">×</span>
              <div class="vc-mon" @click.stop="showMoveLearn(plan.combinedDirect.father.id, plan.combinedDirect.father.nameZh)" style="cursor:pointer">
                <SafeImage :src="imageUrl('official', plan.combinedDirect.father.image)" :alt="plan.combinedDirect.father.nameZh" class="vc-sprite" />
                <span class="vc-mon-name">{{ plan.combinedDirect.father.nameZh }}</span>
                <span class="vc-gender m">♂</span>
              </div>
              <span class="vc-arrow">→</span>
              <div class="vc-mon vc-result" @click.stop="showMoveLearn(plan.target.id, plan.target.nameZh)" style="cursor:pointer">
                <SafeImage :src="imageUrl('official', plan.target.image)" :alt="plan.target.nameZh" class="vc-sprite" />
                <span class="vc-mon-name">{{ plan.target.nameZh }}</span>
                <span v-for="li in plan.combinedDirect.learnInfo" :key="li.move" class="vc-move-tag">{{ li.move }}</span>
              </div>
            </div>
            <div class="vc-meta">
              <span class="vc-eg">{{ plan.combinedDirect.sharedEggGroup }}</span>
            </div>
          </div>
        </div>
        <div class="combined-body">
          <div class="combined-pair">
            <div class="combined-mon">
              <span class="up-role">母</span>
              <router-link :to="`/pokemon/${plan.target.id}`" class="up-name">{{ plan.target.nameZh }}</router-link>
              <span class="up-gender f">♀</span>
            </div>
            <span class="up-cross">×</span>
            <div class="combined-mon">
              <span class="up-role">父</span>
              <router-link :to="`/pokemon/${plan.combinedDirect.father.id}`" class="up-name">{{ plan.combinedDirect.father.nameZh }}</router-link>
              <span class="up-gender m">♂</span>
            </div>
          </div>
          <div class="combined-eg">蛋组：{{ plan.combinedDirect.sharedEggGroup }}</div>
          <div v-if="plan.combinedDirect.learnInfo" class="combined-moves">
            <span v-for="li in plan.combinedDirect.learnInfo" :key="li.move" class="learn-tag">
              {{ li.move }}：
              <span class="learn-lv">{{ !li.level || li.level === '?' ? '习得等级未知' : li.level === '—' ? '初始' : 'Lv.' + li.level }}</span>
            </span>
          </div>
          <div class="combined-note">父方习得后放入饲育屋，子代{{ plan.target.nameZh }}自带全部蛋招式</div>
          <div v-if="plan.combinedDirect.candidates.length > 1" class="combined-cands">
            其他父本候选：
            <span v-for="c in plan.combinedDirect.candidates.slice(1)" :key="c.id" class="cand-tag">
              <router-link :to="`/pokemon/${c.id}`" class="rc-link">{{ c.nameZh }}</router-link>
            </span>
          </div>
        </div>
      </div>

      <!-- 单招式结果 -->
      <template v-if="!plan.unifiedPlan && selectedMoves.length <= 1">
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
                  {{ sol.type === 'direct' ? '直接孵蛋（一步完成）' : `连锁遗传（${sol.stepCount}步）` }}
                </span>
              </div>
              <div class="visual-chain sm">
                <div v-for="(step, ti) in sol.steps" :key="ti" class="vc-step">
                  <div class="vc-flow">
                    <div class="vc-mon" @click.stop="showMoveLearn(step.father.id, step.father.nameZh, mr.move)" style="cursor:pointer">
                      <SafeImage :src="imageUrl('official', step.father.image)" :alt="step.father.nameZh" class="vc-sprite" />
                      <span class="vc-mon-name">{{ step.father.nameZh }}</span>
                      <span class="vc-gender m">♂</span>
                    </div>
                    <span class="vc-x">×</span>
                    <div class="vc-mon" @click.stop="showMoveLearn(step.mother.id, step.mother.nameZh)" style="cursor:pointer">
                      <SafeImage :src="imageUrl('official', step.mother.image)" :alt="step.mother.nameZh" class="vc-sprite" />
                      <span class="vc-mon-name">{{ step.mother.nameZh }}</span>
                      <span class="vc-gender" :class="step.mother.genderRatio.female > 0 ? 'f' : 'n'">{{ step.mother.genderRatio.female > 0 ? '♀' : '⚲' }}</span>
                    </div>
                    <span class="vc-arrow">→</span>
                    <div class="vc-mon vc-result" @click.stop="showMoveLearn(plan.target.id, plan.target.nameZh, mr.move)" style="cursor:pointer">
                      <SafeImage :src="imageUrl('official', plan.target.image)" :alt="plan.target.nameZh" class="vc-sprite" />
                      <span class="vc-mon-name">{{ plan.target.nameZh }}</span>
                      <span class="vc-move-tag">{{ mr.move }}</span>
                    </div>
                  </div>
                  <div v-if="ti < sol.steps.length - 1" class="vc-flow-down">↓</div>
                </div>
              </div>
              <div v-for="(step, ti) in sol.steps" :key="'t'+ti" class="step">
                <div class="step-pair">
                  <div class="step-mon">
                    <span class="up-role">父</span>
                    <router-link :to="`/pokemon/${step.father.id}`" class="up-name">{{ step.father.nameZh }}</router-link>
                    <span class="up-gender m">♂</span>
                  </div>
                  <span class="up-cross">×</span>
                  <div class="step-mon">
                    <span class="up-role">母</span>
                    <router-link :to="`/pokemon/${step.mother.id}`" class="up-name">{{ step.mother.nameZh }}</router-link>
                    <span class="up-gender" :class="step.mother.genderRatio.female > 0 ? 'f' : 'n'">{{ step.mother.genderRatio.female > 0 ? '♀' : '⚲' }}</span>
                  </div>
                  <span class="up-arrow">→</span>
                  <div class="step-result">
                    <span class="up-role">子</span>
                    <span class="up-name">{{ mr.move }}</span>
                  </div>
                </div>
                <div class="step-meta">
                  <span>蛋组：{{ step.sharedEggGroup }}</span>
                  <span>{{ step.note }}</span>
                </div>
              </div>
              <div v-if="sol.type === 'direct' && sol.candidates && sol.candidates.length > 1" class="sol-cands">
                其他父本：
                <span v-for="c in sol.candidates.slice(1)" :key="c.id" class="cand-tag">
                  <router-link :to="`/pokemon/${c.id}`" class="rc-link">{{ c.nameZh }}</router-link>
                  <span class="cand-lv">{{ !c.learnLevel || c.learnLevel === '?' ? '习得等级未知' : c.learnLevel === '—' ? '初始' : 'Lv.' + c.learnLevel }}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>

    <!-- 招式学习途径弹窗 -->
    <Teleport to="body">
      <div v-if="movePopup" class="popup-overlay" @click.self="closePopup">
        <div class="popup" :style="{ left: `${popupPos.x}px`, top: `${popupPos.y}px` }">
          <div class="popup-hd" @mousedown="onPopupDragStart">
            <span class="popup-title">
              {{ movePopup.pokemonName }} · 可学招式
              <span v-if="movePopup.highlightMove" class="popup-hl">{{ movePopup.highlightMove }}</span>
            </span>
            <div class="popup-hd-right" @mousedown.stop>
              <GenSelect v-model="popupGen" :options="popupGenOptions" compact @update:model-value="onPopupGenChange" />
              <button class="popup-close" @click="closePopup">✕</button>
            </div>
          </div>

          <div v-if="movePopup.loading" class="popup-loading">加载中…</div>
          <div v-else-if="!movePopup.data" class="popup-empty">暂无数据</div>
          <div v-else class="popup-content">
            <div class="popup-tabs">
              <button
                class="popup-tab"
                :class="{ on: popupTab === 'learnable' }"
                @click="popupTab = 'learnable'"
              >
                升级学习 <span class="tab-count">{{ movePopup.data.learnable.length }}</span>
              </button>
              <button
                class="popup-tab"
                :class="{ on: popupTab === 'machine' }"
                @click="popupTab = 'machine'"
              >
                招式学习器 <span class="tab-count">{{ movePopup.data.machine.length }}</span>
              </button>
              <button
                class="popup-tab"
                :class="{ on: popupTab === 'egg' }"
                @click="popupTab = 'egg'"
              >
                蛋招式 <span class="tab-count">{{ movePopup.data.egg.length }}</span>
              </button>
              <button
                class="popup-tab"
                :class="{ on: popupTab === 'tutor' }"
                @click="popupTab = 'tutor'"
              >
                教授招式 <span class="tab-count">{{ movePopup.data.tutor.length }}</span>
              </button>
            </div>

            <div class="popup-body">
              <template v-if="popupTab === 'learnable'">
                <div v-for="m in movePopup.data.learnable" :key="m.name" class="popup-row" :class="{ highlight: m.name === movePopup.highlightMove }">
                  <span class="popup-badge level">Lv.{{ m.level }}</span>
                  <span class="popup-move-name">{{ m.name }}</span>
                  <span class="popup-move-type">{{ m.type }}</span>
                  <span v-if="m.name === movePopup.highlightMove" class="popup-current">当前遗传</span>
                </div>
                <div v-if="!movePopup.data.learnable.length" class="popup-none">该世代没有升级学习招式</div>
              </template>
              <template v-else-if="popupTab === 'machine'">
                <div v-for="m in movePopup.data.machine" :key="m.name" class="popup-row" :class="{ highlight: m.name === movePopup.highlightMove }">
                  <span class="popup-badge tm">{{ m.tm }}</span>
                  <span class="popup-move-name">{{ m.name }}</span>
                  <span class="popup-move-type">{{ m.type }}</span>
                  <span v-if="m.name === movePopup.highlightMove" class="popup-current">当前遗传</span>
                </div>
                <div v-if="!movePopup.data.machine.length" class="popup-none">该世代没有招式学习器招式</div>
              </template>
              <template v-else-if="popupTab === 'egg'">
                <div v-for="m in movePopup.data.egg" :key="m.name" class="popup-row" :class="{ highlight: m.name === movePopup.highlightMove }">
                  <span class="popup-badge egg">蛋</span>
                  <span class="popup-move-name">{{ m.name }}</span>
                  <span class="popup-move-type">{{ m.type }}</span>
                  <span v-if="m.name === movePopup.highlightMove" class="popup-current">当前遗传</span>
                </div>
                <div v-if="!movePopup.data.egg.length" class="popup-none">该世代没有蛋招式</div>
              </template>
              <template v-else>
                <div v-for="m in movePopup.data.tutor" :key="m.name" class="popup-row" :class="{ highlight: m.name === movePopup.highlightMove }">
                  <span class="popup-badge tutor">教授</span>
                  <span class="popup-move-name">{{ m.name }}</span>
                  <span class="popup-move-type">{{ m.type }}</span>
                  <span v-if="m.name === movePopup.highlightMove" class="popup-current">当前遗传</span>
                </div>
                <div v-if="!movePopup.data.tutor.length" class="popup-none">该世代没有教授招式</div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
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
  position: relative;
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
.search-box input:focus {
  border-color: var(--text-faint);
  outline: 3px solid var(--accent-soft);
  outline-offset: 0;
}
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
.btn-back:hover { border-color: var(--border); color: var(--text); background: var(--hover-bg); }
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
  border-color: var(--border);
  box-shadow: var(--shadow-hover);
}
.card-img {
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
}
.card-img img {
  max-width: 60px;
  max-height: 60px;
}
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
.move-name { font-weight: 600; display: inline-flex; align-items: center; gap: 4px; }
.move-marker {
  font-size: 11px;
  font-weight: 700;
  padding: 0 6px;
  border-radius: 4px;
  line-height: 1.5;
}
.mk-\* { color: #d97706; background: color-mix(in srgb, #d97706 16%, var(--surface)); }
.mk-\‡ { color: #7c3aed; background: color-mix(in srgb, #7c3aed 16%, var(--surface)); }
.mk-\^ { color: #0e7490; background: color-mix(in srgb, #0e7490 16%, var(--surface)); }
.marker-legend {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 10px;
  padding: 8px 10px;
  border: 1px solid var(--border-faint);
  border-radius: 8px;
  background: var(--surface-2);
  font-size: 11px;
  color: var(--text-3);
}
.marker-item { display: flex; align-items: flex-start; gap: 6px; }
.marker-text { line-height: 1.5; flex: 1; }
.chip { font-size: 10px; border: 1px solid transparent; border-radius: 999px; padding: 1px 7px; }
.gen-select {
  display: flex;
  align-items: center;
  gap: 10px;
}
.gen-label { font-size: 13px; font-weight: 700; color: var(--text-2); white-space: nowrap; }
.gen-dropdown {
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text);
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s, background 0.15s, color 0.15s;
  cursor: pointer;
}
.gen-dropdown:hover { border-color: var(--border); background: var(--hover-bg); }
.btn-main {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 28px;
  border-radius: 12px;
  border: none;
  background: var(--accent);
  color: var(--on-accent);
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.3px;
  cursor: pointer;
  box-shadow: 0 2px 10px var(--accent-strong), inset 0 1px 0 rgba(255, 255, 255, 0.22);
  transition: transform 0.15s, box-shadow 0.15s, filter 0.15s;
}
.btn-main:hover:not(:disabled) {
  transform: translateY(-2px);
  filter: brightness(1.06);
  box-shadow: 0 4px 18px var(--accent-strong), inset 0 1px 0 rgba(255, 255, 255, 0.22);
}
.btn-main:active:not(:disabled) {
  transform: translateY(0) scale(0.98);
  filter: brightness(0.96);
}
.btn-main:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  box-shadow: none;
}
.btn-main:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-soft), 0 4px 18px var(--accent-strong);
}
.btn-main-icon { flex-shrink: 0; }
.btn-main-loader {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: var(--on-accent);
  border-radius: 50%;
  animation: btn-spin 0.7s linear infinite;
}
@keyframes btn-spin { to { transform: rotate(360deg); } }

.compute-area {
  margin-top: 16px;
  border-top: 1px dashed var(--border-soft);
  padding-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.compute-area .btn-main { width: 100%; }
.compute-options {
  display: flex;
  flex-wrap: nowrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.compute-options .gen-select {
  flex: 1;
  min-width: 0;
}
.compute-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-3);
}
.compute-hint.warn { color: var(--accent); }
.compute-hint-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--accent);
}
.compute-hint.warn .compute-hint-dot {
  animation: hint-pulse 1.3s ease-in-out infinite;
}
@keyframes hint-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
}

.mode-toggle {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  flex-shrink: 0;
}
.mode-btn {
  flex: 1 0 auto;
  padding: 8px 16px;
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border-radius: 8px;
  white-space: nowrap;
  transition: background 0.2s, color 0.2s, box-shadow 0.2s;
}
.mode-btn:not(.active):hover {
  color: var(--text);
  background: var(--hover-bg);
}
.mode-btn.active {
  background: var(--surface);
  color: var(--accent);
  box-shadow: 0 1px 4px var(--shadow), inset 0 0 0 1px var(--border-soft);
}
.mode-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--accent-soft);
}

.prev-gen-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
}
.prev-gen-label {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
  letter-spacing: 0.5px;
  white-space: nowrap;
}
.pg-btn {
  padding: 5px 12px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  border-radius: 999px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
  transition: background 0.15s, color 0.15s;
}
.pg-btn:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.pg-btn.active {
  background: var(--accent-soft);
  color: var(--accent);
  font-weight: 600;
}

.sugg {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 100%;
  max-width: 400px;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  box-shadow: var(--shadow-hover);
  max-height: 340px;
  overflow-y: auto;
  z-index: 30;
  padding: 4px;
}
.sugg-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}
.sugg-item:hover { background: var(--hover-bg); }
.sugg-img {
  width: 32px;
  height: 32px;
  object-fit: contain;
}
.sugg-info { display: flex; flex-direction: column; }
.sugg-name { font-size: 13px; font-weight: 600; color: var(--text); }
.sugg-id { font-size: 11px; color: var(--text-3); }

.dp-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
}
.dp-title { font-size: 16px; font-weight: 700; color: var(--text); }
.dp-summary { font-size: 13px; color: var(--text-3); }
.dp-full { color: var(--ok); font-weight: 600; }
.dp-table-wrap {
  overflow-x: auto;
  border: 1px solid var(--border-faint);
  border-radius: 12px;
  background: var(--surface);
}
.dp-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.dp-table th {
  text-align: left;
  padding: 10px 14px;
  font-weight: 600;
  color: var(--text-3);
  background: var(--surface-2);
  border-bottom: 1px solid var(--border-faint);
  white-space: nowrap;
}
.dp-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--border-faint);
  vertical-align: middle;
}
.dp-table tr:last-child td { border-bottom: none; }
.dp-full-row { background: var(--ok-soft); }
.dp-link {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: inherit;
}
.dp-link:hover .dp-name { color: var(--accent); }
.dp-thumb {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--surface-2);
  object-fit: contain;
  image-rendering: auto;
}
.dp-link {
  display: flex;
  align-items: center;
  gap: 8px;
  text-decoration: none;
  color: inherit;
  transition: opacity 0.15s;
}
.dp-link:hover {
  opacity: 0.8;
}
.dp-name { font-weight: 600; color: var(--text); transition: color 0.15s; }
.dp-id { color: var(--text-faint); font-size: 11px; margin-left: 4px; }
.dp-eg-tag {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--surface-3);
  color: var(--text-2);
  margin: 1px 3px;
}
.dp-move-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  background: var(--accent-soft);
  color: var(--accent);
  margin: 1px 3px;
}
.dp-move-tag.covered {
  background: var(--ok-soft);
  color: var(--ok);
}
.dp-learn-item {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 2px 0;
}
.dp-learn-move { font-size: 11px; color: var(--text-2); }
.dp-learn-method {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: var(--surface-3);
  color: var(--text-3);
}
.dp-learn-method.tm {
  background: var(--z-move-soft);
  color: var(--z-move);
}
.dp-prevgen-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  background: color-mix(in srgb, #7c3aed 14%, var(--surface));
  color: #7c3aed;
  white-space: nowrap;
}
.dp-badge-partial {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  white-space: nowrap;
}
.dp-src-list { display: flex; flex-wrap: wrap; gap: 4px; }
.dp-src-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  white-space: nowrap;
  cursor: help;
}
.dp-src-tag.src-ok { background: var(--ok-soft); color: var(--ok); }
.dp-src-tag.src-chain { background: color-mix(in srgb, #d97706 16%, var(--surface)); color: #d97706; }
.dp-src-tag.src-prev { background: color-mix(in srgb, #7c3aed 16%, var(--surface)); color: #7c3aed; }
.dp-src-tag.src-wild { background: color-mix(in srgb, #0e7490 16%, var(--surface)); color: #0e7490; }
.dp-td-note { min-width: 120px; }
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

.unified-plan {
  background: var(--surface);
  border: 1px solid var(--accent);
  border-radius: 14px;
  padding: 16px;
  margin-bottom: 12px;
}
.up-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
}
.up-badge {
  font-size: 12px;
  font-weight: 800;
  padding: 3px 12px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
}
.up-title { font-size: 14px; font-weight: 700; color: var(--text); }
.up-chain { display: flex; flex-direction: column; gap: 0; }
.up-link { position: relative; }
.up-step {
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 10px;
  padding: 12px;
}
.up-step.chain-prep { opacity: 0.7; }
.up-step-hd {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.up-step-num {
  font-size: 11px;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: 0.5px;
}
.up-link.chain-prep .up-step-num { color: var(--text-3); }
.up-move-tag {
  font-size: 11px;
  font-weight: 700;
  background: var(--accent-soft);
  color: var(--accent);
  padding: 2px 10px;
  border-radius: 999px;
}
.up-pair {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.up-mon, .up-result {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 8px;
  padding: 6px 10px;
}
.up-result { background: var(--accent-soft); border-color: var(--accent); }
.up-role {
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
  background: var(--surface-2);
  border-radius: 4px;
  padding: 1px 5px;
}
.up-name {
  font-size: 14px;
  font-weight: 700;
  color: var(--text);
  text-decoration: none;
}
.up-name:hover { color: var(--accent); }
.up-gender { font-size: 14px; font-weight: 700; }
.up-gender.m { color: #60a5fa; }
.up-gender.f { color: #f472b6; }
.up-gender.n { color: var(--text-3); }
.up-cross { color: var(--text-faint); font-weight: 700; font-size: 15px; }
.up-arrow { color: var(--accent); font-weight: 700; font-size: 16px; }
.up-flow-arrow {
  text-align: center;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-3);
  padding: 6px 0;
}
.up-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--text-3);
}
.up-eg {
  font-weight: 600;
  color: var(--text-2);
}
.up-note { line-height: 1.5; }

/* 视觉遗传链 */
.visual-chain {
  margin-bottom: 16px;
}
.visual-chain.sm .vc-sprite { width: 36px; height: 36px; }
.visual-chain.sm .vc-mon-name { font-size: 12px; }
.visual-chain.sm .vc-move-tag { font-size: 10px; }
.vc-step {
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 0;
}
.vc-step.chain-prep { opacity: 0.7; }
.vc-step-hd {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}
.vc-step-num {
  font-size: 10px;
  font-weight: 800;
  color: var(--accent);
  letter-spacing: 0.5px;
}
.vc-step-label {
  font-size: 10px;
  color: var(--text-3);
  background: var(--surface);
  padding: 1px 6px;
  border-radius: 4px;
}
.vc-flow {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  flex-wrap: wrap;
}
.vc-mons {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.vc-mon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 14px;
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 10px;
  position: relative;
  cursor: pointer;
  transition: background 0.15s;
}
.vc-mon:hover {
  background: var(--hover-bg);
}
.vc-result {
  background: var(--accent-soft);
  border-color: var(--accent);
}
.vc-sprite {
  width: 48px;
  height: 48px;
  object-fit: contain;
}
.vc-mon-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
  text-align: center;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.vc-gender { font-size: 13px; font-weight: 700; }
.vc-gender.m { color: #60a5fa; }
.vc-gender.f { color: #f472b6; }
.vc-gender.n { color: var(--text-3); }
.vc-mon-move {
  font-size: 11px;
  font-weight: 700;
  color: #fff;
  background: var(--accent);
  padding: 2px 10px;
  border-radius: 999px;
  margin-top: 2px;
  white-space: nowrap;
}
.vc-result .vc-mon-move {
  background: #fff;
  color: var(--accent);
  border: 1px solid var(--accent);
}
.vc-result-moves {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: center;
  margin-top: 2px;
}
.vc-result-moves .vc-mon-move.vc-prev {
  background: var(--surface-2);
  color: var(--text-3);
  border-color: var(--border-faint);
  font-weight: 600;
}
.vc-result-moves .vc-mon-move.vc-new {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.vc-prev-moves {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  justify-content: center;
  margin-top: 2px;
}
.vc-prev-tag {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-3);
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 4px;
  padding: 1px 6px;
}
.vc-x {
  font-size: 20px;
  font-weight: 700;
  color: var(--text-faint);
}
.vc-arrow {
  font-size: 22px;
  font-weight: 700;
  color: var(--accent);
}
.vc-flow-down {
  text-align: center;
  font-size: 18px;
  font-weight: 700;
  color: var(--accent);
  padding: 6px 0;
  line-height: 1;
}

.up-impossible {
  margin-top: 10px;
  padding: 10px;
  border-radius: 8px;
  background: var(--danger-soft);
}
.up-impossible-item { font-size: 13px; color: var(--danger); margin-bottom: 4px; }

/* 一站式方案 */
.combined-badge { font-size: 11px; font-weight: 700; padding: 2px 10px; border-radius: 999px; background: var(--ok-soft); color: var(--ok); }
.combined-hd {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
.combined-body { font-size: 14px; color: var(--text-2); }
.combined-pair {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}
.combined-mon {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 8px;
  padding: 6px 10px;
}
.combined-eg { font-size: 12px; color: var(--text-3); margin-bottom: 8px; }
.combined-moves { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.combined-note { font-size: 12px; color: var(--text-3); line-height: 1.5; }
.combined-cands { font-size: 12px; color: var(--text-3); margin-top: 6px; display: flex; flex-wrap: wrap; gap: 6px; }

/* 单招式 */
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
  padding: 10px;
  margin-bottom: 6px;
  background: var(--surface);
  border: 1px solid var(--border-faint);
  border-radius: 8px;
}
.step-pair {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  margin-bottom: 6px;
}
.step-mon, .step-result {
  display: flex;
  align-items: center;
  gap: 4px;
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 6px;
  padding: 4px 8px;
}
.step-meta {
  font-size: 12px;
  color: var(--text-3);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  line-height: 1.5;
}
.sol-cands { font-size: 12px; color: var(--text-3); margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; }
.cand-tag { display: inline-flex; align-items: center; gap: 4px; }
.cand-lv { font-size: 10px; color: var(--accent); background: var(--accent-soft); border-radius: 999px; padding: 1px 6px; }
.learn-tag { font-size: 11px; color: var(--ok); background: var(--ok-soft); border-radius: 999px; padding: 2px 8px; display: inline-flex; align-items: center; gap: 4px; }
.learn-lv { font-size: 10px; opacity: 0.8; }
.rc-link { color: var(--accent); text-decoration: none; font-weight: 600; }
.rc-link:hover { text-decoration: underline; }
.rc-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 10px;
  border-radius: 999px;
}
.rc-badge.ok { background: var(--ok-soft); color: var(--ok); }
.rc-badge.no { background: var(--danger-soft); color: var(--danger); }
.rc-reason { font-size: 13px; color: var(--danger); line-height: 1.6; }
.gen5-note {
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.7;
  padding: 12px;
  background: var(--surface-2);
  border-radius: 8px;
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
  .grid { grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); }
  .up-pair, .combined-pair, .step-pair { flex-direction: column; align-items: stretch; }
  .up-cross, .up-arrow { text-align: center; }
  .up-mon, .up-result, .combined-mon, .step-mon, .step-result { justify-content: center; }
  .vc-flow { gap: 4px; flex-direction: column; }
  .vc-mons { flex-direction: row; flex-wrap: wrap; justify-content: center; }
  .vc-mon { padding: 6px 8px; }
  .vc-sprite { width: 36px; height: 36px; }
  .vc-mon-name { font-size: 11px; max-width: 60px; }
  .vc-x { font-size: 16px; }
  .vc-arrow { font-size: 18px; }
}

/* 招式学习途径弹窗 */
.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  overscroll-behavior: contain;
}
.popup {
  position: relative;
  background: var(--surface);
  border-radius: 14px;
  display: flex;
  flex-direction: column;
  max-width: 460px;
  width: calc(100% - 40px);
  height: 70vh;
  max-height: 600px;
  box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  overflow: hidden;
}
.popup-hd {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 16px 20px;
  cursor: grab;
  user-select: none;
  flex-shrink: 0;
}
.popup-hd:active {
  cursor: grabbing;
}
.popup-title {
  font-size: 16px;
  font-weight: 800;
  color: var(--text);
}
.popup-hl {
  font-size: 11px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 2px 8px;
  border-radius: 6px;
  margin-left: 6px;
}
.popup-hd-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.popup-close {
  background: none;
  border: none;
  font-size: 18px;
  color: var(--text-3);
  cursor: pointer;
  padding: 4px;
}
.popup-close:hover { color: var(--text); }
.popup-loading, .popup-empty {
  text-align: center;
  font-size: 13px;
  color: var(--text-3);
  padding: 40px 20px;
  flex: 1;
}
.popup-content {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.popup-tabs {
  display: flex;
  gap: 4px;
  padding: 0 20px 12px;
  flex-wrap: wrap;
  flex-shrink: 0;
}
.popup-tab {
  flex: 1;
  min-width: 88px;
  padding: 7px 8px;
  border: 1px solid var(--border-faint);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--text-3);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  text-align: center;
  white-space: nowrap;
}
.popup-tab:hover { background: var(--hover-bg); color: var(--text); }
.popup-tab.on {
  background: var(--accent-soft);
  border-color: transparent;
  color: var(--accent);
}
.tab-count {
  font-size: 10px;
  opacity: 0.7;
  margin-left: 2px;
}
.popup-body {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0 20px 20px;
  overflow-y: auto;
  overscroll-behavior: contain;
  flex: 1;
}
.popup-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text);
  padding: 6px 8px;
  border-radius: 8px;
}
.popup-row:hover { background: var(--surface-2); }
.popup-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
  min-width: 42px;
  text-align: center;
}
.popup-badge.level { background: var(--ok-soft); color: var(--ok); }
.popup-badge.tm { background: var(--accent-soft); color: var(--accent); }
.popup-badge.egg { background: #fef3c7; color: #92400e; }
.popup-badge.tutor { background: #ede9fe; color: #5b21b6; }
.popup-none { font-size: 12px; color: var(--text-3); padding: 10px 0; }
.popup-row.highlight {
  background: var(--accent-soft);
  border-radius: 8px;
}
.popup-move-name { flex: 1; font-weight: 600; }
.popup-move-type {
  font-size: 11px;
  color: var(--text-3);
  background: var(--surface-2);
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
.popup-current {
  font-size: 10px;
  font-weight: 700;
  color: var(--accent);
  background: var(--accent-soft);
  padding: 1px 8px;
  border-radius: 999px;
  white-space: nowrap;
}

.vc-lv-tag {
  font-size: 10px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 4px;
  color: #fff;
}
.vc-lv-tag.tm { color: #fff; }
.vc-lv-tag.unknown {
  color: #fff;
  cursor: pointer;
}
.vc-lv-tag.unknown:hover { color: #fff; opacity: 0.8; }

@media (max-width: 640px) {
  .compute-options {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .compute-options .mode-toggle {
    width: 100%;
  }
  .gen-select {
    justify-content: space-between;
  }
}
</style>