<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { getPokemon, listPokemonIds, listAbilities, getMovesByGen, type PokemonNavItem, type MovesByGenResponse } from '../api'
import { imageUrl, typeColor } from '../types'
import TypeBadge from '../components/TypeBadge.vue'
import CategoryBadge from '../components/CategoryBadge.vue'
import SafeImage from '../components/SafeImage.vue'
import ShapeIcon from '../components/ShapeIcon.vue'
import StatsRadar from '../components/StatsRadar.vue'
import type {
  PokemonDetail,
  Form,
  MoveEntry,
  EvolutionNode,
  PokedexEntry,
} from '../types'
import { normalizeEggGroup } from '../types'

const route = useRoute()
const router = useRouter()
const detail = ref<PokemonDetail | null>(null)
const error = ref('')
const activeForm = ref(0)
const activeTab = ref<'moves' | 'machine' | 'egg'>('moves')
const openDexGen = ref(0)
const navList = ref<PokemonNavItem[]>([])
const abilityMap = ref<Record<string, string>>({})
const abilityIdMap = ref<Record<string, string>>({})
const moveGen = ref(9)
const genMovesData = ref<MovesByGenResponse | null>(null)

const navIndex = computed(() =>
  navList.value.findIndex((n) => n.id === route.params.id)
)
const navNameMap = computed(() => {
  const map = new Map<string, string>()
  for (const n of navList.value) map.set(n.nameZh, n.id)
  return map
})
const evoId = (name: string) => navNameMap.value.get(name)
const prev = computed(() =>
  navIndex.value > 0 ? navList.value[navIndex.value - 1] : null
)
const next = computed(() =>
  navIndex.value >= 0 && navIndex.value < navList.value.length - 1
    ? navList.value[navIndex.value + 1]
    : null
)

const statLabels: Record<string, string> = {
  hp: 'HP',
  attack: '攻击',
  defense: '防御',
  sp_attack: '特攻',
  sp_defense: '特防',
  speed: '速度',
}

const statColors: Record<string, string> = {
  hp: '#ff5959',
  attack: '#f5ac78',
  defense: '#fae078',
  sp_attack: '#9db7f5',
  sp_defense: '#a7db8d',
  speed: '#fa92b2',
}

async function loadAbilities(names: string[]) {
  const map: Record<string, string> = {}
  const mapId: Record<string, string> = {}
  await Promise.all(
    names.map(async (name) => {
      try {
        const res = await listAbilities({ search: name })
        const hit = res.items.find((a) => a.nameZh === name) || res.items[0]
        if (hit?.description) map[name] = hit.description
        if (hit?.id) mapId[name] = hit.id
      } catch {
        /* ignore */
      }
    })
  )
  abilityMap.value = map
  abilityIdMap.value = mapId
}

async function load() {
  error.value = ''
  detail.value = null
  moveGen.value = 9
  genMovesData.value = null
  try {
    const d = await getPokemon(route.params.id as string)
    detail.value = d
    document.title = `${d.name_zh} - 宝可梦图鉴`
    const names = d.forms[activeForm.value]?.abilities?.map((a) => a.name) ?? []
    loadAbilities(names)
  } catch {
    error.value = '未找到该宝可梦'
  }
}

function goBack() {
  if (window.history.state?.back) {
    router.back()
  } else {
    router.push('/')
  }
}

onMounted(async () => {
  load()
  navList.value = await listPokemonIds()
})

watch(
  () => route.params.id,
  () => {
    load()
    activeForm.value = 0
    activeTab.value = 'moves'
    window.scrollTo({ top: 0 })
  }
)

watch(
  () => activeForm.value,
  () => {
    const names = form()?.abilities?.map((a) => a.name) ?? []
    loadAbilities(names)
  }
)

onBeforeUnmount(() => {
  document.title = '宝可梦图鉴'
})

const form = (): Form | undefined => detail.value?.forms[activeForm.value]

const REGION_PREFIXES = ['阿罗拉', '伽勒尔', '洗翠']

const galleryItems = computed(() => {
  const d = detail.value
  if (!d) return []
  const items: { key: string; label: string; src: string; shinySrc: string }[] = []
  const used = new Set<string>()

  const findHome = (candidates: string[]): { image: string; shiny: string } | undefined => {
    for (const c of candidates) {
      const h = d.home_images.find((x) => x.name === c)
      if (h) return { image: imageUrl('home', h.image), shiny: imageUrl('home', h.shiny) }
    }
    return undefined
  }

  const addItem = (key: string, label: string, candidates: string[], fallback: string) => {
    if (used.has(key)) return
    used.add(key)
    const h = findHome(candidates)
    items.push({ key, label, src: h ? h.image : fallback, shinySrc: h ? h.shiny : '' })
  }

  for (const f of d.forms) {
    const name = f.name
    const cands = [name]
    if (!d.home_images.some((x) => x.name === name)) {
      cands.push(`${name}-雄性`, `${name}-雌性`)
    }
    for (const r of REGION_PREFIXES) {
      if (name.startsWith(r)) cands.push(`${name.slice(r.length)}-${r}的样子`)
    }
    if (name.startsWith('超极巨化')) {
      cands.push(`${name.slice(4)}-超极巨化`)
      const g = d.gigantamax_evolution.find((x) => `${x.name}超极巨化` === name)
      if (g) cands.push(`${g.name}-${g.form_name}`)
    }
    const suffixHit = d.home_images.find((x) => x.name.endsWith(name))
    if (suffixHit) cands.push(suffixHit.name)
    addItem(name, name, cands, f.image ? imageUrl('official', f.image) : '')
  }

  const shown = new Set(d.forms.map((f) => f.name))
  const hasGmaxForm = d.forms.some((f) => f.name.startsWith('超极巨化'))
  for (const m of d.mega_evolution || []) {
    if (shown.has(m.form_name)) continue
    addItem(
      `mega-${m.form_name}`,
      m.form_name,
      [`${m.name}-${m.form_name}`],
      m.image ? imageUrl('dream', m.image) : ''
    )
    shown.add(m.form_name)
  }
  for (const g of d.gigantamax_evolution || []) {
    if (shown.has(g.form_name) || hasGmaxForm) continue
    addItem(
      `gmax-${g.form_name}`,
      g.form_name,
      [`${g.name}-${g.form_name}`, `${g.name}-超极巨化`],
      g.image ? imageUrl('dream', g.image) : ''
    )
  }

  return items
})

const hasGallery = computed(() => galleryItems.value.length > 0)

const stats = () => detail.value?.stats[activeForm.value]?.data

const radarData = computed(() => {
  const s = stats()
  const order = ['hp', 'attack', 'defense', 'sp_attack', 'sp_defense', 'speed']
  if (!s) return { labels: [], values: [] }
  return {
    labels: order.map((k) => statLabels[k] || k),
    values: order.map((k) => Number(s[k]) || 0),
  }
})

const statsTotal = () => {
  const d = stats()
  if (!d) return 0
  return Object.values(d).reduce((s, v) => s + Number(v || 0), 0)
}

const MOVE_KEYS = {
  moves: 'learnable_moves',
  machine: 'machine_moves',
  egg: 'egg_moves',
} as const

const activeMoves = () => {
  if (!detail.value) return []
  if (moveGen.value !== 9 && genMovesData.value) {
    const tab = activeTab.value
    if (tab === 'moves') return genMovesData.value.learnable.map((m) => ({ name: m.name, level: m.level || '—', machine: '', type: m.type, category: m.category || '—', power: m.power || '—', accuracy: m.accuracy || '—', pp: m.pp || '—' }))
    if (tab === 'machine') return genMovesData.value.machine.map((m) => ({ name: m.name, level: '', machine: m.tm || '', type: m.type, category: m.category || '—', power: m.power || '—', accuracy: m.accuracy || '—', pp: m.pp || '—' }))
    if (tab === 'egg') return genMovesData.value.egg.map((m) => ({ name: m.name, level: '蛋', machine: '', type: m.type, category: m.category || '—', power: m.power || '—', accuracy: m.accuracy || '—', pp: m.pp || '—' }))
  }
  const data = detail.value[MOVE_KEYS[activeTab.value]] as { form: string; data: MoveEntry[] }[]
  const list = data.find((d) => d.form === form()?.name)
  return (list || data[0] || { data: [] }).data
}

async function loadMovesByGen(gen: number) {
  if (!detail.value || gen === 9) { genMovesData.value = null; return }
  try {
    genMovesData.value = await getMovesByGen(route.params.id as string, gen)
  } catch { /* ignore */ }
}

watch(moveGen, (g) => {
  if (g !== 9) loadMovesByGen(g)
  else genMovesData.value = null
})

function evolutionImage(node: EvolutionNode): string {
  return imageUrl('dream', node.image || '')
}

function typeEffectData() {
  if (!detail.value) return { data: [] }
  const t = detail.value.type_effectiveness
  return t.find((x) => x.form === form()?.name) || t[0] || { data: [] }
}

interface EffItem {
  type: string
  display: string
}

const effGroups = () => {
  const data = typeEffectData().data as { type: string; damage: string }[]
  const format = (d: string) => {
    if (d === '0.25') return '¼'
    if (d === '0.5') return '½'
    return d
  }
  const groups: { key: string; label: string; items: EffItem[] }[] = [
    { key: 'weak4', label: '4倍弱点', items: [] },
    { key: 'weak2', label: '2倍弱点', items: [] },
    { key: 'normal', label: '普通', items: [] },
    { key: 'resist', label: '抵抗', items: [] },
    { key: 'immune', label: '免疫', items: [] },
  ]
  for (const e of data) {
    const dmg = Number(e.damage)
    const item = { type: e.type, display: format(e.damage) }
    if (dmg >= 4) groups[0].items.push(item)
    else if (dmg === 2) groups[1].items.push(item)
    else if (dmg === 1) groups[2].items.push(item)
    else if (dmg === 0) groups[4].items.push(item)
    else groups[3].items.push(item)
  }
  return groups.filter((g) => g.items.length > 0)
}

const heroBg = () => {
  const t = form()?.types[0]
  return t
    ? `linear-gradient(160deg, ${typeColor(t)}38, ${typeColor(t)}0f)`
    : 'var(--bg)'
}

function pokedexEntries(): PokedexEntry[] {
  return detail.value?.pokedex_entries || []
}

function dexGroups(gen: PokedexEntry) {
  const seen = new Map<string, { group: string; names: string[]; text: string }>()
  for (const v of gen.versions) {
    if (!seen.has(v.group)) seen.set(v.group, { group: v.group, names: [], text: v.text })
    const g = seen.get(v.group)!
    if (!g.names.includes(v.name)) g.names.push(v.name)
  }
  return [...seen.values()]
}

const SHAPE_LABELS: Record<string, string> = {
  '01': '球形',
  '02': '蛇形',
  '03': '鱼形',
  '04': '双手形',
  '05': '柱形',
  '06': '双足兽形',
  '07': '双腿形',
  '08': '四足兽形',
  '09': '双翅形',
  '10': '触手形',
  '11': '组合形',
  '12': '人形',
  '13': '多翅形',
  '14': '虫形',
}

function shapeLabel(shape: string): string {
  const m = shape.match(/Body(\d+)\.png/i)
  if (!m) return shape
  return SHAPE_LABELS[m[1]] || `体型 ${m[1]}`
}

function basePointsText(list: Form['base_points'] | undefined): string {
  if (!list || list.length === 0) return '—'
  const parts = list
    .filter((p) => p.value > 0)
    .map((p) => `${statLabels[p.stat] || p.stat}+${p.value}`)
  return parts.length ? parts.join('、') : '—'
}
</script>

<template>
  <div v-if="error" class="error">{{ error }}</div>

  <div v-else-if="detail" class="detail">
    <button class="back" @click="goBack">
      <span class="back-icon">‹</span> 返回图鉴
    </button>

    <div class="hero">
      <div class="hero-img" :style="{ background: heroBg() }">
        <SafeImage
          v-if="form()?.image"
          :src="imageUrl('official', form()!.image)"
          :alt="detail.name_zh"
        />
      </div>
      <div class="hero-info">
        <div class="hero-id">No. {{ detail.pokedex_id }}</div>
        <h1>{{ detail.name_zh }}</h1>
        <div class="names">{{ detail.name_ja }} · {{ detail.name_en }}</div>
        <div class="types">
          <TypeBadge v-for="t in form()?.types" :key="t" :type="t" size="lg" />
        </div>
        <div v-if="form()" class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">分类</div>
            <div class="meta-value">{{ form()!.category }}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">身高</div>
            <div class="meta-value">{{ form()!.height }}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">体重</div>
            <div class="meta-value">{{ form()!.weight }}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">颜色</div>
            <div class="meta-value">{{ form()!.color }}</div>
          </div>
        </div>
        <div v-if="form()?.abilities.length" class="ability-list">
          <div class="ability-item" v-for="a in form()!.abilities" :key="a.name">
            <div class="ability-head">
              <span class="ability-name" :class="{ hidden: a.is_hidden }">
                <router-link v-if="abilityIdMap[a.name]" :to="`/abilities/${abilityIdMap[a.name]}`" class="ability-link">{{ a.name }}</router-link>
                <span v-else>{{ a.name }}</span>
              </span>
              <span v-if="a.is_hidden" class="hidden-tag">隐藏特性</span>
            </div>
            <p class="ability-desc">
              {{ abilityMap[a.name] || '加载描述…' }}
            </p>
          </div>
        </div>
      </div>
    </div>

    <div class="nav-buttons">
      <router-link v-if="prev" :to="`/pokemon/${prev.id}`" class="nav-btn">
        <span class="nav-arrow">‹</span>
        <span class="nav-side">
          <span class="nav-label">上一只</span>
          <span class="nav-name">#{{ prev.id }} {{ prev.nameZh }}</span>
        </span>
      </router-link>
      <span v-else class="nav-btn disabled">
        <span class="nav-side">
          <span class="nav-label">已是第一只</span>
        </span>
      </span>
      <router-link v-if="next" :to="`/pokemon/${next.id}`" class="nav-btn right">
        <span class="nav-side">
          <span class="nav-label">下一只</span>
          <span class="nav-name">#{{ next.id }} {{ next.nameZh }}</span>
        </span>
        <span class="nav-arrow">›</span>
      </router-link>
      <span v-else class="nav-btn disabled right">
        <span class="nav-side">
          <span class="nav-label">已是最后一只</span>
        </span>
      </span>
    </div>

    <template v-if="detail.forms.length > 1">
      <div class="seg">
        <button
          v-for="(f, i) in detail.forms"
          :key="f.name"
          :class="{ active: i === activeForm }"
          @click="activeForm = i"
        >
          {{ f.name }}
        </button>
      </div>
    </template>

    <section class="section">
      <h2>基本信息</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="info-label">捕获率</span>
          <span class="info-value">{{ form()!.catch_rate || '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">基础经验</span>
          <span class="info-value">{{ form()!.base_exp ?? '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">对战经验</span>
          <span class="info-value">{{ form()!.battle_exp ?? '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">100级经验</span>
          <span class="info-value">{{ form()!.experience_100 || '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">基础点数</span>
          <span class="info-value">{{ basePointsText(form()!.base_points) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">体型</span>
          <span class="info-value shape-value">
            <ShapeIcon :shape="form()!.shape" />
            {{ shapeLabel(form()!.shape) }}
          </span>
        </div>
        <div class="info-item info-item--gender">
          <span class="info-label">性别比例</span>
          <span class="info-value gender-bar-wrap">
            <span v-if="form()!.gender_ratio.male + form()!.gender_ratio.female === 0" class="gender-none">无性别</span>
            <span v-else class="gender-flex">
              <span class="gender-label g-f">♀ {{ form()!.gender_ratio.female }}%</span>
              <span class="gender-bar">
                <span class="gender-f" :style="{ width: form()!.gender_ratio.female + '%' }"></span>
                <span class="gender-m" :style="{ width: form()!.gender_ratio.male + '%' }"></span>
              </span>
              <span class="gender-label g-m">♂ {{ form()!.gender_ratio.male }}%</span>
            </span>
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">蛋群</span>
          <span v-if="form()!.egg_groups.length" class="info-value egg-value">
            <router-link
              v-for="eg in form()!.egg_groups"
              :key="eg"
              :to="`/egg-groups?group=${normalizeEggGroup(eg)}`"
              class="egg-link"
            >
              {{ normalizeEggGroup(eg) }}
            </router-link>
          </span>
          <span v-else class="info-value">—</span>
        </div>
        <div class="info-item">
          <span class="info-label">孵蛋步数</span>
          <span class="info-value">{{ form()!.egg_cycles || '—' }}</span>
        </div>
      </div>
    </section>

    <section v-if="hasGallery" class="section">
      <h2>形态与异色</h2>
      <div class="gallery-grid">
        <div v-for="item in galleryItems" :key="item.key" class="gallery-item">
          <div class="gallery-label">{{ item.label }}</div>
          <div class="gallery-imgs">
            <div class="gallery-cell" :style="{ background: heroBg() }">
              <SafeImage
                v-if="item.src"
                :src="item.src"
                :alt="item.label"
              />
              <span class="tag">普通</span>
            </div>
            <div v-if="item.shinySrc" class="gallery-cell" :style="{ background: heroBg() }">
              <SafeImage
                :src="item.shinySrc"
                :alt="`${item.label} 异色`"
              />
              <span class="tag shiny">异色</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <h2>种族值 <span class="hint">总和 {{ statsTotal() }}</span></h2>
      <div v-if="stats()" class="stats-flex">
        <div class="stats">
          <div v-for="(value, key) in stats()" :key="key" class="stat-row">
            <span class="stat-label">{{ statLabels[key] || key }}</span>
            <div class="stat-track">
              <div
                class="stat-fill"
                :style="{
                  width: Math.min(100, (Number(value) / 200) * 100) + '%',
                  background: statColors[key] || '#999',
                }"
              />
            </div>
            <span class="stat-value">{{ value }}</span>
          </div>
        </div>
        <StatsRadar :labels="radarData.labels" :values="radarData.values" />
      </div>
    </section>

    <section class="section">
      <h2>属性克制</h2>
      <div class="eff-groups">
        <div v-for="g in effGroups()" :key="g.key" class="eff-group">
          <div class="eff-group-label" :class="`eff-${g.key}`">
            {{ g.label }}
          </div>
          <div class="eff-items">
            <div v-for="e in g.items" :key="e.type" class="eff-item" :class="`eff-${g.key}`">
              <span class="eff-type" :style="{ background: typeColor(e.type) }">
                <span class="picon" :class="`picon-t-${e.type}`" />
                <span>{{ e.type }}</span>
              </span>
              <span class="eff-val">×{{ e.display }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section v-if="detail.evolution_chains.length" class="section">
      <h2>进化链</h2>
      <div
        v-for="(chain, ci) in detail.evolution_chains"
        :key="ci"
        class="evo-chain"
      >
        <template v-for="(node, ni) in chain" :key="ni">
          <component
            :is="evoId(node.name) ? RouterLink : 'div'"
            :to="evoId(node.name) ? `/pokemon/${evoId(node.name)}` : undefined"
            class="evo-node"
            :class="{ 'evo-linkable': evoId(node.name) }"
          >
            <div class="evo-img">
              <SafeImage
                v-if="node.image"
                :src="evolutionImage(node)"
                :alt="node.name"
              />
              <span v-else class="evo-unknown">?</span>
            </div>
            <div class="evo-name">{{ node.name }}</div>
          </component>
          <div v-if="ni < chain.length - 1" class="evo-link">
            <div class="evo-arrow">→</div>
            <div class="evo-condition">{{ chain[ni + 1].text || '进化' }}</div>
          </div>
        </template>
      </div>
    </section>

    <section class="section">
      <h2>可学会招式</h2>
      <select v-model="moveGen" class="gen-select">
        <option :value="9">第9世代</option>
        <option :value="8">第8世代</option>
        <option :value="7">第7世代</option>
        <option :value="6">第6世代</option>
        <option :value="5">第5世代</option>
        <option :value="4">第4世代</option>
        <option :value="3">第3世代</option>
        <option :value="2">第2世代</option>
      </select>
      <div class="seg tabs">
        <button :class="{ active: activeTab === 'moves' }" @click="activeTab = 'moves'">
          升级学习
        </button>
        <button :class="{ active: activeTab === 'machine' }" @click="activeTab = 'machine'">
          招式学习器
        </button>
        <button :class="{ active: activeTab === 'egg' }" @click="activeTab = 'egg'">
          蛋招式
        </button>
      </div>
      <div class="table-wrap" :class="{ 'is-machine': activeTab === 'machine' }">
        <table class="moves-table">
          <thead>
            <tr>
              <th>{{ activeTab === 'machine' ? '学习器' : '等级' }}</th>
              <th>名称</th>
              <th>属性</th>
              <th>分类</th>
              <th class="num">威力</th>
              <th class="num">命中</th>
              <th class="num">PP</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="m in activeMoves()" :key="m.name + m.level + m.machine">
              <td class="num">{{ m.machine || m.level || '—' }}</td>
              <td class="move-name">{{ m.name }}</td>
              <td>
                <span class="type-badge" :style="{ background: typeColor(m.type) }">
                  <span class="picon" :class="`picon-t-${m.type}`" />
                  {{ m.type }}
                </span>
              </td>
              <td class="cat-cell">
                <CategoryBadge :category="m.category" />
              </td>
              <td class="num">{{ m.power }}</td>
              <td class="num">{{ m.accuracy }}</td>
              <td class="num">{{ m.pp }}</td>
            </tr>
            <tr v-if="activeMoves().length === 0">
              <td colspan="7" class="empty">暂无数据</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section class="section">
      <h2>图鉴介绍</h2>
      <div v-if="pokedexEntries().length" class="dex-entries">
        <div v-for="(gen, gi) in pokedexEntries()" :key="gen.name" class="dex-gen">
          <button
            class="dex-gen-head"
            :class="{ open: openDexGen === gi }"
            @click="openDexGen = openDexGen === gi ? -1 : gi"
          >
            <span class="dex-gen-name">{{ gen.name }}</span>
            <span class="dex-gen-count">{{ gen.versions.length }} 个版本</span>
            <svg
              class="dex-chevron"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
          <Transition name="dex">
            <div v-if="openDexGen === gi" class="dex-gen-body">
              <div v-for="g in dexGroups(gen)" :key="g.group" class="dex-ver">
                <div class="dex-ver-head">
                  <span class="dex-ver-names">{{ g.names.join(' / ') }}</span>
                  <span class="dex-ver-group">{{ g.group }}</span>
                </div>
                <p class="dex-ver-text">{{ g.text }}</p>
              </div>
            </div>
          </Transition>
        </div>
      </div>
    </section>

    <section v-if="detail.names?.length" class="section">
      <h2>名字由来</h2>
      <div class="name-list">
        <div v-for="n in detail.names" :key="n.language" class="name-item">
          <div class="name-item-head">
            <span class="name-lang">{{ n.language }}</span>
            <span class="name-word">{{ n.name }}</span>
          </div>
          <p class="name-origin">{{ n.origin }}</p>
        </div>
      </div>
    </section>

    <section v-if="detail.prototype" class="section">
      <h2>原型剖析</h2>
      <p class="prototype-text">{{ detail.prototype }}</p>
    </section>
  </div>

  <div v-else class="detail">
    <div class="skeleton sk-back" />
    <div class="hero">
      <div class="skeleton sk-hero-img" />
      <div class="sk-hero-info">
        <div class="skeleton sk-line" style="width: 90px" />
        <div class="skeleton sk-line" style="width: 150px; height: 28px" />
        <div class="skeleton sk-line" style="width: 200px" />
        <div class="skeleton sk-line" style="width: 180px; height: 28px" />
      </div>
    </div>
    <div class="skeleton sk-section" />
    <div class="skeleton sk-section" style="height: 200px" />
  </div>
</template>

<style scoped>
.error {
  text-align: center;
  color: var(--text-3);
  padding: 60px 0;
}

.back {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  color: var(--accent);
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
  margin-bottom: 16px;
  font-size: 14px;
  font-weight: 500;
  transition: opacity 0.15s;
}
.back:hover {
  opacity: 0.7;
}
.back-icon {
  font-size: 18px;
  line-height: 1;
}

.hero {
  display: flex;
  gap: 28px;
  background: var(--surface);
  border-radius: 20px;
  padding: 28px;
  box-shadow: var(--shadow);
}
.hero-img {
  width: 240px;
  height: 240px;
  flex-shrink: 0;
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.hero-img img {
  max-width: 210px;
  max-height: 210px;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.15));
}
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(190px, 1fr));
  gap: 12px;
}
.gallery-item {
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  overflow: hidden;
}
.gallery-label {
  text-align: center;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  padding: 9px;
  border-bottom: 1px solid var(--border-faint);
}
.gallery-imgs {
  display: flex;
}
.gallery-cell {
  flex: 1;
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}
.gallery-cell + .gallery-cell {
  border-left: 1px solid var(--border-faint);
}
.gallery-cell :deep(img) {
  max-width: 82%;
  max-height: 82%;
  filter: drop-shadow(0 6px 12px rgba(0, 0, 0, 0.15));
}
.tag {
  position: absolute;
  top: 6px;
  left: 6px;
  font-size: 10px;
  font-weight: 700;
  color: var(--text-3);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 999px;
  padding: 1px 7px;
}
.tag.shiny {
  color: var(--accent);
  border-color: var(--accent);
}
.hero-info {
  flex: 1;
  min-width: 0;
}
.hero-id {
  color: var(--text-3);
  font-weight: 800;
  letter-spacing: 1px;
  font-size: 13px;
}
.hero-info h1 {
  margin: 4px 0;
  font-size: 32px;
}
.names {
  color: var(--text-3);
  font-size: 14px;
  margin-bottom: 14px;
}
.types {
  display: flex;
  gap: 8px;
  margin-bottom: 18px;
}
.meta-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 10px;
  margin-bottom: 16px;
  max-width: 480px;
}
.meta-item {
  background: var(--surface-2);
  border-radius: 10px;
  padding: 8px 12px;
}
.meta-label {
  font-size: 12px;
  color: var(--text-3);
  margin-bottom: 2px;
}
.meta-value {
  font-size: 14px;
  font-weight: 600;
}
.ability-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  max-width: 560px;
}
.ability-item {
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 12px;
  padding: 10px 14px;
}
.ability-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
}
.ability-name {
  display: inline-flex;
  align-items: center;
  font-size: 14px;
  font-weight: 600;
  background: var(--surface-3);
  border-radius: 10px;
  padding: 2px 10px;
}
.ability-name.hidden {
  background: var(--ability-hidden-bg);
  color: var(--ability-hidden-text);
}
.ability-link {
  color: inherit;
  text-decoration: none;
}
.ability-link:hover {
  text-decoration: underline;
  opacity: 0.85;
}
.hidden-tag {
  font-size: 11px;
  color: var(--ability-hidden-text);
  background: var(--ability-hidden-bg);
  border-radius: 8px;
  padding: 1px 8px;
}
.ability-desc {
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-2);
  margin: 0;
}

.seg {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin: 16px 0;
}
.seg button {
  padding: 7px 16px;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 10px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-2);
  transition: all 0.15s;
}
.seg button:hover {
  border-color: var(--accent);
  color: var(--accent);
}
.seg button.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.section {
  margin-top: 20px;
  background: var(--surface);
  border-radius: 20px;
  padding: 24px 28px;
  box-shadow: var(--shadow);
}
.section h2 {
  margin: 0 0 16px;
  font-size: 18px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.section h2::before {
  content: '';
  width: 5px;
  height: 20px;
  border-radius: 3px;
  background: var(--accent);
}
.hint {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-3);
}

.desc {
  font-size: 14px;
  line-height: 1.8;
  color: var(--text-2);
}

.dex-entries {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.dex-gen {
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 12px;
  overflow: hidden;
}
.dex-gen-head {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border: none;
  background: none;
  color: var(--text);
  cursor: pointer;
  text-align: left;
  transition: background 0.15s;
}
.dex-gen-head:hover {
  background: var(--surface-3);
}
.dex-gen-name {
  font-size: 14px;
  font-weight: 600;
}
.dex-gen-count {
  font-size: 11px;
  color: var(--text-3);
  margin-left: auto;
}
.dex-chevron {
  color: var(--text-3);
  transition: transform 0.2s;
  flex-shrink: 0;
}
.dex-gen-head.open .dex-chevron {
  transform: rotate(180deg);
}
.dex-gen-body {
  padding: 4px 14px 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.dex-ver-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
  flex-wrap: wrap;
}
.dex-ver-names {
  font-size: 13px;
  font-weight: 700;
  color: var(--text);
}
.dex-ver-group {
  font-size: 11px;
  color: var(--text-3);
}
.dex-ver-text {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text-2);
}
.dex-enter-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.dex-enter-from {
  opacity: 0;
  transform: translateY(-6px);
}
.dex-leave-active {
  transition: opacity 0.12s ease;
}
.dex-leave-to {
  opacity: 0;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.info-item {
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 10px;
  padding: 10px 12px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}
.info-label {
  font-size: 11px;
  color: var(--text-3);
}
.info-value {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  word-break: break-word;
}
.gender-bar-wrap {
  width: 100%;
}
.gender-flex {
  display: flex;
  align-items: center;
  gap: 8px;
}
.gender-label {
  font-size: 12px;
  font-weight: 700;
  white-space: nowrap;
}
.gender-label.g-f {
  color: #e05a7a;
}
.gender-label.g-m {
  color: #4f86e0;
}
.gender-bar {
  display: flex;
  flex: 1;
  height: 18px;
  border-radius: 999px;
  overflow: hidden;
  min-width: 60px;
}
.gender-f {
  background: #e05a7a;
  transition: width 0.3s;
}
.gender-m {
  background: #4f86e0;
  transition: width 0.3s;
}
.gender-none {
  font-size: 13px;
  color: var(--text-3);
}
.egg-value {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.egg-link {
  color: var(--accent);
  text-decoration: none;
  border: 1px solid var(--accent-soft);
  background: var(--accent-soft);
  border-radius: 999px;
  padding: 1px 10px;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.15s, color 0.15s;
}
.egg-link:hover {
  background: var(--accent);
  color: #fff;
}
.shape-value {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--text-2);
}
.shape-value svg {
  flex-shrink: 0;
}
.name-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.name-item {
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 12px;
  padding: 10px 14px;
}
.name-item-head {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.name-lang {
  font-size: 12px;
  font-weight: 700;
  color: var(--accent);
}
.name-word {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.name-origin {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.7;
  color: var(--text-2);
}
.prototype-text {
  margin: 0;
  font-size: 14px;
  line-height: 1.9;
  color: var(--text-2);
  white-space: pre-line;
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 12px;
  padding: 14px 16px;
}
@media (max-width: 640px) {
  .info-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .info-item--gender {
    grid-column: 1 / -1;
  }
}

.stats-flex {
  display: flex;
  gap: 20px;
  align-items: center;
  flex-wrap: wrap;
}
.stats {
  flex: 1;
  min-width: 280px;
  max-width: 560px;
}
.stat-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}
.stat-label {
  width: 52px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-2);
}
.stat-track {
  flex: 1;
  height: 16px;
  background: var(--surface-3);
  border-radius: 8px;
  overflow: hidden;
}
.stat-fill {
  height: 100%;
  border-radius: 8px;
  transition: width 0.4s ease;
}
.stat-value {
  width: 36px;
  text-align: right;
  font-size: 14px;
  font-weight: 700;
}

.eff-groups {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.eff-group-label {
  font-size: 13px;
  font-weight: 700;
  margin-bottom: 8px;
  padding-left: 10px;
  border-left: 4px solid #ccc;
}
.eff-group-label.eff-weak4 {
  border-color: #e74c3c;
  color: var(--eff-weak4-text);
}
.eff-group-label.eff-weak2 {
  border-color: #e67e22;
  color: var(--eff-weak2-text);
}
.eff-group-label.eff-resist {
  border-color: #27ae60;
  color: var(--eff-resist-text);
}
.eff-group-label.eff-immune {
  border-color: #7f8c8d;
  color: var(--eff-immune-text);
}
.eff-group-label.eff-normal {
  border-color: #bbb;
  color: var(--text-3);
}
.eff-items {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}
.eff-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 6px 10px;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid transparent;
}
.eff-item.eff-weak4 {
  background: var(--eff-weak4-bg);
  border-color: var(--eff-weak4-border);
}
.eff-item.eff-weak2 {
  background: var(--eff-weak2-bg);
  border-color: var(--eff-weak2-border);
}
.eff-item.eff-resist {
  background: var(--eff-resist-bg);
  border-color: var(--eff-resist-border);
}
.eff-item.eff-immune {
  background: var(--eff-immune-bg);
  border-color: var(--eff-immune-border);
}
.eff-item.eff-normal {
  background: var(--eff-normal-bg);
}
.eff-type {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #fff;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 14px;
  line-height: 1.5;
}
.eff-val {
  font-size: 13px;
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
}

.evo-chain {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.evo-node {
  text-align: center;
}
.evo-node.evo-linkable {
  text-decoration: none;
  color: inherit;
  cursor: pointer;
}
.evo-node.evo-linkable .evo-img {
  transition: transform 0.15s, outline 0.15s;
  outline: 2px solid transparent;
  outline-offset: 1px;
}
.evo-node.evo-linkable:hover .evo-img {
  transform: translateY(-2px);
  outline-color: var(--accent);
}
.evo-node.evo-linkable:hover .evo-name {
  color: var(--accent);
}
.evo-img {
  width: 96px;
  height: 96px;
  background: var(--evo-img-bg);
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}
.evo-img img {
  max-width: 82px;
  max-height: 82px;
}
.evo-unknown {
  color: var(--text-faint);
  font-size: 24px;
  font-weight: 700;
}
.evo-name {
  font-size: 13px;
  font-weight: 600;
  margin-top: 6px;
}
.evo-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 0 8px;
  max-width: 120px;
}
.evo-arrow {
  color: var(--accent);
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
}
.evo-condition {
  color: var(--text-3);
  font-size: 11px;
  text-align: center;
}

.tabs {
  margin: 0 0 14px;
}
.gen-select {
  margin-bottom: 14px;
  padding: 4px 10px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-size: 13px;
  outline: none;
  float: right;
}
.gen-select:focus { border-color: var(--accent); }

.table-wrap {
  overflow: auto;
  max-height: 480px;
  border: 1px solid var(--border-faint);
  border-radius: 12px;
}
.moves-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  min-width: 640px;
}
.moves-table thead th {
  position: sticky;
  top: 0;
  background: var(--table-head-bg);
  z-index: 1;
}
.moves-table th,
.moves-table td {
  padding: 9px 12px;
  border-bottom: 1px solid var(--border-faint);
  text-align: left;
  white-space: nowrap;
}
.moves-table tbody tr:hover {
  background: var(--hover-bg);
}
.moves-table th {
  color: var(--text-3);
  font-weight: 600;
  font-size: 12px;
}
.moves-table td.num,
.moves-table th.num {
  text-align: center;
}
.move-name {
  font-weight: 600;
}
.empty {
  text-align: center;
  color: var(--text-3);
  padding: 24px !important;
}
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: #fff;
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px 3px 4px;
  border-radius: 20px;
  line-height: 1;
}

.nav-buttons {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}
.nav-btn {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  border: 1px solid var(--border-soft);
  background: var(--surface);
  border-radius: 14px;
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
}
.nav-btn.right {
  justify-content: flex-end;
  text-align: right;
}
.nav-btn:hover:not(.disabled) {
  border-color: var(--accent);
  box-shadow: var(--shadow-hover);
}
.nav-btn:active:not(.disabled) {
  transform: scale(0.98);
}
.nav-btn.disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.nav-arrow {
  font-size: 24px;
  line-height: 1;
  color: var(--accent);
  font-weight: 700;
}
.nav-side {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.nav-label {
  font-size: 11px;
  color: var(--text-3);
}
.nav-name {
  font-size: 14px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sk-back {
  width: 90px;
  height: 18px;
  margin-bottom: 16px;
}
.sk-hero-img {
  width: 240px;
  height: 240px;
  flex-shrink: 0;
  border-radius: 16px;
}
.sk-hero-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 14px;
}
.sk-line {
  height: 14px;
}
.sk-section {
  width: 100%;
  height: 140px;
  margin-top: 20px;
  border-radius: 20px;
}

@media (max-width: 640px) {
  .hero {
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 18px 14px;
  }
  .hero-img {
    width: 168px;
    height: 168px;
  }
  .sk-hero-img {
    width: 168px;
    height: 168px;
  }
  .nav-buttons {
    flex-direction: column;
  }
  .nav-btn.right {
    justify-content: flex-start;
    text-align: left;
    flex-direction: row-reverse;
  }
  .hero-img img {
    max-width: 150px;
    max-height: 150px;
  }
  .hero-info h1 {
    font-size: 24px;
  }
  .types {
    justify-content: center;
  }
  .meta-grid {
    justify-content: center;
  }
.ability-list {
    max-width: none;
  }
  .meta-grid {
    grid-template-columns: repeat(2, 1fr);
    max-width: none;
  }
  .stats {
    max-width: none;
  }
  .section {
    padding: 18px 14px;
    border-radius: 14px;
  }
  .seg button {
    padding: 6px 12px;
    font-size: 12px;
  }
  .eff-items {
    grid-template-columns: repeat(auto-fill, minmax(105px, 1fr));
  }
  .evo-img {
    width: 84px;
    height: 84px;
  }
  .evo-img img {
    max-width: 70px;
    max-height: 70px;
  }
  .table-wrap {
    margin: 0;
    max-height: none;
    overflow: visible;
    border: none;
  }
  .moves-table,
  .moves-table tbody {
    display: block;
    min-width: 0;
  }
  .moves-table thead {
    display: none;
  }
  .moves-table tr {
    display: grid;
    grid-template-areas:
      'name name lvl'
      'type cat .'
      'pw acc pp';
    grid-template-columns: 1fr 1fr 1fr;
    align-items: center;
    gap: 8px 10px;
    padding: 12px;
    margin-bottom: 8px;
    background: var(--surface-2);
    border: 1px solid var(--border-faint);
    border-radius: 12px;
  }
  .moves-table td {
    display: block;
    border: none;
    padding: 0;
    white-space: nowrap;
  }
  .moves-table td:first-child {
    grid-area: lvl;
    text-align: right;
    color: var(--text-3);
    font-size: 12px;
  }
  .moves-table td:first-child::before {
    content: '等级';
    margin-right: 4px;
  }
  .table-wrap.is-machine .moves-table td:first-child::before {
    content: '学习器';
  }
  .moves-table td:nth-child(2) {
    grid-area: name;
    font-size: 14px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .moves-table td:nth-child(3) {
    grid-area: type;
  }
  .moves-table td:nth-child(4) {
    grid-area: cat;
  }
  .moves-table td:nth-child(5) {
    grid-area: pw;
  }
  .moves-table td:nth-child(6) {
    grid-area: acc;
  }
  .moves-table td:nth-child(7) {
    grid-area: pp;
  }
  .moves-table td:nth-child(n + 5) {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    font-size: 13px;
    font-weight: 600;
  }
  .moves-table td:nth-child(n + 5)::before {
    font-size: 11px;
    font-weight: 500;
    color: var(--text-3);
  }
  .moves-table td:nth-child(5)::before {
    content: '威力';
  }
  .moves-table td:nth-child(6)::before {
    content: '命中';
  }
  .moves-table td:nth-child(7)::before {
    content: 'PP';
  }
  .moves-table tr:has(td.empty) {
    display: block;
  }
  .moves-table td.empty {
    grid-column: 1 / -1;
    padding: 16px !important;
    text-align: center;
  }
  .moves-table td.empty::before {
    content: none;
  }
  .moves-table tbody tr:hover {
    background: var(--surface-2);
  }
}
</style>