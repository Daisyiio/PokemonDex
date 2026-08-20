import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface SpeciesInfo {
  id: string;
  nameZh: string;
  nameEn: string | null;
  image: string | null;
  types: string[];
  eggGroups: string[];
  genderRatio: { male: number; female: number };
  eggCycles: string;
  steps: number | null;
  breedable: boolean;
  isBaseForm: boolean;
  lineIds: string[];
}

interface EggMoveDef {
  type: string;
  category: string;
  power: string;
  parents: { id: string | null; name: string }[];
}

export interface ParentRef {
  id: string | null;
  name: string;
}

const STAT_KEYS = ['hp', 'attack', 'defense', 'sp_attack', 'sp_defense', 'speed'] as const;
const STAT_ZH: Record<string, string> = {
  hp: 'HP',
  attack: '攻击',
  defense: '防御',
  sp_attack: '特攻',
  sp_defense: '特防',
  speed: '速度',
};

const NATURES: { name: string; raised: string | null; lowered: string | null }[] = [
  { name: '勤奋', raised: null, lowered: null },
  { name: '坦率', raised: null, lowered: null },
  { name: '害羞', raised: null, lowered: null },
  { name: '认真', raised: null, lowered: null },
  { name: '浮躁', raised: null, lowered: null },
  { name: '孤僻', raised: 'attack', lowered: 'defense' },
  { name: '固执', raised: 'attack', lowered: 'sp_attack' },
  { name: '顽皮', raised: 'attack', lowered: 'speed' },
  { name: '勇敢', raised: 'attack', lowered: 'sp_defense' },
  { name: '大胆', raised: 'defense', lowered: 'attack' },
  { name: '淘气', raised: 'defense', lowered: 'sp_attack' },
  { name: '悠闲', raised: 'defense', lowered: 'speed' },
  { name: '乐天', raised: 'defense', lowered: 'sp_defense' },
  { name: '内敛', raised: 'sp_attack', lowered: 'attack' },
  { name: '慢吞吞', raised: 'sp_attack', lowered: 'defense' },
  { name: '冷静', raised: 'sp_attack', lowered: 'speed' },
  { name: '马虎', raised: 'sp_attack', lowered: 'sp_defense' },
  { name: '温和', raised: 'sp_defense', lowered: 'attack' },
  { name: '温顺', raised: 'sp_defense', lowered: 'defense' },
  { name: '自大', raised: 'sp_defense', lowered: 'speed' },
  { name: '慎重', raised: 'sp_defense', lowered: 'sp_attack' },
  { name: '胆小', raised: 'speed', lowered: 'attack' },
  { name: '急躁', raised: 'speed', lowered: 'defense' },
  { name: '爽朗', raised: 'speed', lowered: 'sp_attack' },
  { name: '天真', raised: 'speed', lowered: 'sp_defense' },
];

const DITTO_ID = '0132';

@Injectable()
export class BreedingService {
  private static orderCache: SpeciesInfo[] | null = null;
  private static byIdCache: Map<string, SpeciesInfo> | null = null;
  private static nameZhToId: Map<string, string> | null = null;
  private static selfMovesCache: Map<string, Set<string>> | null = null;
  private static eggMovesCache: Map<string, Map<string, EggMoveDef>> | null = null;
  private static eggMoveParentsCache: Map<string, Set<string>> | null = null;
  private static detailCache: Map<string, any> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private normalizeEggGroup(raw: string): string {
    let name = raw.trim();
    if (name.endsWith('群')) name = name.slice(0, -1);
    if (name === '未知蛋') name = '未知';
    return name;
  }

  private parseSteps(eggCycles: string): number | null {
    const m = eggCycles.match(/（(\d+)步）/);
    return m ? Number(m[1]) : null;
  }

  private isGenderless(s: SpeciesInfo): boolean {
    return s.genderRatio.male === 0 && s.genderRatio.female === 0;
  }

  private async load() {
    if (BreedingService.orderCache) return;
    const rows = await this.prisma.pokemon.findMany({
      select: { id: true, nameZh: true, nameEn: true, image: true, types: true, detail: true },
    });

    const byId = new Map<string, SpeciesInfo>();
    const nameZhToId = new Map<string, string>();
    const detailCache = new Map<string, any>();
    const rawChains = new Map<string, any[]>();

    for (const r of rows) {
      const d = JSON.parse(r.detail);
      detailCache.set(r.id, d);
      nameZhToId.set(r.nameZh, r.id);
      const f0 = d.forms?.[0] || {};
      const eggGroups = [...new Set<string>((f0.egg_groups || []).map((g: string) => this.normalizeEggGroup(g)))];
      const info: SpeciesInfo = {
        id: r.id,
        nameZh: r.nameZh,
        nameEn: r.nameEn,
        image: r.image,
        types: JSON.parse(r.types),
        eggGroups: [...new Set(eggGroups)],
        genderRatio: f0.gender_ratio || { male: 0, female: 0 },
        eggCycles: f0.egg_cycles || '',
        steps: this.parseSteps(f0.egg_cycles || ''),
        breedable: !eggGroups.includes('未发现'),
        isBaseForm: false,
        lineIds: [],
      };
      byId.set(r.id, info);
      rawChains.set(r.id, d.evolution_chains || []);
    }

    const nodeId = (node: any): string | null => {
      if (node?.image) {
        const m = String(node.image).match(/^(\d+)/);
        if (m) return String(Number(m[1])).padStart(4, '0');
      }
      return node?.name ? nameZhToId.get(node.name) || null : null;
    };

    for (const [id, chains] of rawChains) {
      const info = byId.get(id)!;
      const ids: string[] = [];
      for (const chain of chains) {
        for (const node of chain) {
          const nid = nodeId(node);
          if (nid && !ids.includes(nid)) ids.push(nid);
        }
      }
      if (ids.length === 0) ids.push(id);
      info.lineIds = ids;
    }

    for (const [id, info] of byId) {
      const chains = rawChains.get(id) || [];
      let base: string | null = null;
      if (chains.length > 0 && chains[0].length > 0) {
        base = nodeId(chains[0][0]);
      }
      if (!base) base = id;
      info.isBaseForm = base === id;
    }

    const selfMoves = new Map<string, Set<string>>();
    const eggMoves = new Map<string, Map<string, EggMoveDef>>();
    const eggMoveParents = new Map<string, Set<string>>();

    for (const [id, d] of detailCache) {
      const self = new Set<string>();
      for (const g of d.learnable_moves || []) {
        for (const it of g.data || []) if (it?.name) self.add(it.name);
      }
      for (const g of d.machine_moves || []) {
        for (const it of g.data || []) if (it?.name) self.add(it.name);
      }
      selfMoves.set(id, self);

      const eggMap = new Map<string, EggMoveDef>();
      for (const g of d.egg_moves || []) {
        for (const it of g.data || []) {
          if (!it?.name) continue;
          const parents: ParentRef[] = (it.parents || []).map((p: any) => ({ id: p?.id ?? null, name: p?.name ?? '' }));
          eggMap.set(it.name, { type: it.type, category: it.category, power: it.power, parents });
          let set = eggMoveParents.get(it.name);
          if (!set) {
            set = new Set();
            eggMoveParents.set(it.name, set);
          }
          for (const p of parents) {
            const pid = p.id ? String(p.id) : (p.name ? nameZhToId.get(p.name) : null);
            if (pid) set.add(pid);
          }
        }
      }
      eggMoves.set(id, eggMap);
    }

    const order = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
    BreedingService.orderCache = order;
    BreedingService.byIdCache = byId;
    BreedingService.nameZhToId = nameZhToId;
    BreedingService.selfMovesCache = selfMoves;
    BreedingService.eggMovesCache = eggMoves;
    BreedingService.eggMoveParentsCache = eggMoveParents;
    BreedingService.detailCache = detailCache;
  }

  async species(): Promise<SpeciesInfo[]> {
    await this.load();
    return BreedingService.orderCache!;
  }

  async speciesMoves(id: string) {
    await this.load();
    const info = BreedingService.byIdCache!.get(id);
    if (!info) throw new BadRequestException('宝可梦不存在');
    const d = BreedingService.detailCache!.get(id);
    const learnable: any[] = [];
    const machine: any[] = [];
    const egg: any[] = [];
    for (const g of d.learnable_moves || []) {
      for (const it of g.data || []) {
        if (!it?.name) continue;
        learnable.push({ name: it.name, level: it.level, type: it.type, category: it.category, power: it.power });
      }
    }
    for (const g of d.machine_moves || []) {
      for (const it of g.data || []) {
        if (!it?.name) continue;
        machine.push({ name: it.name, type: it.type, category: it.category, power: it.power });
      }
    }
    for (const g of d.egg_moves || []) {
      for (const it of g.data || []) {
        if (!it?.name) continue;
        egg.push({ name: it.name, type: it.type, category: it.category, power: it.power, parents: it.parents || [] });
      }
    }
    return {
      target: this.publicInfo(info),
      eggGroups: info.eggGroups,
      breedable: info.breedable,
      learnable,
      machine,
      egg,
    };
  }

  async plan(targetId: string, moves: string[]) {
    await this.load();
    const target = BreedingService.byIdCache!.get(targetId);
    if (!target) throw new BadRequestException('宝可梦不存在');
    if (!target.breedable) throw new BadRequestException(`${target.nameZh} 属于「未发现蛋组」，无法生蛋`);

    const line = target.lineIds.map((id) => BreedingService.byIdCache!.get(id)!);
    const self = new Set<string>();
    for (const l of line) {
      const s = BreedingService.selfMovesCache!.get(l.id);
      if (s) for (const m of s) self.add(m);
    }
    const eggDefs = BreedingService.eggMovesCache!.get(target.id) || new Map<string, EggMoveDef>();

    const selfMoveNames: string[] = [];
    const requiredEgg: { name: string; parents: ParentRef[] }[] = [];
    const infeasible: string[] = [];
    for (const m of moves) {
      if (self.has(m)) {
        selfMoveNames.push(m);
      } else if (eggDefs.has(m)) {
        requiredEgg.push({ name: m, parents: eggDefs.get(m)!.parents });
      } else {
        infeasible.push(m);
      }
    }

    const targetEggGroups = target.eggGroups;
    const ditto = BreedingService.byIdCache!.get(DITTO_ID)!;
    const dittoInfo = this.publicInfo(ditto);
    const fatherDittoAllowed = requiredEgg.length === 0;
    const lineAllMale = line.every((l) => l.genderRatio.female === 0 && !this.isGenderless(l));
    const lineGenderless = line.every((l) => this.isGenderless(l));

    const requiredParentSets = requiredEgg.map((r) => BreedingService.eggMoveParentsCache!.get(r.name) || new Set<string>());
    const passesAll = (s: SpeciesInfo) => requiredParentSets.every((set) => set.has(s.id));

    let mother: {
      candidates: ReturnType<BreedingService['publicInfo']>[];
      requirement: string;
      allowsDitto: boolean;
    };
    let father: {
      candidates: ReturnType<BreedingService['publicInfo']>[];
      requirement: string;
      allowsDitto: boolean;
    };

    if (lineAllMale) {
      mother = {
        candidates: [dittoInfo],
        requirement: `${target.nameZh} 一系均为雄性，母方需使用百变怪，子代跟随父方`,
        allowsDitto: true,
      };
      father = {
        candidates: line.filter((l) => l.genderRatio.male > 0 && passesAll(l)).map((l) => this.publicInfo(l)),
        requirement:
          requiredEgg.length === 0
            ? `雄性；需为目标一系（${line.map((l) => l.nameZh).join(' / ')}）`
            : `雄性；需为目标一系且会遗传：${requiredEgg.map((r) => r.name).join('、')}`,
        allowsDitto: false,
      };
    } else if (lineGenderless) {
      mother = {
        candidates: line.map((l) => this.publicInfo(l)),
        requirement: `${target.nameZh} 一系无性别，母方可直接使用；父方必须为百变怪`,
        allowsDitto: true,
      };
      father = {
        candidates: fatherDittoAllowed ? [dittoInfo] : [],
        requirement: fatherDittoAllowed ? '百变怪（无性别只能与百变怪生蛋）' : '无性别无法遗传蛋招式，请移除蛋招式目标',
        allowsDitto: true,
      };
    } else {
      mother = {
        candidates: line
          .filter((l) => l.genderRatio.female > 0)
          .map((l) => this.publicInfo(l)),
        requirement: `母方需为下列任一宝可梦（可雌性），子代种族跟随母方`,
        allowsDitto: false,
      };
      father = {
        candidates: BreedingService.orderCache!
          .filter((s) => {
            if (s.genderRatio.male <= 0) return false;
            if (s.eggGroups.length && !s.eggGroups.some((g) => targetEggGroups.includes(g))) return false;
            return passesAll(s);
          })
          .map((s) => this.publicInfo(s)),
        requirement:
          requiredEgg.length === 0
            ? `雄性；蛋组需与母方重合（${targetEggGroups.join(' / ')}）`
            : `雄性；蛋组需与母方重合（${targetEggGroups.join(' / ')}）且会遗传：${requiredEgg.map((r) => r.name).join('、')}`,
        allowsDitto: fatherDittoAllowed,
      };
      if (fatherDittoAllowed) father.candidates.push(dittoInfo);
    }

    return {
      target: this.publicInfo(target),
      line: line.map((l) => this.publicInfo(l)),
      selfMoveNames,
      requiredEgg,
      infeasible,
      mother,
      father,
    };
  }

  async simulate(body: {
    targetId: string;
    moves?: string[];
    motherId: string;
    fatherId: string;
    everstone?: boolean;
    destinyKnot?: boolean;
    motherNature?: string;
    fatherNature?: string;
  }) {
    await this.load();
    const target = BreedingService.byIdCache!.get(body.targetId);
    if (!target) throw new BadRequestException('目标宝可梦不存在');
    const mother = BreedingService.byIdCache!.get(body.motherId);
    const father = BreedingService.byIdCache!.get(body.fatherId);
    if (!mother || !father) throw new BadRequestException('父母宝可梦不存在');
    if (!mother.breedable || !father.breedable) throw new BadRequestException('存在无法生蛋的宝可梦');
    if (mother.id === DITTO_ID && father.id === DITTO_ID) throw new BadRequestException('百变怪无法与百变怪生蛋');

    // 子代归属
    let childLine: string[];
    if (mother.id === DITTO_ID) childLine = father.lineIds;
    else childLine = mother.lineIds;
    const childBase = childLine.find((id) => BreedingService.byIdCache!.get(id)!.isBaseForm) || childLine[0];
    if (childBase !== target.id) throw new BadRequestException('所选父母无法产出该目标宝可梦');

    // 兼容性
    if (mother.id === DITTO_ID) {
      if (father.genderRatio.male <= 0) throw new BadRequestException('母方为百变怪时，父方需为目标一系中的雄性宝可梦');
      if (!target.lineIds.includes(father.id)) throw new BadRequestException('母方为百变怪时，父方需为目标宝可梦一系');
    } else if (father.id === DITTO_ID) {
      if (!target.lineIds.includes(mother.id)) throw new BadRequestException('父方为百变怪时，母方需为目标宝可梦一系');
    } else {
      if (!target.lineIds.includes(mother.id)) throw new BadRequestException('母方需为目标宝可梦一系');
      const motherCanFemale = mother.genderRatio.female > 0;
      const fatherCanMale = father.genderRatio.male > 0;
      if (!motherCanFemale || !fatherCanMale) throw new BadRequestException('一公一母才能生蛋（无性别只能配百变怪）');
      const shareEgg = mother.eggGroups.some((g) => father.eggGroups.includes(g));
      if (!shareEgg) throw new BadRequestException('父母蛋组不重合，无法生蛋');
    }

    const child = BreedingService.byIdCache!.get(childBase)!;
    const childDetail = BreedingService.detailCache!.get(childBase);

    // 性别
    let gender = '无性别';
    if (child.genderRatio.male + child.genderRatio.female > 0) {
      const roll = Math.random() * 100;
      gender = roll < child.genderRatio.female ? '雌性' : '雄性';
    }

    // 性格
    const pickNature = (name?: string) => NATURES.find((n) => n.name === name) || NATURES[Math.floor(Math.random() * NATURES.length)];
    let nature = pickNature();
    if (body.everstone) {
      nature = pickNature(body.motherNature) || pickNature(body.fatherNature);
      if (body.motherNature && NATURES.some((n) => n.name === body.motherNature)) nature = pickNature(body.motherNature);
      else if (body.fatherNature && NATURES.some((n) => n.name === body.fatherNature)) nature = pickNature(body.fatherNature);
    }

    // 个体值
    const baseStats = childDetail?.stats?.[0]?.data || {};
    const inheritedSlots = body.destinyKnot ? 5 : 3;
    const ivs: { stat: string; key: string; value: number; source: string }[] = [];
    for (let i = 0; i < STAT_KEYS.length; i++) {
      const key = STAT_KEYS[i];
      const inherited = i < inheritedSlots;
      const source = inherited ? (Math.random() < 0.5 ? '母' : '父') : '随机';
      ivs.push({ stat: STAT_ZH[key], key, value: Math.floor(Math.random() * 32), source });
    }

    // 特性
    const abilitySource = mother.id === DITTO_ID ? father : mother;
    const abilitySourceDetail = BreedingService.detailCache!.get(abilitySource.id);
    const abilities: { name: string; is_hidden: boolean }[] = abilitySourceDetail?.forms?.[0]?.abilities || [];
    let ability: { name: string; isHidden: boolean };
    if (abilities.length === 0) {
      ability = { name: '（无特性）', isHidden: false };
    } else {
      const hidden = abilities.filter((a) => a.is_hidden);
      const normal = abilities.filter((a) => !a.is_hidden);
      if (hidden.length > 0 && Math.random() < 0.6) {
        ability = { name: hidden[Math.floor(Math.random() * hidden.length)].name, isHidden: true };
      } else if (normal.length > 0) {
        ability = { name: normal[Math.floor(Math.random() * normal.length)].name, isHidden: false };
      } else {
        ability = { name: abilities[0].name, isHidden: false };
      }
    }

    // 招式遗传
    const self = BreedingService.selfMovesCache!.get(child.id) || new Set<string>();
    const moves = (body.moves || []).map((name) => {
      if (self.has(name)) return { name, method: '可自学（升级/学习器）', ok: true };
      const parents = BreedingService.eggMoveParentsCache!.get(name);
      if (parents && parents.has(father.id)) return { name, method: `父方遗传蛋招式 · ${father.nameZh}`, ok: true };
      return { name, method: '无法遗传', ok: false };
    });

    // 闪光 1/4096
    const shiny = Math.random() < 1 / 4096;

    // 50级能力值
    const natureMap: Record<string, number> = {};
    if (nature.raised) natureMap[nature.raised] = 1.1;
    if (nature.lowered) natureMap[nature.lowered] = 0.9;
    const stats = ivs.map((iv) => {
      const base = Number(baseStats[iv.key]) || 0;
      const level = 50;
      let value: number;
      if (iv.key === 'hp') {
        value = Math.floor(((2 * base + iv.value) * level) / 100) + level + 10;
      } else {
        value = Math.floor(((2 * base + iv.value) * level) / 100 + 5);
        const mult = natureMap[iv.key];
        if (mult) value = Math.floor(value * mult);
      }
      return { stat: iv.stat, key: iv.key, base, value };
    });

    return {
      child: this.publicInfo(child),
      gender,
      nature: { name: nature.name, raised: nature.raised ? STAT_ZH[nature.raised] : null, lowered: nature.lowered ? STAT_ZH[nature.lowered] : null },
      ability,
      ivs,
      stats,
      moves,
      shiny,
      steps: child.steps,
      eggCycles: child.eggCycles,
      mother: this.publicInfo(mother),
      father: this.publicInfo(father),
    };
  }

  private publicInfo(s: SpeciesInfo) {
    return {
      id: s.id,
      nameZh: s.nameZh,
      nameEn: s.nameEn,
      image: s.image,
      types: s.types,
      eggGroups: s.eggGroups,
      genderRatio: s.genderRatio,
      eggCycles: s.eggCycles,
      steps: s.steps,
    };
  }
}