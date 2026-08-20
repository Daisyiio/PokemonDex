import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PokemonListQuery {
  search?: string;
  type?: string;
  gen?: number;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class PokemonService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: PokemonListQuery) {
    const { search, type, gen, page = 1, pageSize = 24 } = query;
    const pageNum = Math.max(1, Number(page) || 1);
    const sizeNum = Math.min(100, Math.max(1, Number(pageSize) || 24));
    const where: Prisma.PokemonWhereInput = {};

    if (search) {
      where.OR = [
        { nameZh: { contains: search } },
        { nameEn: { contains: search } },
        { nameJa: { contains: search } },
        { id: { contains: search } },
      ];
    }
    if (type) {
      where.types = { contains: type };
    }
    if (gen) {
      where.gen = Number(gen);
    }

    const [total, items] = await this.prisma.$transaction([
      this.prisma.pokemon.count({ where }),
      this.prisma.pokemon.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
      }),
    ]);

    return {
      total,
      page: pageNum,
      pageSize: sizeNum,
      items: items.map((p) => ({
        id: p.id,
        nameZh: p.nameZh,
        nameEn: p.nameEn,
        types: JSON.parse(p.types),
        gen: p.gen,
        image: p.image,
      })),
    };
  }

  async types() {
    const all = await this.prisma.pokemon.findMany({ select: { types: true } });
    const map = new Map<string, number>();
    for (const p of all) {
      for (const t of JSON.parse(p.types) as string[]) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }

  async ids() {
    return this.prisma.pokemon.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, nameZh: true },
    });
  }

  async eggGroups() {
    const all = await this.prisma.pokemon.findMany({
      select: { id: true, nameZh: true, nameEn: true, image: true, types: true, detail: true },
    });
    const groups = new Map<string, { name: string; members: { id: string; nameZh: string; nameEn: string | null; image: string | null; types: string[] }[] }>();
    for (const p of all) {
      const detail = JSON.parse(p.detail);
      const eggs = (detail.forms?.[0]?.egg_groups || []) as string[];
      const names = new Set<string>();
      for (const g of eggs) {
        const n = this.normalizeEggGroup(g);
        if (n) names.add(n);
      }
      const member = {
        id: p.id,
        nameZh: p.nameZh,
        nameEn: p.nameEn,
        image: p.image,
        types: JSON.parse(p.types) as string[],
      };
      for (const n of names) {
        let g = groups.get(n);
        if (!g) {
          g = { name: n, members: [] };
          groups.set(n, g);
        }
        g.members.push(member);
      }
    }
    return Array.from(groups.values())
      .map((g) => ({ name: g.name, count: g.members.length, members: g.members }))
      .sort((a, b) => b.count - a.count);
  }

  private normalizeEggGroup(raw: string): string {
    let name = raw.trim();
    if (name.endsWith('群')) name = name.slice(0, -1);
    if (name === '未知蛋') name = '未知';
    return name;
  }

  async detail(id: string) {
    const p = await this.prisma.pokemon.findUnique({ where: { id } });
    if (!p) return null;
    const detail = JSON.parse(p.detail);
    return {
      ...detail,
      _meta: {
        id: p.id,
        gen: p.gen,
        filter: p.filter,
        icon: p.icon,
        image: p.image,
      },
    };
  }
}
