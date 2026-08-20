import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

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

  private async learners(): Promise<Map<string, AbilityLearner[]>> {
    if (AbilityService.learnersCache) return AbilityService.learnersCache;
    const map = new Map<string, Map<string, AbilityLearner>>();
    const all = await this.prisma.pokemon.findMany({
      select: { id: true, nameZh: true, image: true, detail: true },
    });
    for (const p of all) {
      const d = JSON.parse(p.detail);
      for (const form of d.forms ?? []) {
        for (const ab of form.abilities ?? []) {
          if (!ab?.name) continue;
          if (!map.has(ab.name)) map.set(ab.name, new Map());
          const bucket = map.get(ab.name)!;
          if (!bucket.has(p.id)) {
            bucket.set(p.id, { id: p.id, nameZh: p.nameZh, image: p.image, methods: [] });
          }
          const learner = bucket.get(p.id)!;
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
      learners: (await this.learners()).get(ability.nameZh) ?? [],
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
