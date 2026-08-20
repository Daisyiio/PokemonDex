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
  breedable: boolean;
  isBaseForm: boolean;
  lineIds: string[];
}

const DITTO_ID = '0132';
const MAX_DEPTH = 3;

@Injectable()
export class GeneticsService {
  private static order: SpeciesInfo[] | null = null;
  private static byId: Map<string, SpeciesInfo> | null = null;
  private static moveToLevelLearners: Map<string, Set<string>> | null = null;
  private static eggMovesBySpecies: Map<string, Map<string, any>> | null = null;
  private static moveToEggReceivers: Map<string, Set<string>> | null = null;
  private static detailCache: Map<string, any> | null = null;
  private static nameZhToId: Map<string, string> | null = null;

  constructor(private readonly prisma: PrismaService) {}

  private normalizeEggGroup(raw: string): string {
    let name = raw.trim();
    if (name.endsWith('群')) name = name.slice(0, -1);
    if (name === '未知蛋') name = '未知';
    return name;
  }

  private isGenderless(s: SpeciesInfo): boolean {
    return s.genderRatio.male === 0 && s.genderRatio.female === 0;
  }

  private sharesEggGroup(a: SpeciesInfo, b: SpeciesInfo): string | null {
    for (const g of a.eggGroups) {
      if (b.eggGroups.includes(g)) return g;
    }
    return null;
  }

  private async load() {
    if (GeneticsService.order) return;
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
      byId.set(r.id, {
        id: r.id,
        nameZh: r.nameZh,
        nameEn: r.nameEn,
        image: r.image,
        types: JSON.parse(r.types),
        eggGroups,
        genderRatio: f0.gender_ratio || { male: 0, female: 0 },
        breedable: !eggGroups.includes('未发现'),
        isBaseForm: false,
        lineIds: [],
      });
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
      let base: string | null = null;
      if (chains.length && chains[0].length) base = nodeId(chains[0][0]);
      if (!base) base = id;
      info.isBaseForm = base === id;
    }

    const moveToLevelLearners = new Map<string, Set<string>>();
    const eggMovesBySpecies = new Map<string, Map<string, any>>();
    const moveToEggReceivers = new Map<string, Set<string>>();

    for (const [id, d] of detailCache) {
      const self = new Set<string>();
      for (const g of d.learnable_moves || []) {
        for (const it of g.data || []) {
          if (!it?.name) continue;
          self.add(it.name);
          let set = moveToLevelLearners.get(it.name);
          if (!set) { set = new Set(); moveToLevelLearners.set(it.name, set); }
          set.add(id);
        }
      }
      const eggMap = new Map<string, any>();
      for (const g of d.egg_moves || []) {
        for (const it of g.data || []) {
          if (!it?.name) continue;
          eggMap.set(it.name, { type: it.type, category: it.category, power: it.power, parents: it.parents || [] });
          let set = moveToEggReceivers.get(it.name);
          if (!set) { set = new Set(); moveToEggReceivers.set(it.name, set); }
          set.add(id);
        }
      }
      eggMovesBySpecies.set(id, eggMap);
    }

    GeneticsService.order = Array.from(byId.values()).sort((a, b) => a.id.localeCompare(b.id));
    GeneticsService.byId = byId;
    GeneticsService.nameZhToId = nameZhToId;
    GeneticsService.moveToLevelLearners = moveToLevelLearners;
    GeneticsService.eggMovesBySpecies = eggMovesBySpecies;
    GeneticsService.moveToEggReceivers = moveToEggReceivers;
    GeneticsService.detailCache = detailCache;
  }

  private info(s: SpeciesInfo) {
    return { id: s.id, nameZh: s.nameZh, nameEn: s.nameEn, image: s.image, types: s.types, eggGroups: s.eggGroups, genderRatio: s.genderRatio };
  }

  async species() {
    await this.load();
    return GeneticsService.order!.filter((s) => s.breedable && s.isBaseForm).map((s) => this.info(s));
  }

  async eggMoves(id: string) {
    await this.load();
    const info = GeneticsService.byId!.get(id);
    if (!info) throw new BadRequestException('宝可梦不存在');
    const eggMap = GeneticsService.eggMovesBySpecies!.get(id) || new Map();
    return {
      target: this.info(info),
      eggGroups: info.eggGroups,
      breedable: info.breedable,
      genderRatio: info.genderRatio,
      eggMoves: Array.from(eggMap.entries()).map(([name, def]) => ({
        name,
        type: def.type,
        category: def.category,
        power: def.power,
        parents: def.parents,
      })),
    };
  }

  async plan(targetId: string, moves: string[], generation: number) {
    await this.load();
    const byId = GeneticsService.byId!;
    const target = byId.get(targetId);
    if (!target) throw new BadRequestException('宝可梦不存在');
    if (!target.breedable) throw new BadRequestException(`${target.nameZh} 属于「未发现蛋组」，无法生蛋`);

    const isAllMale = target.genderRatio.female === 0 && !this.isGenderless(target);
    const isGenderless = this.isGenderless(target);
    const eggMap = GeneticsService.eggMovesBySpecies!.get(targetId) || new Map();

    const moveResults = moves.map((move) => {
      if (!eggMap.has(move)) {
        return { move, valid: false, reason: `「${move}」不是${target.nameZh}可遗传的蛋招式，无法通过孵蛋获得。` };
      }
      const sols = this.findSolutions(move, target, generation);
      if (sols.length === 0) {
        return { move, valid: true, reason: `找到了该蛋招式但暂无可用遗传路径。` };
      }
      return { move, valid: true, solutions: sols };
    });

    const combinedDirect = this.findCombinedDirect(moves, target, generation);

    let specialNote: string | undefined;
    if (isGenderless) {
      specialNote = `${target.nameZh} 为无性别宝可梦，只能与百变怪孵蛋。百变怪无法传递蛋招式，因此无法通过孵蛋获得蛋招式。`;
    } else if (isAllMale) {
      specialNote = `${target.nameZh} 全部为雄性，无法作为母本进行孵蛋遗传蛋招式。`;
    }

    return {
      target: this.info(target),
      generation,
      specialNote,
      moveResults,
      combinedDirect,
    };
  }

  private findSolutions(move: string, target: SpeciesInfo, generation: number): any[] {
    const solutions: any[] = [];

    // Direct: species that learn by level-up, share egg group, male-capable
    const learners = GeneticsService.moveToLevelLearners!.get(move) || new Set<string>();
    const directCandidates: SpeciesInfo[] = [];
    for (const id of learners) {
      const s = GeneticsService.byId!.get(id);
      if (!s || !s.breedable || s.genderRatio.male <= 0) continue;
      if (this.sharesEggGroup(s, target)) directCandidates.push(s);
    }
    if (directCandidates.length > 0) {
      const eg = this.sharesEggGroup(directCandidates[0], target)!;
      solutions.push({
        type: 'direct',
        stepCount: 1,
        candidates: directCandidates.map((s) => this.info(s)),
        sharedEggGroup: eg,
        steps: [{
          father: this.info(directCandidates[0]),
          mother: this.info(target),
          offspring: this.info(target),
          sharedEggGroup: eg,
          note: `两只放入饲育屋，出生子代${target.nameZh}自带「${move}」`,
        }],
      });
    }

    // Chain breeding (BFS)
    if (solutions.length === 0 || true) {
      const chains = this.bfsChain(move, target, generation);
      for (const chain of chains) {
        solutions.push(chain);
      }
    }

    // Sort by step count
    solutions.sort((a, b) => a.stepCount - b.stepCount);
    return solutions;
  }

  private bfsChain(move: string, target: SpeciesInfo, generation: number): any[] {
    const byId = GeneticsService.byId!;
    const learners = GeneticsService.moveToLevelLearners!.get(move) || new Set<string>();
    const receivers = GeneticsService.moveToEggReceivers!.get(move) || new Set<string>();

    const sources: SpeciesInfo[] = [];
    for (const id of learners) {
      const s = byId.get(id);
      if (s && s.breedable && s.genderRatio.male > 0) sources.push(s);
    }

    const intermediates: SpeciesInfo[] = [];
    for (const id of receivers) {
      const s = byId.get(id);
      if (!s || !s.breedable || s.id === target.id) continue;
      if (s.genderRatio.male === 0) continue;
      intermediates.push(s);
    }

    const results: any[] = [];

    // BFS from each source
    const visited = new Set<string>();
    type State = { current: SpeciesInfo; path: SpeciesInfo[] };
    const queue: State[] = [];
    for (const src of sources) {
      queue.push({ current: src, path: [src] });
      visited.add(src.id);
    }

    let foundChains = 0;
    while (queue.length > 0 && foundChains < 5) {
      const { current, path } = queue.shift()!;

      // Check if current can breed with target
      const eg = this.sharesEggGroup(current, target);
      if (eg && current.genderRatio.male > 0) {
        // Found chain! path → target
        const steps = this.buildSteps(path, target, move);
        results.push({
          type: 'chain',
          stepCount: path.length,
          steps,
          sharedEggGroups: steps.map((s: any) => s.sharedEggGroup),
        });
        foundChains++;
      }

      if (path.length >= MAX_DEPTH) continue;

      for (const inter of intermediates) {
        if (visited.has(inter.id)) continue;
        const interEg = this.sharesEggGroup(current, inter);
        if (!interEg) continue;
        // Intermediate must be able to receive the move (it's in receivers, checked above)
        visited.add(inter.id);
        queue.push({ current: inter, path: [...path, inter] });
      }
    }

    return results;
  }

  private buildSteps(path: SpeciesInfo[], target: SpeciesInfo, move: string): any[] {
    const steps: any[] = [];
    for (let i = 0; i < path.length; i++) {
      const father = path[i];
      const mother = i < path.length - 1 ? path[i + 1] : target;
      const offspring = mother;
      const eg = this.sharesEggGroup(father, mother);
      const isLast = i === path.length - 1;
      steps.push({
        father: this.info(father),
        mother: this.info(mother),
        offspring: this.info(offspring),
        sharedEggGroup: eg || '?',
        note: isLast
          ? `公的${father.nameZh}（携带「${move}」）× 母的${mother.nameZh} → 产出子代${target.nameZh}，携带「${move}」`
          : `公的${father.nameZh}（携带「${move}」）× 母的${mother.nameZh} → 产出公的${mother.nameZh}，已学会「${move}」`,
      });
    }
    return steps;
  }

  private findCombinedDirect(moves: string[], target: SpeciesInfo, generation: number): any | null {
    if (moves.length === 0) return null;
    const candidates = new Set<string>();
    for (const move of moves) {
      const learners = GeneticsService.moveToLevelLearners!.get(move);
      if (!learners) return null;
      for (const id of learners) {
        const s = GeneticsService.byId!.get(id);
        if (!s || !s.breedable || s.genderRatio.male <= 0) continue;
        if (this.sharesEggGroup(s, target)) candidates.add(id);
      }
    }
    // Find species that can learn ALL moves by level-up
    const combined: SpeciesInfo[] = [];
    for (const id of candidates) {
      const s = GeneticsService.byId!.get(id)!;
      let canAll = true;
      for (const move of moves) {
        const learners = GeneticsService.moveToLevelLearners!.get(move);
        if (!learners || !learners.has(id)) { canAll = false; break; }
      }
      if (canAll) combined.push(s);
    }
    if (combined.length === 0) return null;
    const eg = this.sharesEggGroup(combined[0], target)!;
    return {
      father: this.info(combined[0]),
      candidates: combined.map((s) => this.info(s)),
      sharedEggGroup: eg,
      moves,
    };
  }
}