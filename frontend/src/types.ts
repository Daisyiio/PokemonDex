export interface PokemonSummary {
  id: string
  nameZh: string
  nameEn: string | null
  types: string[]
  gen: number | null
  image: string | null
}

export interface PokemonListResponse {
  total: number
  page: number
  pageSize: number
  items: PokemonSummary[]
}

export interface TypeEffectivenessEntry {
  type: string
  damage: string
}

export interface PokedexEntry {
  name: string
  versions: { name: string; group: string; text: string }[]
}

export interface MoveEntry {
  level?: string
  machine?: string
  name: string
  type: string
  category: string
  power: string
  accuracy: string
  pp: string
  parents?: { id: string; name: string }[]
}

export interface Form {
  name: string
  types: string[]
  category: string
  abilities: { name: string; is_hidden: boolean }[]
  height: string
  weight: string
  color: string
  catch_rate: string
  egg_groups: string[]
  experience_100: string
  base_points: { stat: string; value: number }[]
  base_exp: string
  battle_exp: string
  gender_ratio: { male: number; female: number }
  egg_cycles: string
  shape: string
  footprint: string
  image: string
}

export interface EvolutionNode {
  name: string
  stage: string
  text: string | null
  image: string | null
  back_text: string | null
  from: string | null
  form_name: string | null
}

export interface FormVariant {
  name: string
  form_name: string
  image: string
}

export interface NameOrigin {
  language: string
  name: string
  origin: string
}

export interface PokemonDetail {
  name_zh: string
  name_ja: string
  name_en: string
  pokedex_id: string
  description: string
  profile: string
  prototype: string
  detail: string
  names: NameOrigin[]
  forms: Form[]
  stats: { form: string; data: Record<string, string> }[]
  type_effectiveness: { form: string; types: string[]; data: TypeEffectivenessEntry[] }[]
  pokedex_entries: PokedexEntry[]
  evolution_chains: EvolutionNode[][]
  mega_evolution: FormVariant[]
  gigantamax_evolution: FormVariant[]
  learnable_moves: { form: string; data: MoveEntry[] }[]
  machine_moves: { form: string; data: MoveEntry[] }[]
  egg_moves: { form: string; data: MoveEntry[] }[]
  home_images: { name: string; image: string; shiny: string }[]
  _meta: { id: string; gen: number | null; filter: string | null; icon: string | null; image: string | null }
}

export interface TypeInfo {
  name: string
  color: string
  bg: string
}

export const TYPE_COLORS: Record<string, string> = {
  一般: '#9fa19f',
  格斗: '#ff8000',
  飞行: '#81b9ef',
  毒: '#9141cb',
  地面: '#915121',
  岩石: '#afa981',
  虫: '#91a119',
  幽灵: '#704170',
  钢: '#60a1b8',
  火: '#e62829',
  水: '#2980ef',
  草: '#3fa129',
  电: '#fac000',
  超能力: '#ef4179',
  冰: '#3fd8ff',
  龙: '#5060e1',
  恶: '#50413f',
  妖精: '#ef70ef',
}

export function typeColor(type: string): string {
  return TYPE_COLORS[type] || '#999'
}

export const CATEGORY_COLORS: Record<string, string> = {
  物理: '#e04e39',
  特殊: '#58a6e0',
  变化: '#9aa0a6',
}

export function categoryColor(category: string): string {
  return CATEGORY_COLORS[category] || '#999'
}

export function imageUrl(subdir: string, name: string): string {
  return `/images/${subdir}/${encodeURIComponent(name)}`
}

export function normalizeEggGroup(raw: string): string {
  let name = raw.trim()
  if (name.endsWith('群')) name = name.slice(0, -1)
  if (name === '未知蛋') name = '未知'
  return name
}

export interface BreedingBrief {
  id: string
  nameZh: string
  nameEn: string | null
  image: string | null
  types: string[]
  eggGroups: string[]
  genderRatio: { male: number; female: number }
  eggCycles: string
  steps: number | null
}

export interface BreedingSpecies extends BreedingBrief {
  breedable: boolean
  isBaseForm: boolean
  lineIds: string[]
}

export interface BreedingEggMove {
  name: string
  type: string
  category: string
  power: string
  parents: { id: string | null; name: string }[]
}

export interface BreedingMovesResponse {
  target: BreedingBrief
  eggGroups: string[]
  breedable: boolean
  learnable: { name: string; level: string; type: string; category: string; power: string }[]
  machine: { name: string; type: string; category: string; power: string }[]
  egg: BreedingEggMove[]
}

export interface BreedingPlan {
  target: BreedingBrief
  line: BreedingBrief[]
  selfMoveNames: string[]
  requiredEgg: { name: string; parents: { id: string | null; name: string }[] }[]
  infeasible: string[]
  mother: { candidates: BreedingBrief[]; requirement: string; allowsDitto: boolean }
  father: { candidates: BreedingBrief[]; requirement: string; allowsDitto: boolean }
}

export interface BreedingResult {
  child: BreedingBrief
  gender: string
  nature: { name: string; raised: string | null; lowered: string | null }
  ability: { name: string; isHidden: boolean }
  ivs: { stat: string; key: string; value: number; source: string }[]
  stats: { stat: string; key: string; base: number; value: number }[]
  moves: { name: string; method: string; ok: boolean }[]
  shiny: boolean
  steps: number | null
  eggCycles: string
  mother: BreedingBrief
  father: BreedingBrief
}

export interface GeneticsBrief {
  id: string
  nameZh: string
  nameEn: string | null
  image: string | null
  types: string[]
  eggGroups: string[]
  genderRatio: { male: number; female: number }
  learnLevel?: string
}

export interface GeneticsEggMove {
  name: string
  type: string
  category: string
  power: string
  parents: { id: string | null; name: string }[]
}

export interface GeneticsEggMovesResponse {
  target: GeneticsBrief
  eggGroups: string[]
  breedable: boolean
  genderRatio: { male: number; female: number }
  eggMoves: GeneticsEggMove[]
}

export interface GeneticsSolution {
  type: 'direct' | 'chain'
  stepCount: number
  candidates?: GeneticsBrief[]
  sharedEggGroup?: string
  steps: {
    father: GeneticsBrief
    mother: GeneticsBrief
    offspring: GeneticsBrief
    sharedEggGroup: string
    note: string
  }[]
  sharedEggGroups?: string[]
}

export interface GeneticsMoveResult {
  move: string
  valid: boolean
  reason?: string
  solutions?: GeneticsSolution[]
}

export interface GeneticsPlan {
  target: GeneticsBrief
  generation: number
  specialNote?: string
  moveResults: GeneticsMoveResult[]
  combinedDirect?: {
    father: GeneticsBrief
    candidates: GeneticsBrief[]
    sharedEggGroup: string
    moves: string[]
    learnInfo?: { move: string; level: string }[]
  }
  unifiedPlan?: {
    type: string
    totalSteps?: number
    steps: {
      phase: string
      move?: string
      father: GeneticsBrief
      mother: GeneticsBrief
      offspring: GeneticsBrief
      sharedEggGroup: string
      learnLevel?: string
      note: string
    }[]
    impossibleMoves?: { move: string; reason: string }[]
    knownMoves?: string[]
    note?: string
  }
}