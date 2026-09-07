<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, onActivated, reactive, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import { getPokemon, listPokemon, listPokemonIds, listAbilities, getMovesByGen, getPokemonEncounters, type PokemonNavItem, type MovesByGenResponse, type EncounterEntry } from '../api'
import { imageUrl, typeColor } from '../types'
import TypeBadge from '../components/TypeBadge.vue'
import CategoryBadge from '../components/CategoryBadge.vue'
import SafeImage from '../components/SafeImage.vue'
import ShapeIcon from '../components/ShapeIcon.vue'
import type {
  PokemonDetail,
  PokemonSummary,
  Form,
  MoveEntry,
  EvolutionNode,
  PokedexEntry,
} from '../types'
import { normalizeEggGroup } from '../types'
import { useScrollMemory } from '../composables/useScrollMemory'
import { useModalDrag } from '../composables/useModalDrag'

useScrollMemory()

const route = useRoute()
const detail = ref<PokemonDetail | null>(null)
const error = ref('')
const activeForm = ref(0)
const activeTab = ref<'moves' | 'machine' | 'egg' | 'tutor'>('moves')
const eggOpen = ref<Set<string>>(new Set())

function toggleEggOpen(name: string) {
  const s = new Set(eggOpen.value)
  if (s.has(name)) s.delete(name)
  else s.add(name)
  eggOpen.value = s
}

const openDexGen = ref(0)
const navList = ref<PokemonNavItem[]>([])
const abilityMap = ref<Record<string, string>>({})
const abilityIdMap = ref<Record<string, string>>({})
const moveGen = ref(9)
const genMovesData = ref<MovesByGenResponse | null>(null)
const encounters = ref<EncounterEntry[]>([])
const genOpen = ref(false)
const genOptions = [9, 8, 7, 6, 5, 4, 3, 2].map((v) => ({
  value: v,
  label: `第${v}世代`,
}))
function pickGen(v: number) {
  moveGen.value = v
  genOpen.value = false
}
function onGenDocClick() {
  genOpen.value = false
}

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

// 能力名 → { 描述, id } 模块级缓存，避免反复请求
const abilityMetaCache = new Map<string, { description?: string; id?: string }>()
const abilityMetaPending = new Map<string, Promise<{ description?: string; id?: string } | null>>()

async function fetchAbilityMeta(name: string): Promise<{ description?: string; id?: string } | null> {
  const hit = abilityMetaCache.get(name)
  if (hit) return hit
  const pending = abilityMetaPending.get(name)
  if (pending) return pending
  const p = (async () => {
    try {
      const res = await listAbilities({ search: name })
      const m = res.items.find((a) => a.nameZh === name) || res.items[0]
      const meta = m ? { description: m.description ?? undefined, id: m.id } : null
      if (meta) abilityMetaCache.set(name, meta)
      return meta
    } catch {
      return null
    } finally {
      abilityMetaPending.delete(name)
    }
  })()
  abilityMetaPending.set(name, p)
  return p
}

const REGION_BY_SUFFIX: Record<string, string> = { G: '伽勒尔', H: '洗翠', A: '阿罗拉' }

async function loadAbilities(names: string[]) {
  const map: Record<string, string> = {}
  const mapId: Record<string, string> = {}
  const formIdx = activeForm.value
  const metas = await Promise.all(names.map((n) => fetchAbilityMeta(n)))
  if (formIdx !== activeForm.value) return
  names.forEach((name, i) => {
    const meta = metas[i]
    if (meta?.description) map[name] = meta.description
    if (meta?.id) mapId[name] = meta.id
  })
  abilityMap.value = map
  abilityIdMap.value = mapId
}

async function load() {
  error.value = ''
  moveGen.value = 9
  genMovesData.value = null
  encounters.value = []
  try {
    const d = await getPokemon(route.params.id as string)
    detail.value = d
    document.title = `${d.name_zh} - 宝可梦图鉴`
    // 根据地区后缀自动切换形态
    const suffix = d._meta?.formSuffix
    if (suffix) {
      const regionName = REGION_BY_SUFFIX[suffix]
      if (regionName) {
        const idx = d.forms.findIndex((f) => f.name.includes(regionName))
        if (idx >= 0) activeForm.value = idx
      }
    }
    const names = d.forms[activeForm.value]?.abilities?.map((a) => a.name) ?? []
    loadAbilities(names)
    getPokemonEncounters(route.params.id as string).then(e => { encounters.value = e }).catch(() => {})
  } catch {
    error.value = '未找到该宝可梦'
  }
}

onMounted(async () => {
  try {
    navList.value = await listPokemonIds()
  } catch {
    /* 列表导航非关键，失败时隐藏上/下只按钮 */
  }
  document.addEventListener('click', onGenDocClick)
})

onActivated(() => {
  if (detail.value?._meta.id !== route.params.id) {
    load()
  }
})

watch(
  () => route.params.id,
  (newId) => {
    if (newId && detail.value?._meta.id !== newId) {
      activeForm.value = 0
      activeTab.value = 'moves'
      window.scrollTo({ top: 0 })
      load()
    }
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
  document.removeEventListener('click', onGenDocClick)
  document.body.style.overflow = ''
})

const form = (): Form | undefined => detail.value?.forms[activeForm.value]

function matchFormEntry<T extends { form: string; types?: string[]; data?: unknown }>(
  list: T[],
  currentForm: Form | undefined
): T | undefined {
  if (!currentForm) return list[0]
  const byName = list.find((e) => e.form === currentForm.name)
  if (byName) return byName
  const curTypes = currentForm.types
  const byTypes = list.find((e) => e.types && e.types.length === curTypes.length && e.types.every((t) => curTypes.includes(t)))
  return byTypes || list[0]
}

const REGION_PREFIXES = Object.values(REGION_BY_SUFFIX)

const previewImg = ref<string | null>(null)
const galleryTab = ref<'normal' | 'shiny'>('normal')

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

const activeMoves = computed<MoveEntry[]>(() => {
  if (!detail.value) return []
  if (activeTab.value === 'tutor' && moveGen.value === 9) return []
  if (activeTab.value === 'tutor') return (genMovesData.value?.tutor?.map((m) => ({ name: m.name, level: '', machine: '', type: m.type, category: m.category || '—', power: m.power || '—', accuracy: m.accuracy || '—', pp: m.pp || '—' })) || []) as MoveEntry[]
  if (moveGen.value !== 9 && genMovesData.value) {
    const tab = activeTab.value
    if (tab === 'moves') return genMovesData.value.learnable.map((m) => ({ name: m.name, level: m.level || '—', machine: '', type: m.type, category: m.category || '—', power: m.power || '—', accuracy: m.accuracy || '—', pp: m.pp || '—' }))
    if (tab === 'machine') return genMovesData.value.machine.map((m) => ({ name: m.name, level: '', machine: m.tm || '', type: m.type, category: m.category || '—', power: m.power || '—', accuracy: m.accuracy || '—', pp: m.pp || '—' }))
    if (tab === 'egg') return genMovesData.value.egg.map((m) => ({ name: m.name, level: '蛋', machine: '', type: m.type, category: m.category || '—', power: m.power || '—', accuracy: m.accuracy || '—', pp: m.pp || '—', parents: m.parents }))
    if (tab === 'tutor') return genMovesData.value.tutor.map((m) => ({ name: m.name, level: '', machine: '', type: m.type, category: m.category || '—', power: m.power || '—', accuracy: m.accuracy || '—', pp: m.pp || '—' }))
  }
  const data = detail.value[MOVE_KEYS[activeTab.value]] as { form: string; data: MoveEntry[] }[]
  const list = matchFormEntry(data, form())
  return (list || data[0] || { data: [] }).data
})

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

function evolutionImageFallback(node: EvolutionNode): string | undefined {
  if (!detail.value) return undefined
  const targetForm = node.form_name
  const targetName = node.name
  for (const f of detail.value.forms) {
    if (targetForm && f.name === targetForm) {
      return imageUrl('official', f.image)
    }
    if (!targetForm && f.name === targetName) {
      return imageUrl('official', f.image)
    }
  }
  if (targetForm) {
    const evoParen = targetForm.match(/（[^）]+）$/)
    if (evoParen) {
      for (const f of detail.value.forms) {
        if (f.name.endsWith(evoParen[0])) {
          return imageUrl('official', f.image)
        }
      }
    }
  }
  return undefined
}

function typeEffectData() {
  if (!detail.value) return { data: [] }
  const t = detail.value.type_effectiveness
  return matchFormEntry(t, form()) || t[0] || { data: [] }
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

function methodClass(method: string): string {
  if (method === '野生') return 'wild'
  if (method === '交换') return 'trade'
  if (method.includes('极巨')) return 'raid'
  if (method === '宝可追踪') return 'radar'
  if (method.includes('定点') || method.includes('可见')) return 'overworld'
  return ''
}

// ---- 对比功能 ----
const compareOpen = ref(false)
const compareSearch = ref('')
const comparePokeList = ref<PokemonSummary[]>([])
const comparePokePage = ref(1)
const comparePokeHasMore = ref(true)
const comparePokeLoading = ref(false)
const compareActiveIndex = ref(-1)
const compareLoading = ref(false)
const compareError = ref('')
const compareA = ref<{ d: PokemonDetail; formIdx: number } | null>(null)
const compareB = ref<{ d: PokemonDetail; formIdx: number } | null>(null)
const compareSearchEl = ref<HTMLInputElement | null>(null)
const comparePickerEl = ref<HTMLDivElement | null>(null)
const compareModalEl = ref<HTMLElement | null>(null)
const compareDrag = useModalDrag()
let compareTimer: number | undefined
let compareListSeq = 0

const COMPARE_STAT_KEYS = ['hp', 'attack', 'defense', 'sp_attack', 'sp_defense', 'speed'] as const

interface CompareEntry {
  name: string
  dexId: string
  image: string
  types: string[]
  stats: { key: string; label: string; value: number }[]
  total: number
  abilities: { name: string; hidden: boolean }[]
  height: string
  weight: string
  eggGroups: string[]
}

function buildCompareEntry(d: PokemonDetail, formIdx: number): CompareEntry {
  const f = d.forms[formIdx]
  const data = d.stats[formIdx]?.data || {}
  const stats = COMPARE_STAT_KEYS.map((k) => ({
    key: k,
    label: statLabels[k] || k,
    value: Number(data[k] ?? 0),
  }))
  return {
    name: d.name_zh,
    dexId: d.pokedex_id,
    image: f?.image ? imageUrl('official', f.image) : '',
    types: f?.types || [],
    stats,
    total: stats.reduce((s, st) => s + st.value, 0),
    abilities: (f?.abilities || []).map((a) => ({ name: a.name, hidden: a.is_hidden })),
    height: f?.height || '—',
    weight: f?.weight || '—',
    eggGroups: (f?.egg_groups || []).map(normalizeEggGroup),
  }
}

const compareEntryA = computed<CompareEntry | null>(() =>
  compareA.value ? buildCompareEntry(compareA.value.d, compareA.value.formIdx) : null
)
const compareEntryB = computed<CompareEntry | null>(() =>
  compareB.value ? buildCompareEntry(compareB.value.d, compareB.value.formIdx) : null
)

// 每个种族值条的最大刻度（两侧所有数值的 1.1 倍，避免贴满）
const compareStatMax = computed(() => {
  const all = [...(compareEntryA.value?.stats || []), ...(compareEntryB.value?.stats || [])].map(
    (s) => s.value
  )
  return Math.max(1, ...all) * 1.1
})

function compareWin(statKey: string): 'a' | 'b' | 'tie' {
  const a = compareEntryA.value?.stats.find((s) => s.key === statKey)?.value ?? 0
  const b = compareEntryB.value?.stats.find((s) => s.key === statKey)?.value ?? 0
  if (a === b) return 'tie'
  return a > b ? 'a' : 'b'
}

// A 的某属性攻击 B（依据 B 的相性表）；返回倍率或 null
function matchupDamage(defender: { d: PokemonDetail; formIdx: number }, atkType: string): number | null {
  const list = defender.d.type_effectiveness
  const entry = matchFormEntry(list, defender.d.forms[defender.formIdx]) || list[0]
  const hit = entry?.data?.find((e) => e.type === atkType)
  return hit ? Number(hit.damage) : null
}

function matchupLabel(v: number | null): string {
  if (v == null) return '—'
  if (v === 0) return '×0'
  if (v === 0.25) return '×¼'
  if (v === 0.5) return '×½'
  return `×${v}`
}

const matchupAToB = computed(() => {
  const a = compareEntryA.value
  const b = compareB.value
  if (!a || !b) return []
  return a.types.map((t) => ({ type: t, label: matchupLabel(matchupDamage(b, t)) }))
})

const matchupBToA = computed(() => {
  const a = compareA.value
  const b = compareEntryB.value
  if (!a || !b) return []
  return b.types.map((t) => ({ type: t, label: matchupLabel(matchupDamage(a, t)) }))
})

function aStatVal(key: string): number {
  return compareEntryA.value?.stats.find((s) => s.key === key)?.value ?? 0
}
function bStatVal(key: string): number {
  return compareEntryB.value?.stats.find((s) => s.key === key)?.value ?? 0
}
function aStatPct(key: string): string {
  return `${Math.min(100, (aStatVal(key) / compareStatMax.value) * 100)}%`
}
function bStatPct(key: string): string {
  return `${Math.min(100, (bStatVal(key) / compareStatMax.value) * 100)}%`
}
function cmpSideClass(win: 'a' | 'b' | 'tie', side: 'a' | 'b'): string {
  if (win === 'tie') return 'tie'
  return win === side ? 'win' : 'lose'
}
function totalSideClass(side: 'a' | 'b'): string {
  const a = compareEntryA.value?.total ?? 0
  const b = compareEntryB.value?.total ?? 0
  if (a === b) return 'tie'
  return side === 'a' ? (a > b ? 'win' : 'lose') : b > a ? 'win' : 'lose'
}
function cmpBg(entry: CompareEntry) {
  return {
    background: `linear-gradient(160deg, ${typeColor(entry.types[0] || '一般')}22, var(--surface-2))`,
  }
}

// 特性描述悬浮提示：用响应式 Map 存描述，悬浮即时触发加载
const compareAbilityDesc = reactive(new Map<string, string>())

function abilityTitle(name: string): string | undefined {
  return compareAbilityDesc.get(name) || undefined
}

function ensureAbilityDesc(name: string) {
  if (compareAbilityDesc.has(name)) return
  void fetchAbilityMeta(name).then((meta) => {
    if (meta?.description) compareAbilityDesc.set(name, meta.description)
  })
}

function prefetchCompareAbilities() {
  const names = new Set<string>()
  for (const e of [compareEntryA.value, compareEntryB.value]) {
    if (!e) continue
    for (const a of e.abilities) names.add(a.name)
  }
  for (const n of names) ensureAbilityDesc(n)
}

watch([compareEntryA, compareEntryB], prefetchCompareAbilities)

// ---- 右侧选择器列表（分页加载） ----
async function loadCompareList(append = false) {
  const page = append ? comparePokePage.value : 1
  const mySeq = ++compareListSeq
  if (append) comparePokeLoading.value = true
  try {
    const res = await listPokemon({
      search: compareSearch.value.trim() || undefined,
      page,
      pageSize: 48,
    })
    if (mySeq !== compareListSeq) return
    comparePokeList.value = append ? [...comparePokeList.value, ...res.items] : res.items
    comparePokePage.value = page + 1
    comparePokeHasMore.value = comparePokeList.value.length < res.total
  } catch {
    if (mySeq === compareListSeq) comparePokeList.value = []
  } finally {
    if (mySeq === compareListSeq) comparePokeLoading.value = false
  }
}

function openCompare() {
  compareOpen.value = true
  compareA.value = { d: detail.value!, formIdx: activeForm.value }
  compareB.value = null
  compareSearch.value = ''
  comparePokeList.value = []
  comparePokePage.value = 1
  comparePokeHasMore.value = true
  compareActiveIndex.value = -1
  compareError.value = ''
  loadCompareList(false)
}

function closeCompare() {
  compareOpen.value = false
  window.clearTimeout(compareTimer)
  if (compareModalEl.value) {
    const el = compareModalEl.value
    el.style.position = ''
    el.style.left = ''
    el.style.top = ''
    el.style.margin = ''
    el.style.maxWidth = ''
  }
}

function resetCompareB() {
  compareB.value = null
  compareSearch.value = ''
  comparePokeList.value = []
  comparePokePage.value = 1
  comparePokeHasMore.value = true
  compareActiveIndex.value = -1
  compareError.value = ''
  loadCompareList(false)
  compareSearchEl.value?.focus()
}

function onCompareInput() {
  compareActiveIndex.value = -1
  window.clearTimeout(compareTimer)
  compareTimer = window.setTimeout(() => loadCompareList(false), 250)
}

function onCompareScroll() {
  const el = comparePickerEl.value
  if (!el || comparePokeLoading.value || !comparePokeHasMore.value) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 80) {
    loadCompareList(true)
  }
}

async function pickCompare(id: string) {
  if (id === detail.value?._meta.id) {
    compareError.value = '不能与自身对比'
    return
  }
  compareLoading.value = true
  compareError.value = ''
  try {
    const d = await getPokemon(id)
    compareB.value = { d, formIdx: 0 }
    compareActiveIndex.value = -1
    prefetchCompareAbilities()
  } catch {
    compareError.value = '加载对比对象失败'
  } finally {
    compareLoading.value = false
  }
}

function scrollCompareActiveIntoView() {
  const el = comparePickerEl.value
  if (!el || compareActiveIndex.value < 0) return
  const item = el.querySelector(`[data-idx="${compareActiveIndex.value}"]`)
  item?.scrollIntoView({ block: 'nearest' })
}

function onCompareKeydown(e: KeyboardEvent) {
  if (e.isComposing) return
  if (e.key === 'Escape') {
    if (compareB.value) {
      resetCompareB()
    } else {
      closeCompare()
    }
    return
  }
  if (!comparePokeList.value.length) return
  const n = comparePokeList.value.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    compareActiveIndex.value = (compareActiveIndex.value + 1) % n
    scrollCompareActiveIntoView()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    compareActiveIndex.value = (compareActiveIndex.value - 1 + n) % n
    scrollCompareActiveIntoView()
  } else if (e.key === 'Enter') {
    const hit = comparePokeList.value[compareActiveIndex.value]
    if (hit) {
      e.preventDefault()
      pickCompare(hit.id)
    }
  }
}

function onCompareWindowKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && compareOpen.value) {
    // 弹窗内部 Esc 由 onCompareKeydown 处理，避免双重关闭
    if ((e.target as HTMLElement)?.closest?.('.compare-modal')) return
    closeCompare()
  }
}

// 弹窗打开时锁定背景滚动，避免内部滚动联动外部页面
watch(compareOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
  if (open) {
    window.addEventListener('keydown', onCompareWindowKeydown)
  } else {
    window.removeEventListener('keydown', onCompareWindowKeydown)
    window.clearTimeout(compareTimer)
  }
})


</script>

<template>
  <div v-if="error && !detail" class="error">{{ error }}</div>

  <div v-else-if="detail" class="detail">
    <div class="hero">
      <div class="hero-img" :style="{ background: heroBg() }">
        <SafeImage
          v-if="form()?.image"
          :src="imageUrl('official', form()!.image)"
          :alt="detail.name_zh"
        />
      </div>
      <div class="hero-info">
        <div class="hero-top">
          <div class="hero-id">No. {{ detail.pokedex_id }}</div>
          <button type="button" class="compare-btn" @click="openCompare">
            <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M8 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h3M16 3h3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-3M12 16l-4-4 4-4M8 12h8" />
            </svg>
            对比
          </button>
        </div>
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
      </div>
    </section>

    <section v-if="hasGallery" class="section">
      <div class="gallery-head">
        <h2>形态与异色</h2>
        <div class="gallery-tabs">
          <button :class="{ active: galleryTab === 'normal' }" @click="galleryTab = 'normal'">普通</button>
          <button :class="{ active: galleryTab === 'shiny' }" @click="galleryTab = 'shiny'">异色</button>
        </div>
      </div>
      <div class="gallery-grid">
        <div v-for="item in galleryItems" :key="item.key" class="gallery-item">
          <div class="gallery-label">{{ item.label }}</div>
          <div class="gallery-cell" :style="{ background: heroBg() }" @click="previewImg = galleryTab === 'shiny' && item.shinySrc ? item.shinySrc : item.src">
            <SafeImage v-if="galleryTab === 'shiny' && item.shinySrc" :src="item.shinySrc" :alt="`${item.label} 异色`" />
            <SafeImage v-else :src="item.src" :alt="item.label" />
          </div>
        </div>
      </div>
    </section>
    <Teleport to="body">
      <div v-if="previewImg" class="preview-overlay" @click.self="previewImg = null">
        <img :src="previewImg" class="preview-img" @click="previewImg = null" />
      </div>
    </Teleport>

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
                :fallback="evolutionImageFallback(node)"
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

    <section class="section">
      <h2>可学会招式</h2>
      <div class="gen-wrap">
        <button type="button" class="gen-select" @click.stop="genOpen = !genOpen">
          <span>第{{ moveGen }}世代</span>
          <svg
            class="gen-chevron"
            :class="{ open: genOpen }"
            viewBox="0 0 24 24"
            width="14"
            height="14"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
        <Transition name="genDrop">
          <div v-if="genOpen" class="gen-panel">
            <button
              v-for="g in genOptions"
              :key="g.value"
              type="button"
              class="gen-opt"
              :class="{ on: moveGen === g.value }"
              @click="pickGen(g.value)"
            >
              <span>{{ g.label }}</span>
              <svg
                v-if="moveGen === g.value"
                viewBox="0 0 24 24"
                width="14"
                height="14"
                fill="none"
                stroke="currentColor"
                stroke-width="2.5"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </button>
          </div>
        </Transition>
      </div>
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
        <button v-if="moveGen !== 9" :class="{ active: activeTab === 'tutor' }" @click="activeTab = 'tutor'">
          教授招式
        </button>
      </div>
      <div class="table-wrap" :class="{ 'is-machine': activeTab === 'machine' || activeTab === 'tutor' }">
        <table class="moves-table">
          <thead>
            <tr>
              <th v-if="activeTab === 'machine'">学习器</th>
              <th v-else-if="activeTab === 'tutor'">—</th>
              <th v-else-if="activeTab === 'egg'">亲本</th>
              <th v-else>等级</th>
              <th>名称</th>
              <th>属性</th>
              <th>分类</th>
              <th class="num">威力</th>
              <th class="num">命中</th>
              <th class="num">PP</th>
            </tr>
          </thead>
          <tbody>
            <template v-for="m in activeMoves" :key="m.name + m.level + m.machine">
              <tr>
                <td class="num">
                  <template v-if="activeTab === 'egg' && m.parents && m.parents.length">
                    <button
                      class="egg-toggle"
                      :class="{ open: eggOpen.has(m.name) }"
                      :title="eggOpen.has(m.name) ? '收起亲本列表' : '查看可遗传该招式的亲本'"
                      @click="toggleEggOpen(m.name)"
                    >
                      <span class="egg-toggle-count">亲本 {{ m.parents.length }}</span>
                      <svg class="egg-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>
                  </template>
                  <template v-else>{{ activeTab === 'tutor' ? '—' : (m.machine || m.level || '—') }}</template>
                </td>
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
              <tr
                v-if="activeTab === 'egg' && m.parents && m.parents.length && eggOpen.has(m.name)"
                class="egg-parent-row"
              >
                <td colspan="7" class="egg-parents">
                  <div class="ep-label">亲本</div>
                  <div class="ep-grid">
                    <template v-for="p in m.parents" :key="p.id ?? p.name">
                      <router-link v-if="p.type !== 'item'" :to="`/pokemon/${p.id}`" class="ep-chip">
                        <span class="ep-id">#{{ p.id }}</span>
                        <span class="ep-name">{{ p.name }}</span>
                      </router-link>
                      <span v-else class="ep-chip ep-item">
                        <span class="ep-name">{{ p.name }}</span>
                        <span v-if="p.desc" class="ep-item-desc">{{ p.desc }}</span>
                      </span>
                    </template>
                  </div>

                </td>
              </tr>
            </template>
            <tr v-if="activeMoves.length === 0">
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

    <section v-if="encounters.length" class="section">
      <h2>获得方式</h2>
      <div class="encounter-table-wrap">
        <table class="encounter-table">
          <thead>
            <tr>
              <th>世代</th>
              <th>版本</th>
              <th>地点</th>
              <th>方式</th>
              <th>备注</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(e, i) in encounters" :key="i">
              <td class="num">第{{ e.gen }}世代</td>
              <td>{{ e.gameName || e.game }}</td>
              <td>{{ e.location || '—' }}</td>
              <td>
                <span v-if="e.method" class="method-tag" :class="methodClass(e.method)">{{ e.method }}</span>
                <span v-else>—</span>
              </td>
              <td class="note-cell">{{ e.note || '—' }}</td>
            </tr>
          </tbody>
        </table>
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

  <div v-if="compareOpen" class="compare-backdrop" @click.self="closeCompare">
    <div ref="compareModalEl" class="compare-modal" role="dialog" aria-modal="true" aria-label="宝可梦对比">
      <div
        class="compare-head"
        @pointerdown="compareDrag.onDown($event, compareModalEl)"
        @pointermove="compareDrag.onMove($event, compareModalEl)"
        @pointerup="compareDrag.onUp"
        @pointercancel="compareDrag.onUp"
      >
        <span class="compare-title">对比宝可梦</span>
        <span v-if="compareEntryA" class="compare-sub">#{{ compareEntryA.dexId }} {{ compareEntryA.name }}</span>
        <button type="button" class="compare-close" aria-label="关闭" @click="closeCompare">✕</button>
      </div>

      <div class="compare-scroll">
        <div class="compare-body">
          <!-- 左侧：当前宝可梦 A -->
          <div v-if="compareEntryA" class="cmp-panel cmp-panel-a">
            <div class="cmp-card">
              <div class="cmp-img" :style="cmpBg(compareEntryA)">
                <SafeImage v-if="compareEntryA.image" :src="compareEntryA.image" :alt="compareEntryA.name" />
              </div>
              <div class="cmp-card-body">
                <div class="cmp-name">#{{ compareEntryA.dexId }} {{ compareEntryA.name }}</div>
                <div class="cmp-types">
                  <TypeBadge v-for="t in compareEntryA.types" :key="t" :type="t" size="sm" />
                </div>
                <div class="cmp-info">
                  <div class="ci-row">
                    <span class="ci-label">能力</span>
                    <span class="ci-chips">
                      <span
                        v-for="a in compareEntryA.abilities"
                        :key="a.name"
                        class="ci-chip"
                        :title="abilityTitle(a.name)"
                        @mouseenter="ensureAbilityDesc(a.name)"
                      >
                        {{ a.name }}<template v-if="a.hidden">·隐藏</template>
                      </span>
                    </span>
                  </div>
                  <div class="ci-row">
                    <span class="ci-label">蛋组</span>
                    <span class="ci-value">{{ compareEntryA.eggGroups.join('、') || '—' }}</span>
                  </div>
                  <div class="ci-row">
                    <span class="ci-label">身高 / 体重</span>
                    <span class="ci-value">{{ compareEntryA.height }} · {{ compareEntryA.weight }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧：选择器 或 已选宝可梦 B -->
          <div class="cmp-panel cmp-panel-b">
            <div v-if="!compareB" class="cmp-picker">
              <div class="cmp-picker-search">
                <input
                  ref="compareSearchEl"
                  v-model="compareSearch"
                  type="text"
                  placeholder="搜索宝可梦（编号 / 名称 / 英文名），↑↓ 选择、回车确认…"
                  @input="onCompareInput"
                  @keydown="onCompareKeydown"
                />
                <p v-if="compareError" class="compare-error">{{ compareError }}</p>
              </div>
              <div ref="comparePickerEl" class="cmp-picker-list" @scroll="onCompareScroll">
                <button
                  v-for="(p, i) in comparePokeList"
                  :key="p.id"
                  :data-idx="i"
                  type="button"
                  class="cmp-pick-item"
                  :class="{ active: i === compareActiveIndex }"
                  @mouseenter="compareActiveIndex = i"
                  @click="pickCompare(p.id)"
                >
                  <span class="cpi-img">
                    <SafeImage v-if="p.image" :src="imageUrl('official', p.image)" :alt="p.nameZh" />
                  </span>
                  <span class="cpi-id">#{{ p.id }}</span>
                  <span class="cpi-name">{{ p.nameZh }}</span>
                  <span class="cpi-types">
                    <span v-for="t in p.types" :key="t" class="cpi-type" :style="{ background: typeColor(t) }">{{ t }}</span>
                  </span>
                </button>
                <div v-if="comparePokeLoading" class="cmp-picker-state">加载中…</div>
                <div v-else-if="!comparePokeList.length" class="cmp-picker-state">没有匹配的宝可梦</div>
                <div v-else-if="!comparePokeHasMore" class="cmp-picker-state">已加载全部 {{ comparePokeList.length }} 只</div>
              </div>
            </div>

            <div v-else-if="compareEntryB" class="cmp-card">
              <div class="cmp-img" :style="cmpBg(compareEntryB)">
                <SafeImage v-if="compareEntryB.image" :src="compareEntryB.image" :alt="compareEntryB.name" />
              </div>
              <div class="cmp-card-body">
                <div class="cmp-name">#{{ compareEntryB.dexId }} {{ compareEntryB.name }}</div>
                <div class="cmp-types">
                  <TypeBadge v-for="t in compareEntryB.types" :key="t" :type="t" size="sm" />
                </div>
                <div class="cmp-info">
                  <div class="ci-row">
                    <span class="ci-label">能力</span>
                    <span class="ci-chips">
                      <span
                        v-for="a in compareEntryB.abilities"
                        :key="a.name"
                        class="ci-chip"
                        :title="abilityTitle(a.name)"
                        @mouseenter="ensureAbilityDesc(a.name)"
                      >
                        {{ a.name }}<template v-if="a.hidden">·隐藏</template>
                      </span>
                    </span>
                  </div>
                  <div class="ci-row">
                    <span class="ci-label">蛋组</span>
                    <span class="ci-value">{{ compareEntryB.eggGroups.join('、') || '—' }}</span>
                  </div>
                  <div class="ci-row">
                    <span class="ci-label">身高 / 体重</span>
                    <span class="ci-value">{{ compareEntryB.height }} · {{ compareEntryB.weight }}</span>
                  </div>
                </div>
                <button type="button" class="cmp-change" @click="resetCompareB">换一只</button>
              </div>
            </div>
          </div>
        </div>

        <p v-if="compareLoading && !compareB" class="compare-hint">加载中…</p>

        <!-- 对比结果区 -->
        <div v-if="compareEntryA && compareEntryB" class="compare-results-panel">
          <div class="cmp-section">
            <div class="cmp-section-title">种族值对比</div>
            <div class="stat-cmp">
              <div v-for="s in compareEntryA.stats" :key="s.key" class="stat-cmp-row">
                <span class="sc-label">{{ s.label }}</span>
                <div class="sc-side sc-a">
                  <b class="sc-val" :class="cmpSideClass(compareWin(s.key), 'a')">{{ aStatVal(s.key) }}</b>
                  <div class="sc-track">
                    <div class="sc-fill" :class="cmpSideClass(compareWin(s.key), 'a')" :style="{ width: aStatPct(s.key) }" />
                  </div>
                </div>
                <div class="sc-side sc-b">
                  <div class="sc-track">
                    <div class="sc-fill" :class="cmpSideClass(compareWin(s.key), 'b')" :style="{ width: bStatPct(s.key) }" />
                  </div>
                  <b class="sc-val" :class="cmpSideClass(compareWin(s.key), 'b')">{{ bStatVal(s.key) }}</b>
                </div>
              </div>
              <div class="stat-cmp-row sc-total">
                <span class="sc-label">总和</span>
                <b class="sc-val" :class="totalSideClass('a')">{{ compareEntryA.total }}</b>
                <b class="sc-val" :class="totalSideClass('b')">{{ compareEntryB.total }}</b>
              </div>
            </div>
          </div>

          <div class="cmp-section">
            <div class="cmp-section-title">属性相性</div>
            <div class="cmp-section-title sub">{{ compareEntryA.name }} 攻击 {{ compareEntryB.name }}</div>
            <div class="matchup">
              <span v-for="m in matchupAToB" :key="m.type" class="mu-chip">
                <span class="mu-type" :style="{ background: typeColor(m.type) }">{{ m.type }}</span>
                <span class="mu-val">{{ m.label }}</span>
              </span>
            </div>
            <div class="cmp-section-title sub">{{ compareEntryB.name }} 攻击 {{ compareEntryA.name }}</div>
            <div class="matchup">
              <span v-for="m in matchupBToA" :key="m.type" class="mu-chip">
                <span class="mu-type" :style="{ background: typeColor(m.type) }">{{ m.type }}</span>
                <span class="mu-val">{{ m.label }}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.error {
  text-align: center;
  color: var(--text-3);
  padding: 60px 0;
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
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 8px;
}
.gallery-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.gallery-head h2 {
  margin: 0;
}
.gallery-tabs {
  display: flex;
  gap: 4px;
  margin-left: auto;
  background: var(--surface-3);
  border-radius: 8px;
  padding: 2px;
}
.gallery-tabs button {
  border: none;
  background: transparent;
  color: var(--text-3);
  font-size: 12px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.gallery-tabs button.active {
  background: var(--surface);
  color: var(--accent);
}
.gallery-item {
  background: var(--surface-2);
  border: 1px solid var(--border-faint);
  border-radius: 14px;
  overflow: hidden;
}
.gallery-label {
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: var(--text);
  padding: 6px;
  border-bottom: 1px solid var(--border-faint);
}
.gallery-cell {
  position: relative;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.gallery-cell :deep(img) {
  max-width: 82%;
  max-height: 82%;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.12));
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
  background: var(--hover-bg);
  color: var(--text);
}
.seg button.active {
  background: var(--accent);
  color: var(--on-accent);
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
  color: var(--gender-f);
}
.gender-label.g-m {
  color: var(--gender-m);
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
  background: var(--gender-f);
  transition: width 0.3s;
}
.gender-m {
  background: var(--gender-m);
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
  color: var(--on-accent);
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
  border-left: 4px solid var(--border);
}
.eff-group-label.eff-weak4 {
  border-color: var(--eff-weak4-text);
  color: var(--eff-weak4-text);
}
.eff-group-label.eff-weak2 {
  border-color: var(--eff-weak2-text);
  color: var(--eff-weak2-text);
}
.eff-group-label.eff-resist {
  border-color: var(--eff-resist-text);
  color: var(--eff-resist-text);
}
.eff-group-label.eff-immune {
  border-color: var(--eff-immune-text);
  color: var(--eff-immune-text);
}
.eff-group-label.eff-normal {
  border-color: var(--border);
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
  gap: 4px;
  padding: 4px 8px;
  border-radius: 12px;
  background: var(--surface-2);
  border: 1px solid transparent;
  overflow: hidden;
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
  color: var(--on-accent);
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 14px;
  line-height: 1.5;
  white-space: nowrap;
}
.eff-val {
  font-size: 11px;
  font-weight: 700;
  color: var(--text-2);
  white-space: nowrap;
  flex-shrink: 0;
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
.gen-wrap {
  position: relative;
  display: flex;
  justify-content: flex-end;
  margin-bottom: 14px;
}
.gen-select {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  background: var(--surface);
  color: var(--text-2);
  font-size: 13px;
  outline: none;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s, box-shadow 0.15s;
}
.gen-select:hover,
.gen-select:focus-visible {
  border-color: var(--border);
  color: var(--text);
}
.gen-select:focus-visible {
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.gen-chevron {
  transition: transform 0.18s ease;
  color: var(--text-faint);
}
.gen-select:hover .gen-chevron,
.gen-chevron.open {
  color: var(--accent);
}
.gen-chevron.open {
  transform: rotate(180deg);
}
.gen-panel {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 150px;
  padding: 4px;
  background: var(--drop-bg);
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  box-shadow: var(--shadow-hover);
  z-index: 15;
  transform-origin: top right;
}
.gen-opt {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 12px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.gen-opt:hover {
  background: var(--drop-hover);
  color: var(--text);
}
.gen-opt.on {
  color: var(--accent);
  font-weight: 600;
}
.genDrop-enter-active {
  transition: opacity 0.16s ease, transform 0.16s ease;
}
.genDrop-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}
.genDrop-enter-from,
.genDrop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.97);
}

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
.moves-table .egg-parent-row {
  background: none;
}
.moves-table .egg-parent-row:hover {
  background: none;
}
.egg-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid var(--border-soft);
  background: var(--surface-2);
  color: var(--text-2);
  border-radius: 999px;
  font-size: 12px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;
}
.egg-toggle:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.egg-toggle.open {
  color: var(--accent);
  background: var(--accent-soft);
}
.egg-chevron {
  transition: transform 0.18s;
}
.egg-toggle.open .egg-chevron {
  transform: rotate(180deg);
}
.moves-table .egg-parents {
  font-size: 12px;
  color: var(--text-faint);
  padding: 8px 8px 8px;
  border-top: none;
  white-space: normal;
}
.ep-label {
  margin-bottom: 6px;
  color: var(--text-3);
  font-weight: 600;
  font-size: 11px;
}
.ep-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.ep-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: var(--surface);
  border: 1px solid var(--border-soft);
  border-radius: 8px;
  font-size: 12px;
  color: var(--text-2);
  text-decoration: none;
  transition: all 0.15s;
}
.ep-chip:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.ep-id {
  color: var(--text-3);
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.ep-name {
  color: var(--text-2);
}
.ep-item {
  border-style: dashed;
  opacity: 0.8;
  flex-wrap: wrap;
}
.ep-item-desc {
  width: 100%;
  font-size: 11px;
  color: var(--text-3);
  line-height: 1.5;
  margin-top: 2px;
}
.moves-table .empty {
  text-align: center;
  color: var(--text-3);
  padding: 24px;
}
.type-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--on-accent);
  font-size: 12px;
  font-weight: 500;
  padding: 3px 10px 3px 4px;
  border-radius: 20px;
  line-height: 1;
}

.encounter-table-wrap {
  overflow: auto;
  max-height: 400px;
  border: 1px solid var(--border-faint);
  border-radius: 12px;
}
.encounter-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}
.encounter-table thead th {
  position: sticky;
  top: 0;
  background: var(--table-head-bg);
  z-index: 1;
}
.encounter-table th,
.encounter-table td {
  padding: 8px 12px;
  border-bottom: 1px solid var(--border-faint);
  text-align: left;
  white-space: nowrap;
}
.encounter-table th {
  color: var(--text-3);
  font-weight: 600;
  font-size: 12px;
}
.encounter-table td.num {
  text-align: center;
  color: var(--text-3);
}
.encounter-table tbody tr:hover {
  background: var(--hover-bg);
}
.encounter-table .note-cell {
  white-space: normal;
  max-width: 200px;
  font-size: 12px;
  color: var(--text-3);
}
.method-tag {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
}
.method-tag.wild {
  background: var(--method-green-bg);
  color: var(--method-green);
}
.method-tag.trade {
  background: var(--method-blue-bg);
  color: var(--method-blue);
}
.method-tag.raid {
  background: var(--method-pink-bg);
  color: var(--method-pink);
}
.method-tag.radar {
  background: var(--method-orange-bg);
  color: var(--method-orange);
}
.method-tag.overworld {
  background: var(--method-purple-bg);
  color: var(--method-purple);
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
  border-color: var(--border);
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
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    gap: 6px;
  }
  .eff-type {
    font-size: 11px;
    padding: 1px 6px;
    gap: 4px;
  }
  .eff-val {
    font-size: 12px;
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
    overflow: auto;
    border: none;
    -webkit-overflow-scrolling: touch;
  }
  .moves-table {
    font-size: 12px;
    min-width: 580px;
  }
  .moves-table th,
  .moves-table td {
    padding: 7px 8px;
  }
  .moves-table th {
    font-size: 11px;
  }
  .moves-table tbody tr:hover {
    background: var(--surface-2);
  }
  .egg-toggle {
    padding: 2px 6px;
    font-size: 11px;
  }
  .moves-table .egg-parents {
    padding: 6px 8px;
  }
  .ep-grid {
    gap: 4px;
  }
  .ep-chip {
    padding: 3px 8px;
    font-size: 11px;
    gap: 3px;
  }
  .ep-id {
    font-size: 10px;
  }
  .encounter-table-wrap {
    max-height: none;
    overflow: visible;
    border: none;
  }
  .encounter-table,
  .encounter-table tbody {
    display: block;
    width: 100%;
    min-width: 0;
  }
  .encounter-table thead {
    display: none;
  }
  .encounter-table tr {
    display: grid;
    grid-template-areas:
      'game method'
      'loc  loc'
      'note note';
    grid-template-columns: 1fr auto;
    gap: 4px 8px;
    padding: 10px;
    margin-bottom: 8px;
    background: var(--surface-2);
    border: 1px solid var(--border-faint);
    border-radius: 10px;
    min-width: 0;
  }
  .encounter-table td {
    display: block;
    border: none;
    padding: 0;
    word-break: break-word;
    overflow-wrap: break-word;
    min-width: 0;
    overflow: hidden;
  }
  .encounter-table td:nth-child(1) {
    display: none;
  }
  .encounter-table td:nth-child(2) {
    grid-area: game;
    font-weight: 600;
    font-size: 13px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .encounter-table td:nth-child(3) {
    grid-area: loc;
    font-size: 12px;
    color: var(--text-2);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .encounter-table td:nth-child(4) {
    grid-area: method;
    text-align: right;
    justify-self: end;
  }
  .encounter-table td:nth-child(5) {
    grid-area: note;
    font-size: 12px;
    color: var(--text-3);
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }
}
.preview-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0, 0, 0, 0.72);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: zoom-out;
}
.preview-overlay img {
  max-width: 85vw;
  max-height: 85vh;
  object-fit: contain;
}
.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.compare-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 16px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  flex-shrink: 0;
}
.compare-btn:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.compare-backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: var(--overlay);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 7vh 16px 16px;
}
.compare-modal {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 16px;
  width: min(96vw, 960px);
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}
.compare-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-faint);
}
@media (min-width: 769px) {
  .compare-head {
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
}
.compare-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--text);
}
.compare-sub {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.compare-close {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 16px;
  padding: 4px 8px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.15s;
}
.compare-close:hover {
  background: var(--hover-bg);
  color: var(--text);
}
.compare-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 18px 18px;
}
.compare-body {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 18px;
  align-items: start;
}
.cmp-panel {
  min-width: 0;
}
.cmp-card {
  border: 1px solid var(--border-soft);
  border-radius: 14px;
  padding: 16px;
  background: var(--surface-2);
  text-align: center;
}
.cmp-img {
  height: 140px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}
.cmp-img img {
  max-width: 120px;
  max-height: 120px;
}
.cmp-name {
  font-size: 16px;
  font-weight: 700;
  margin-top: 10px;
  color: var(--text);
  word-break: break-all;
}
.cmp-types {
  display: flex;
  justify-content: center;
  gap: 5px;
  margin-top: 8px;
}
.cmp-card-body {
  min-width: 0;
}
.cmp-info {
  margin-top: 14px;
  text-align: left;
  border-top: 1px dashed var(--border-faint);
  padding-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ci-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
  font-size: 13px;
}
.ci-label {
  flex-shrink: 0;
  min-width: 56px;
  color: var(--text-3);
  font-size: 12px;
  font-weight: 600;
}
.ci-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}
.ci-chip {
  padding: 2px 9px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 12px;
  cursor: help;
  transition: border-color 0.15s, color 0.15s;
}
.ci-chip:hover {
  color: var(--accent);
  border-color: var(--accent-soft);
}
.ci-value {
  color: var(--text-2);
}
.cmp-change {
  margin-top: 12px;
  padding: 6px 18px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  color: var(--text-2);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.cmp-change:hover {
  border-color: var(--accent);
  color: var(--accent);
  background: var(--accent-soft);
}
.cmp-section {
  margin-top: 18px;
  border-top: 1px dashed var(--border-faint);
  padding-top: 14px;
}
.cmp-section-title {
  font-size: 12px;
  font-weight: 700;
  color: var(--text-3);
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}
.cmp-section-title.sub {
  margin-top: 12px;
}
/* 右侧选择器 */
.cmp-picker {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 320px;
}
.cmp-picker-search input {
  width: 100%;
  padding: 10px 14px;
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--input-bg);
  color: var(--text);
  font-size: 14px;
  outline: none;
}
.cmp-picker-search input:focus {
  border-color: var(--text-faint);
  box-shadow: 0 0 0 3px var(--accent-soft);
}
.cmp-picker-list {
  margin-top: 10px;
  flex: 1;
  max-height: 46vh;
  overflow-y: auto;
  border: 1px solid var(--border-soft);
  border-radius: 12px;
  background: var(--drop-bg);
}
.cmp-pick-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 7px 12px;
  border: none;
  background: transparent;
  color: var(--text-2);
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background 0.12s;
}
.cmp-pick-item:hover,
.cmp-pick-item.active {
  background: var(--drop-hover);
  color: var(--text);
}
.cpi-img {
  width: 36px;
  height: 36px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-3);
  border-radius: 8px;
}
.cpi-img img {
  max-width: 30px;
  max-height: 30px;
}
.cpi-id {
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 600;
  flex-shrink: 0;
}
.cpi-name {
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.cpi-types {
  margin-left: auto;
  display: flex;
  gap: 3px;
  flex-shrink: 0;
}
.cpi-type {
  color: #fff;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
}
.cmp-picker-state {
  padding: 16px;
  text-align: center;
  color: var(--text-faint);
  font-size: 13px;
}
.compare-error {
  margin-top: 8px;
  color: var(--danger);
  font-size: 13px;
}
.compare-hint {
  margin-top: 8px;
  color: var(--text-faint);
  font-size: 13px;
}
.stat-cmp {
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.stat-cmp-row {
  display: grid;
  grid-template-columns: 44px 1fr 1fr;
  align-items: center;
  gap: 10px;
}
.sc-label {
  font-size: 12px;
  color: var(--text-3);
  font-weight: 600;
}
.sc-side {
  display: flex;
  align-items: center;
  gap: 8px;
}
.sc-a {
  flex-direction: row-reverse;
}
.sc-val {
  font-size: 13px;
  min-width: 30px;
  text-align: center;
  color: var(--text-2);
  font-weight: 600;
}
.sc-val.win {
  color: var(--accent);
  font-weight: 800;
}
.sc-val.lose {
  color: var(--text-faint);
  font-weight: 400;
}
.sc-val.tie {
  color: var(--text-3);
}
.sc-track {
  flex: 1;
  height: 10px;
  border-radius: 999px;
  background: var(--surface-3);
  overflow: hidden;
}
.sc-fill {
  height: 100%;
  border-radius: 999px;
  background: var(--text-faint);
  opacity: 0.45;
  transition: width 0.2s ease;
}
.sc-fill.win {
  background: var(--accent);
  opacity: 1;
}
.sc-fill.tie {
  background: var(--text-3);
  opacity: 0.5;
}
.sc-total {
  border-top: 1px solid var(--border-faint);
  padding-top: 7px;
}
.matchup {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.mu-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px 3px 3px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  font-size: 12px;
}
.mu-type {
  color: #fff;
  padding: 2px 9px;
  border-radius: 999px;
  font-weight: 600;
}
.mu-val {
  color: var(--text-2);
  font-weight: 700;
}
@media (max-width: 640px) {
  .compare-backdrop {
    padding: 0;
    align-items: flex-start;
  }
  .compare-modal {
    width: 100vw;
    max-height: 96vh;
    border-radius: 0 0 16px 16px;
  }
  .compare-head {
    padding: 12px 14px;
  }
  .compare-scroll {
    padding: 12px 14px 20px;
  }
  .compare-body {
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .cmp-card {
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    padding: 12px;
  }
  .cmp-img {
    width: 84px;
    height: 84px;
    flex-shrink: 0;
  }
  .cmp-img img {
    max-width: 72px;
    max-height: 72px;
  }
  .cmp-card-body {
    flex: 1;
  }
  .cmp-name {
    margin-top: 0;
    font-size: 15px;
  }
  .cmp-types {
    justify-content: flex-start;
    margin-top: 5px;
  }
  .cmp-info {
    margin-top: 8px;
    border-top: none;
    padding-top: 0;
    gap: 4px;
  }
  .ci-row {
    font-size: 12px;
    flex-wrap: wrap;
    gap: 4px 8px;
  }
  .ci-label {
    min-width: 46px;
  }
  .ci-chip {
    font-size: 11px;
    padding: 1px 7px;
  }
  .cmp-change {
    margin-top: 8px;
    padding: 5px 14px;
  }
  .cmp-picker {
    min-height: 320px;
  }
  .cmp-picker-list {
    max-height: 46vh;
  }
  .cmp-pick-item {
    padding: 8px 10px;
  }
  .stat-cmp-row {
    grid-template-columns: 40px 1fr 1fr;
    gap: 6px;
  }
  .sc-val {
    min-width: 26px;
    font-size: 12px;
  }
  .mu-chip {
    font-size: 11px;
  }
}
</style>