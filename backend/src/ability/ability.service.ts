import { Injectable } from '@nestjs/common';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { resolveDatasetPath } from '../dataset-path';

export interface AbilityLearner {
  id: string;
  nameZh: string;
  image: string | null;
  methods: string[];
}

@Injectable()
export class AbilityService {
  constructor(private readonly prisma: PrismaService) {}

  private static learnersCache: Map<string, AbilityLearner[]> | null = null;

  private learners(): Map<string, AbilityLearner[]> {
    if (AbilityService.learnersCache) return AbilityService.learnersCache;
    const map = new Map<string, Map<string, AbilityLearner>>();
    const base = join(resolveDatasetPath(), 'data', 'pokemon');
    for (const f of readdirSync(base)) {
      if (!f.endsWith('.json')) continue;
      const d = JSON.parse(readFileSync(join(base, f), 'utf8'));
      const id = d.pokedex_id;
      const nameZh = d.name_zh;
      const image = d.forms?.[0]?.image ?? null;
      for (const form of d.forms ?? []) {
        for (const ab of form.abilities ?? []) {
          if (!ab?.name) continue;
          if (!map.has(ab.name)) map.set(ab.name, new Map());
          const bucket = map.get(ab.name)!;
          if (!bucket.has(id)) {
            bucket.set(id, { id, nameZh, image, methods: [] });
          }
          const learner = bucket.get(id)!;
          const method = ab.is_hidden ? '隐藏' : '普通';
          if (!learner.methods.includes(method)) learner.methods.push(method);
        }
      }
    }
    const out = new Map<string, AbilityLearner[]>();
    for (const [k, v] of map) {
      out.set(k, [...v.values()].sort((a, b) => a.id.localeCompare(b.id)));
    }
    AbilityService.learnersCache = out;
    return out;
  }

  async detail(id: string) {
    const ability = await this.prisma.ability.findUnique({ where: { id } });
    if (!ability) return null;
    return {
      ...ability,
      learners: this.learners().get(ability.nameZh) ?? [],
    };
  }

  async list(search?: string, page?: number, pageSize?: number) {
    const where: Prisma.AbilityWhereInput = {};
    if (search) {
      where.OR = [
        { nameZh: { contains: search } },
        { nameEn: { contains: search } },
        { nameJa: { contains: search } },
      ];
    }
    const pageNum = Math.max(1, Number(page) || 1);
    const sizeNum = Math.min(200, Math.max(1, Number(pageSize) || 50));
    const [total, items] = await this.prisma.$transaction([
      this.prisma.ability.count({ where }),
      this.prisma.ability.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
      }),
    ]);
    return { total, page: pageNum, pageSize: sizeNum, items };
  }
}
