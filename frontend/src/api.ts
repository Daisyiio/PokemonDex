import type {
  PokemonDetail,
  PokemonListResponse,
  BreedingSpecies,
  BreedingMovesResponse,
  BreedingPlan,
  BreedingResult,
  GeneticsBrief,
  GeneticsEggMovesResponse,
  GeneticsPlan,
} from './types'

const BASE = '/api'

async function get<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.json() as Promise<T>
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    let msg = `HTTP ${res.status}: ${url}`
    try {
      const data = await res.json()
      if (data?.message) msg = typeof data.message === 'string' ? data.message : msg
    } catch {
      /* ignore */
    }
    throw new Error(msg)
  }
  return res.json() as Promise<T>
}

export interface ListParams {
  search?: string
  type?: string
  gen?: number
  page?: number
  pageSize?: number
}

export function listPokemon(params: ListParams): Promise<PokemonListResponse> {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  if (params.type) q.set('type', params.type)
  if (params.gen) q.set('gen', String(params.gen))
  q.set('page', String(params.page ?? 1))
  q.set('pageSize', String(params.pageSize ?? 24))
  return get<PokemonListResponse>(`${BASE}/pokemon?${q.toString()}`)
}

export function getPokemon(id: string): Promise<PokemonDetail> {
  return get<PokemonDetail>(`${BASE}/pokemon/${id}`)
}

export async function listTypes(): Promise<{ name: string; count: number }[]> {
  return get<{ name: string; count: number }[]>(`${BASE}/pokemon/types`)
}

export interface PokemonNavItem {
  id: string
  nameZh: string
}

export function listPokemonIds(): Promise<PokemonNavItem[]> {
  return get<PokemonNavItem[]>(`${BASE}/pokemon/ids`)
}

export interface EggGroupMember {
  id: string
  nameZh: string
  nameEn?: string | null
  image: string | null
  types: string[]
}

export interface EggGroup {
  name: string
  count: number
  members: EggGroupMember[]
}

export function listEggGroups(): Promise<EggGroup[]> {
  return get<EggGroup[]>(`${BASE}/pokemon/egg-groups`)
}

export interface AbilityInfo {
  id: string
  nameZh: string
  nameEn?: string | null
  nameJa?: string | null
  description?: string | null
  commonCount?: number | null
  hiddenCount?: number | null
  generation?: number | null
}

export interface MoveListItem {
  id: string
  nameZh: string
  nameJa?: string | null
  nameEn?: string | null
  type?: string | null
  category?: string | null
  power?: string | null
  accuracy?: string | null
  pp?: string | null
  description?: string | null
  generation?: number | null
  machines?: string[]
}

export interface ItemListItem {
  id: number
  nameZh: string
  nameJa?: string | null
  nameEn?: string | null
  type?: string | null
  category?: string | null
  description?: string | null
  icon?: string | null
}

export interface ListResponse<T> {
  total: number
  page: number
  pageSize: number
  items: T[]
}

export interface AbilityLearner {
  id: string
  nameZh: string
  image: string | null
  methods: string[]
}

export interface AbilityDetail extends AbilityInfo {
  learners: AbilityLearner[]
}

export function getAbility(id: string): Promise<AbilityDetail> {
  return get<AbilityDetail>(`${BASE}/abilities/${id}`)
}

export function listAbilities(params: {
  search?: string
  page?: number
  pageSize?: number
}): Promise<ListResponse<AbilityInfo>> {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  q.set('page', String(params.page ?? 1))
  q.set('pageSize', String(params.pageSize ?? 50))
  return get<ListResponse<AbilityInfo>>(`${BASE}/abilities?${q.toString()}`)
}

export interface MoveLearner {
  id: string
  nameZh: string
  image: string | null
  methods: string[]
}

export interface MoveDetail extends MoveListItem {
  machines: string[]
  learners: MoveLearner[]
}

export function getMove(id: string): Promise<MoveDetail> {
  return get<MoveDetail>(`${BASE}/moves/${id}`)
}

export function listMoves(params: {
  search?: string
  type?: string
  category?: string
  page?: number
  pageSize?: number
}): Promise<ListResponse<MoveListItem>> {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  if (params.type) q.set('type', params.type)
  if (params.category) q.set('category', params.category)
  q.set('page', String(params.page ?? 1))
  q.set('pageSize', String(params.pageSize ?? 50))
  return get<ListResponse<MoveListItem>>(`${BASE}/moves?${q.toString()}`)
}

export function listItems(params: {
  search?: string
  category?: string
  page?: number
  pageSize?: number
}): Promise<ListResponse<ItemListItem>> {
  const q = new URLSearchParams()
  if (params.search) q.set('search', params.search)
  if (params.category) q.set('category', params.category)
  q.set('page', String(params.page ?? 1))
  q.set('pageSize', String(params.pageSize ?? 50))
  return get<ListResponse<ItemListItem>>(`${BASE}/items?${q.toString()}`)
}

export function listItemCategories(): Promise<{ id: number; nameZh: string }[]> {
  return get<{ id: number; nameZh: string }[]>(`${BASE}/items/categories`)
}

export function listBreedingSpecies(): Promise<BreedingSpecies[]> {
  return get<BreedingSpecies[]>(`${BASE}/breeding/species`)
}

export function getBreedingMoves(id: string): Promise<BreedingMovesResponse> {
  return get<BreedingMovesResponse>(`${BASE}/breeding/species/${id}/moves`)
}

export function postBreedingPlan(body: {
  targetId: string
  moves: string[]
}): Promise<BreedingPlan> {
  return post<BreedingPlan>(`${BASE}/breeding/plan`, body)
}

export function postBreedingSimulate(body: {
  targetId: string
  moves: string[]
  motherId: string
  fatherId: string
  everstone?: boolean
  destinyKnot?: boolean
  motherNature?: string
  fatherNature?: string
}): Promise<BreedingResult> {
  return post<BreedingResult>(`${BASE}/breeding/simulate`, body)
}

export { get }

export function listGeneticsSpecies(): Promise<GeneticsBrief[]> {
  return get<GeneticsBrief[]>(`${BASE}/genetics/species`)
}

export function getGeneticsEggMoves(id: string, gen?: number): Promise<GeneticsEggMovesResponse> {
  const q = gen ? `?gen=${gen}` : ''
  return get<GeneticsEggMovesResponse>(`${BASE}/genetics/species/${id}/egg-moves${q}`)
}

export function postGeneticsPlan(body: {
  targetId: string
  moves: string[]
  generation: number
}): Promise<GeneticsPlan> {
  return post<GeneticsPlan>(`${BASE}/genetics/plan`, body)
}

export interface MovesByGenResponse {
  generation: number
  learnable: { name: string; level: string; type: string; category: string; power: string; accuracy: string; pp: string }[]
  machine: { name: string; tm: string; type: string; category: string; power: string; accuracy: string; pp: string }[]
  egg: { name: string; type: string; category: string; power: string; accuracy: string; pp: string; parents: { id: string | null; name: string }[] }[]
  tutor: { name: string; type: string; category: string; power: string; accuracy: string; pp: string }[]
}

export function getMovesByGen(id: string, gen: number): Promise<MovesByGenResponse> {
  return get<MovesByGenResponse>(`${BASE}/genetics/species/${id}/all-moves?gen=${gen}`)
}