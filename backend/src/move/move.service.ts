import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const FULL_WIDTH = '０１２３４５６７８９';

export interface MoveLearner {
  id: string;
  nameZh: string;
  image: string | null;
  methods: string[];
}

function fmtMachine(s: string): string {
  const fw = s.replace(/[０-９]/g, (c) => String(FULL_WIDTH.indexOf(c)));
  if (fw.startsWith('招式学习器')) return `TM${String(Number(fw.slice(5)))}`;
  if (fw.startsWith('招式记录')) return `TR${String(Number(fw.slice(4)))}`;
  return fw;
}

function machineRank(s: string): [number, number] {
  const type = s[0] === 'T' ? (s[1] === 'M' ? 0 : 1) : 2;
  return [type, Number(s.slice(2)) || 0];
}

function sortMachines(a: string, b: string): number {
  const [at, an] = machineRank(a);
  const [bt, bn] = machineRank(b);
  return at - bt || an - bn;
}

@Injectable()
export class MoveService {
  constructor(private readonly prisma: PrismaService) {}

  private static machinesCache: Map<string, string[]> | null = null;

  private async machines(): Promise<Map<string, string[]>> {
    if (MoveService.machinesCache) return MoveService.machinesCache;
    const map = new Map<string, Set<string>>();
    const all = await this.prisma.pokemon.findMany({ select: { detail: true } });
    for (const p of all) {
      const d = JSON.parse(p.detail);
      for (const mm of d.machine_moves ?? []) {
        for (const it of mm.data ?? []) {
          if (!it?.name) continue;
          if (!map.has(it.name)) map.set(it.name, new Set());
          map.get(it.name)!.add(fmtMachine(it.machine));
        }
      }
    }
    const sorted = new Map<string, string[]>();
    for (const [k, v] of map) sorted.set(k, [...v].sort(sortMachines));
    MoveService.machinesCache = sorted;
    return sorted;
  }

  async list(
    search?: string,
    type?: string,
    category?: string,
    page?: number,
    pageSize?: number,
  ) {
    const where: Prisma.MoveWhereInput = {};
    if (search) {
      where.OR = [
        { nameZh: { contains: search } },
        { nameEn: { contains: search } },
        { nameJa: { contains: search } },
      ];
    }
    if (type) where.type = type;
    if (category) where.category = category;
    const pageNum = Math.max(1, Number(page) || 1);
    const sizeNum = Math.min(200, Math.max(1, Number(pageSize) || 50));
    const [total, items] = await this.prisma.$transaction([
      this.prisma.move.count({ where }),
      this.prisma.move.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
      }),
    ]);
    const machines = await this.machines();
    return {
      total,
      page: pageNum,
      pageSize: sizeNum,
      items: items.map((m) => ({
        ...m,
        machines: machines.get(m.nameZh) ?? [],
      })),
    };
  }

  private static learnersCache: Map<string, MoveLearner[]> | null = null;

  private async learners(): Promise<Map<string, MoveLearner[]>> {
    if (MoveService.learnersCache) return MoveService.learnersCache;
    const map = new Map<string, Map<string, MoveLearner>>();
    const add = (
      moveName: string,
      id: string,
      nameZh: string,
      image: string | null,
      method: string,
    ) => {
      if (!map.has(moveName)) map.set(moveName, new Map());
      const bucket = map.get(moveName)!;
      const key = id;
      if (!bucket.has(key)) {
        bucket.set(key, { id, nameZh, image, methods: [] });
      }
      if (!bucket.get(key)!.methods.includes(method)) {
        bucket.get(key)!.methods.push(method);
      }
    };
    const all = await this.prisma.pokemon.findMany({
      select: { id: true, nameZh: true, image: true, detail: true },
    });
    for (const p of all) {
      const d = JSON.parse(p.detail);
      for (const mm of d.learnable_moves ?? []) {
        for (const it of mm.data ?? []) {
          if (it?.name) add(it.name, p.id, p.nameZh, p.image, '升级');
        }
      }
      for (const mm of d.machine_moves ?? []) {
        for (const it of mm.data ?? []) {
          if (it?.name) add(it.name, p.id, p.nameZh, p.image, '机器');
        }
      }
      for (const mm of d.egg_moves ?? []) {
        for (const it of mm.data ?? []) {
          if (it?.name) add(it.name, p.id, p.nameZh, p.image, '蛋');
        }
      }
    }
    const out = new Map<string, MoveLearner[]>();
    for (const [k, v] of map) {
      out.set(k, [...v.values()].sort((a, b) => a.id.localeCompare(b.id)));
    }
    MoveService.learnersCache = out;
    return out;
  }

  async detail(id: string) {
    const move = await this.prisma.move.findUnique({ where: { id } });
    if (!move) return null;
    return {
      ...move,
      machines: (await this.machines()).get(move.nameZh) ?? [],
      learners: (await this.learners()).get(move.nameZh) ?? [],
    };
  }
}
