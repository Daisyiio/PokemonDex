import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

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
  private static eggMovesByGen: Map<string, Map<string, Map<string, any>>> | null = null;
  private static eggReceiversByGen: Map<string, Map<string, Set<string>>> | null = null;

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

  private async loadEggMovesByGen() {
    if (GeneticsService.eggMovesByGen) return;
    const filePath = path.join(process.cwd(), 'data', 'moves_by_gen.json');
    if (!fs.existsSync(filePath)) return;
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const byGen = new Map<string, Map<string, Map<string, any>>>();
    const receiversByGen = new Map<string, Map<string, Set<string>>>();
    for (const [gen, species] of Object.entries(data)) {
      const genMap = new Map<string, Map<string, any>>();
      const recvMap = new Map<string, Set<string>>();
      for (const [id, info] of Object.entries(species as any)) {
        const moveMap = new Map<string, any>();
        for (const m of (info as any).egg || []) {
          moveMap.set(m.name, { type: m.type || '', category: m.category || '', power: m.power || '', accuracy: m.accuracy || '', pp: m.pp || '', parents: m.parents || [] });
          let set = recvMap.get(m.name);
          if (!set) { set = new Set(); recvMap.set(m.name, set); }
          set.add(id);
        }
        genMap.set(id, moveMap);
      }
      byGen.set(gen, genMap);
      receiversByGen.set(gen, recvMap);
    }
    GeneticsService.eggMovesByGen = byGen;
    GeneticsService.eggReceiversByGen = receiversByGen;
  }

  async allMovesByGen(id: string, gen?: number) {
    await this.load();
    const info = GeneticsService.byId!.get(id);
    if (!info) throw new BadRequestException('宝可梦不存在');
    if (!gen || gen === 9 || gen < 2 || gen > 8) {
      return { generation: 9, learnable: [], machine: [], egg: [], tutor: [] };
    }
    await this.loadEggMovesByGen();
    const filePath = path.join(process.cwd(), 'data', 'moves_by_gen.json');
    if (!fs.existsSync(filePath)) return { generation: gen, learnable: [], machine: [], egg: [], tutor: [] };
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const species = raw[String(gen)]?.[id];
    if (!species) return { generation: gen, learnable: [], machine: [], egg: [], tutor: [] };
    return {
      generation: gen,
      learnable: species.learnable || [],
      machine: species.machine || [],
      egg: species.egg || [],
      tutor: species.tutor || [],
    };
  }

  private getEggMapForGen(targetId: string, generation: number): Map<string, any> {
    if (generation >= 9 || generation < 2) {
      return GeneticsService.eggMovesBySpecies!.get(targetId) || new Map();
    }
    return GeneticsService.eggMovesByGen?.get(String(generation))?.get(targetId) || new Map();
  }

  private getReceiversForGen(move: string, generation: number): Set<string> {
    if (generation >= 9 || generation < 2) {
      return GeneticsService.moveToEggReceivers!.get(move) || new Set();
    }
    return GeneticsService.eggReceiversByGen?.get(String(generation))?.get(move) || new Set();
  }

  private info(s: SpeciesInfo) {
    return { id: s.id, nameZh: s.nameZh, nameEn: s.nameEn, image: s.image, types: s.types, eggGroups: s.eggGroups, genderRatio: s.genderRatio };
  }

  private getLearnLevel(speciesId: string, moveName: string): string {
    const d = GeneticsService.detailCache!.get(speciesId);
    if (!d) return '?';
    for (const g of d.learnable_moves || []) {
      for (const it of g.data || []) {
        if (it?.name === moveName) return it.level || '?';
      }
    }
    return '?';
  }

  private levelText(level: string): string {
    if (level === '?' || !level) return '需先习得该招式';
    if (level === '—') return '初始即可习得';
    return `需升级至 Lv.${level} 习得`;
  }

  async species() {
    await this.load();
    return GeneticsService.order!.filter((s) => s.breedable && s.isBaseForm).map((s) => this.info(s));
  }

  async eggMoves(id: string, gen?: number) {
    await this.load();
    const info = GeneticsService.byId!.get(id);
    if (!info) throw new BadRequestException('宝可梦不存在');
    
    let eggMap: Map<string, any>;
    if (gen && gen >= 2 && gen <= 8) {
      await this.loadEggMovesByGen();
      eggMap = GeneticsService.eggMovesByGen?.get(String(gen))?.get(id) || new Map();
    } else {
      eggMap = GeneticsService.eggMovesBySpecies!.get(id) || new Map();
    }
    return {
      target: this.info(info),
      eggGroups: info.eggGroups,
      breedable: info.breedable,
      genderRatio: info.genderRatio,
      generation: gen || 9,
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
    if (generation >= 2 && generation <= 8) await this.loadEggMovesByGen();
    const byId = GeneticsService.byId!;
    const target = byId.get(targetId);
    if (!target) throw new BadRequestException('宝可梦不存在');
    if (!target.breedable) throw new BadRequestException(`${target.nameZh} 属于「未发现蛋组」，无法生蛋`);

    const isAllMale = target.genderRatio.female === 0 && !this.isGenderless(target);
    const isGenderless = this.isGenderless(target);
    const eggMap = this.getEggMapForGen(targetId, generation);

    const moveResults = moves.map((move) => {
      if (!eggMap.has(move)) {
        return { move, valid: false, reason: `「${move}」不是${target.nameZh}可遗传的蛋招式，无法通过孵蛋获得。` };
      }
      const sols = this.findSolutions(move, target, generation, eggMap.get(move));
      if (sols.length === 0) {
        return { move, valid: true, reason: `找到了该蛋招式但暂无可用遗传路径。` };
      }
      return { move, valid: true, solutions: sols };
    });

    const combinedDirect = this.findCombinedDirect(moves, target, generation, eggMap);

    let specialNote: string | undefined;
    if (isGenderless) {
      specialNote = `${target.nameZh} 为无性别宝可梦，只能与百变怪孵蛋。百变怪无法传递蛋招式。`;
      if (generation >= 6) {
        specialNote += `但在第9世代朱紫中，可通过「镜子香草」在野餐中让同种宝可梦共享蛋招式（无需孵蛋）。需先有一只已学会该招式的同种宝可梦。`;
      }
    } else if (isAllMale) {
      specialNote = `${target.nameZh} 全部为雄性，无法作为母本进行孵蛋遗传蛋招式。`;
      if (generation >= 6) {
        specialNote += `但在第9世代朱紫中，可通过「镜子香草」在野餐中让同种宝可梦共享蛋招式（无需孵蛋）。需先有一只已学会该招式的同种宝可梦（可从其他世代传入）。`;
      }
    }

    const unifiedPlan = this.buildUnifiedPlan(moves, target, generation, moveResults, isAllMale, isGenderless);

    return {
      target: this.info(target),
      generation,
      specialNote,
      moveResults,
      combinedDirect,
      unifiedPlan,
    };
  }

  private buildUnifiedPlan(
    moves: string[],
    target: SpeciesInfo,
    generation: number,
    moveResults: any[],
    isAllMale: boolean,
    isGenderless: boolean,
  ): any | null {
    if (moves.length <= 1) return null;
    if (generation < 6 && (isAllMale || isGenderless)) return null;
    if (generation >= 6 && (isAllMale || isGenderless)) {
      return {
        type: 'mirror-herb',
        note: `${isGenderless ? '无性别' : '全雄性'}宝可梦无法通过孵蛋遗传蛋招式。但在第9世代朱紫中，可使用「镜子香草」在野餐中共享蛋招式：将一只已学会目标招式的同种宝可梦和一只携带镜子香草的同种宝可梦一起野餐，后者会自动学会该招式。`,
        steps: [],
        impossibleMoves: [],
      };
    }

    // Gen 5-: mother can't pass egg moves, so sequential stacking doesn't work
    if (generation < 6) {
      return {
        type: 'gen5-limit',
        note: '在第5世代及更早，只有父方可以传递蛋招式，母方无法将已遗传的招式继续传递给后代。无法通过顺序叠加同时遗传多个蛋招式，请寻找一个同时学会所有招式的父方，或逐个获取。',
        steps: [],
        impossibleMoves: [],
      };
    }

    const impossible: { move: string; reason: string }[] = [];
    const allSteps: any[] = [];
    const knownMoves: string[] = [];

    for (const move of moves) {
      const mr = moveResults.find((r) => r.move === move);
      if (!mr?.valid || !mr.solutions || mr.solutions.length === 0) {
        impossible.push({ move, reason: mr?.reason || '无可用遗传路径' });
        continue;
      }

      const directSol = mr.solutions.find((s) => s.type === 'direct');
      if (directSol && directSol.candidates?.length > 0) {
        // Direct father: one stacking step
        const fatherInfo = directSol.candidates[0];
        const father = GeneticsService.byId!.get(fatherInfo.id)!;
        const level = this.getLearnLevel(father.id, move);
        const eg = this.sharesEggGroup(father, target) || '?';
        knownMoves.push(move);
        const prevMoves = knownMoves.length > 1 ? `（母方已携带${knownMoves.slice(0, -1).join('、')}）` : '';
        allSteps.push({
          phase: 'stacking',
          move,
          father: fatherInfo,
          mother: this.info(target),
          offspring: this.info(target),
          sharedEggGroup: eg,
          learnLevel: level,
          note: `父方${father.nameZh}${this.levelText(level)}「${move}」${prevMoves}，放入饲育屋，子代${target.nameZh}携带${knownMoves.join('、')}`,
        });
      } else {
        // Chain: use chain steps (last step is the stacking step)
        const chainSol = mr.solutions.find((s) => s.type === 'chain');
        if (!chainSol) {
          impossible.push({ move, reason: '无可用遗传路径' });
          continue;
        }
        for (let i = 0; i < chainSol.steps.length; i++) {
          const step = chainSol.steps[i];
          const isLast = i === chainSol.steps.length - 1;
          if (isLast) {
            knownMoves.push(move);
            const prevMoves = knownMoves.length > 1 ? `（母方已携带${knownMoves.slice(0, -1).join('、')}）` : '';
            allSteps.push({
              ...step,
              phase: 'chain-final',
              move,
              note: `公的${step.father.nameZh}（携带「${move}」）${prevMoves}× 母的${step.mother.nameZh} → 子代${target.nameZh}，携带${knownMoves.join('、')}`,
            });
          } else {
            allSteps.push({ ...step, phase: 'chain-prep', move });
          }
        }
      }
    }

    if (allSteps.length === 0) {
      return { type: 'impossible', steps: [], impossibleMoves: impossible, note: '所有招式均无法遗传。' };
    }

    return {
      type: allSteps.some((s) => s.phase === 'chain-prep' || s.phase === 'chain-final') ? 'mixed' : 'sequential',
      totalSteps: allSteps.length,
      steps: allSteps,
      impossibleMoves: impossible,
      knownMoves,
    };
  }

  private findSolutions(move: string, target: SpeciesInfo, generation: number, eggDef: any): any[] {
    const solutions: any[] = [];

    // Direct: use parents list from egg moves data (generation-specific)
    const directCandidates: SpeciesInfo[] = [];
    if (eggDef?.parents) {
      for (const parent of eggDef.parents) {
        const s = GeneticsService.byId!.get(parent.id);
        if (!s || !s.breedable || s.genderRatio.male <= 0) continue;
        if (this.sharesEggGroup(s, target)) directCandidates.push(s);
      }
    }
    // Fallback: use moveToLevelLearners (Gen9) if no parents from egg data
    if (directCandidates.length === 0) {
      const learners = GeneticsService.moveToLevelLearners!.get(move) || new Set<string>();
      for (const id of learners) {
        const s = GeneticsService.byId!.get(id);
        if (!s || !s.breedable || s.genderRatio.male <= 0) continue;
        if (this.sharesEggGroup(s, target)) directCandidates.push(s);
      }
    }
    if (directCandidates.length > 0) {
      const eg = this.sharesEggGroup(directCandidates[0], target)!;
      const lv = this.getLearnLevel(directCandidates[0].id, move);
      solutions.push({
        type: 'direct',
        stepCount: 1,
        candidates: directCandidates.map((s) => ({
          ...this.info(s),
          learnLevel: this.getLearnLevel(s.id, move),
        })),
        sharedEggGroup: eg,
        steps: [{
          father: this.info(directCandidates[0]),
          mother: this.info(target),
          offspring: this.info(target),
          sharedEggGroup: eg,
          note: `父方${directCandidates[0].nameZh}${this.levelText(lv)}「${move}」，放入饲育屋，出生子代${target.nameZh}自带该蛋招式`,
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
    const receivers = this.getReceiversForGen(move, generation);

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
      const isFirst = i === 0;
      let note: string;
      if (isFirst) {
        const lv = this.getLearnLevel(father.id, move);
        const lvText = this.levelText(lv);
        if (isLast) {
          note = `父方${father.nameZh}${lvText}「${move}」，放入饲育屋，出生子代${target.nameZh}自带「${move}」`;
        } else {
          note = `父方${father.nameZh}${lvText}「${move}」，与母的${mother.nameZh}配对 → 产出公的${mother.nameZh}，已学会「${move}」`;
        }
      } else {
        note = isLast
          ? `公的${father.nameZh}（携带「${move}」）× 母的${mother.nameZh} → 产出子代${target.nameZh}，携带「${move}」`
          : `公的${father.nameZh}（携带「${move}」）× 母的${mother.nameZh} → 产出公的${mother.nameZh}，已学会「${move}」`;
      }
      steps.push({
        father: this.info(father),
        mother: this.info(mother),
        offspring: this.info(offspring),
        sharedEggGroup: eg || '?',
        note,
      });
    }
    return steps;
  }

  private findCombinedDirect(moves: string[], target: SpeciesInfo, generation: number, eggMap: Map<string, any>): any | null {
    if (moves.length === 0) return null;
    // Use parents lists from egg moves data (generation-specific)
    const candidates = new Set<string>();
    for (const move of moves) {
      const def = eggMap.get(move);
      if (!def?.parents) return null;
      for (const parent of def.parents) {
        const s = GeneticsService.byId!.get(parent.id);
        if (!s || !s.breedable || s.genderRatio.male <= 0) continue;
        if (this.sharesEggGroup(s, target)) candidates.add(parent.id);
      }
    }
    // Find species that are in ALL moves' parents lists
    const combined: SpeciesInfo[] = [];
    for (const id of candidates) {
      const s = GeneticsService.byId!.get(id)!;
      let canAll = true;
      for (const move of moves) {
        const def = eggMap.get(move);
        if (!def?.parents?.some((p: any) => p.id === id)) { canAll = false; break; }
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
      learnInfo: moves.map((m) => ({ move: m, level: this.getLearnLevel(combined[0].id, m) })),
    };
  }
}