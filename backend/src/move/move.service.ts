import { Injectable } from '@nestjs/common';
import { Move, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const FULL_WIDTH = '０１２３４５６７８９';

export interface MoveLearner {
  id: string;
  nameZh: string;
  image: string | null;
  methods: { method: string; level?: string; gen?: number }[];
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
    const total = await this.prisma.move.count({ where });
    let sql = `
      SELECT * FROM "Move" WHERE 1=1
    `;
    const params: any[] = [];
    if (search) {
      sql += ' AND ("nameZh" LIKE ? OR "nameEn" LIKE ? OR "nameJa" LIKE ?)';
      const needle = `%${search}%`;
      params.push(needle, needle, needle);
    }
    if (type) {
      sql += ' AND "type" = ?';
      params.push(type);
    }
    if (category) {
      sql += ' AND "category" = ?';
      params.push(category);
    }
    sql += `
      ORDER BY CASE WHEN "id" GLOB '[0-9]*' THEN 0 ELSE 1 END,
               CAST(REPLACE("id", 'z-', '') AS INTEGER), "id"
      LIMIT ? OFFSET ?
    `;
    params.push(sizeNum, (pageNum - 1) * sizeNum);
    const items = (await this.prisma.$queryRawUnsafe(sql, ...params)) as Move[];
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
      level?: string,
      gen?: number,
    ) => {
      if (!map.has(moveName)) map.set(moveName, new Map());
      const bucket = map.get(moveName)!;
      const key = `${id}|${method}`;
      if (!bucket.has(key)) {
        bucket.set(key, { id, nameZh, image, methods: [] });
      }
      const entry = bucket.get(key)!;
      if (!entry.methods.some((m) => m.method === method && (m.level || '') === (level || '') && m.gen === gen)) {
        entry.methods.push({ method, level: level || undefined, gen });
      }
    };

    // 1. 从 Prisma DB 加载
    const all = await this.prisma.pokemon.findMany({
      select: { id: true, nameZh: true, image: true, detail: true, gen: true },
    });
    const idToName = new Map<string, { nameZh: string; image: string | null }>();
    for (const p of all) {
      idToName.set(p.id, { nameZh: p.nameZh, image: p.image });
      const d = JSON.parse(p.detail);
      for (const mm of d.learnable_moves ?? []) {
        for (const it of mm.data ?? []) {
          if (it?.name) add(it.name, p.id, p.nameZh, p.image, '升级', it.level, p.gen ?? undefined);
        }
      }
      for (const mm of d.machine_moves ?? []) {
        for (const it of mm.data ?? []) {
          if (it?.name) add(it.name, p.id, p.nameZh, p.image, '机器', undefined, p.gen ?? undefined);
        }
      }
      for (const mm of d.egg_moves ?? []) {
        for (const it of mm.data ?? []) {
          if (it?.name) add(it.name, p.id, p.nameZh, p.image, '蛋', undefined, p.gen ?? undefined);
        }
      }
    }

    // 2. 从 moves_by_gen.json 补充（全世代 learnable + machine + tutor）
    const jsonPath = join(__dirname, '..', '..', 'data', 'moves_by_gen.json');
    if (existsSync(jsonPath)) {
      const raw = JSON.parse(readFileSync(jsonPath, 'utf-8'));
      for (const gen of Object.keys(raw)) {
        const genNum = Number(gen);
        for (const [id, species] of Object.entries(raw[gen])) {
          const info = idToName.get(id);
          if (!info) continue;
          const s = species as any;
          for (const m of (s.learnable || [])) {
            if (m?.name) add(m.name, id, info.nameZh, info.image, '升级', m.level, genNum);
          }
          for (const m of (s.machine || [])) {
            if (m?.name) add(m.name, id, info.nameZh, info.image, '机器', undefined, genNum);
          }
          for (const m of (s.tutor || [])) {
            if (m?.name) add(m.name, id, info.nameZh, info.image, '教授', undefined, genNum);
          }
          for (const m of (s.egg || [])) {
            if (m?.name) add(m.name, id, info.nameZh, info.image, '蛋', undefined, genNum);
          }
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
    let extra: any = null;
    const extraPath = join(__dirname, '..', '..', 'data', 'moves_extra.json');
    if (existsSync(extraPath)) {
      try {
        const all = JSON.parse(readFileSync(extraPath, 'utf-8'));
        extra = all[id] || null;
      } catch {}
    }
    return {
      ...move,
      machines: (await this.machines()).get(move.nameZh) ?? [],
      learners: (await this.learners()).get(move.nameZh) ?? [],
      extra,
    };
  }
}
