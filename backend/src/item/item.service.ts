import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

@Injectable()
export class ItemService {
  constructor(private readonly prisma: PrismaService) {}

  private static extraCache: Record<string, any> | null = null;
  private static pokeCache: Record<string, any> | null = null;

  private loadExtra() {
    if (ItemService.extraCache) return ItemService.extraCache;
    const path = join(__dirname, '..', '..', 'data', 'items_extra.json');
    if (existsSync(path)) {
      try {
        ItemService.extraCache = JSON.parse(readFileSync(path, 'utf-8'));
      } catch {
        ItemService.extraCache = {};
      }
    } else {
      ItemService.extraCache = {};
    }
    return ItemService.extraCache;
  }

  // PokeAPI 数据：按 ourId 索引，方便道具详情查询
  private loadPoke() {
    if (ItemService.pokeCache) return ItemService.pokeCache;
    const path = join(__dirname, '..', '..', 'data', 'items_pokeapi.json');
    const byId: Record<string, any> = {};
    if (existsSync(path)) {
      try {
        const raw = JSON.parse(readFileSync(path, 'utf-8'));
        for (const v of Object.values(raw) as any[]) {
          if (v?.ourId) byId[String(v.ourId)] = v;
        }
      } catch {}
    }
    ItemService.pokeCache = byId;
    return ItemService.pokeCache;
  }

  async detail(id: string) {
    const item = await this.prisma.item.findUnique({ where: { id: Number(id) } });
    if (!item) return null;
    const extra = this.loadExtra()[id] || null;
    const poke = this.loadPoke()[id] || null;
    return {
      ...item,
      extra,
      poke,
    };
  }

  async list(search?: string, category?: string, page?: number, pageSize?: number) {
    const where: Prisma.ItemWhereInput = { type: 'item' };
    if (search) {
      where.OR = [
        { nameZh: { contains: search } },
        { nameEn: { contains: search } },
        { nameJa: { contains: search } },
      ];
    }
    if (category) where.category = category;
    const pageNum = Math.max(1, Number(page) || 1);
    const sizeNum = Math.min(200, Math.max(1, Number(pageSize) || 50));
    const [total, items] = await this.prisma.$transaction([
      this.prisma.item.count({ where }),
      this.prisma.item.findMany({
        where,
        orderBy: { id: 'asc' },
        skip: (pageNum - 1) * sizeNum,
        take: sizeNum,
      }),
    ]);
    return { total, page: pageNum, pageSize: sizeNum, items };
  }

  async categories() {
    const rows = await this.prisma.item.findMany({
      where: { type: 'category' },
      select: { id: true, nameZh: true },
      orderBy: { id: 'asc' },
    });
    const seen = new Set<string>();
    const categories: { id: number; nameZh: string }[] = [];
    for (const r of rows) {
      if (seen.has(r.nameZh)) continue;
      seen.add(r.nameZh);
      categories.push(r);
    }
    return categories;
  }
}
