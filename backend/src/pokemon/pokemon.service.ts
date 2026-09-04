import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { readdirSync, existsSync } from 'fs';
import { join } from 'path';
import { registerCacheResetter } from '../cache-guard';

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

  private static spritesCache: Record<string, any> | null = null;
  private static typesCache: { name: string; count: number }[] | null = null;
  private static idsCache: { id: string; nameZh: string }[] | null = null;
  private static eggGroupsCache: any = null;

  static resetCaches(): void {
    PokemonService.spritesCache = null;
    PokemonService.typesCache = null;
    PokemonService.idsCache = null;
    PokemonService.eggGroupsCache = null;
  }

  spritesIndex(): Record<string, any> {
    if (PokemonService.spritesCache) return PokemonService.spritesCache;

    const imagesDir = join(__dirname, '..', '..', 'public', 'images');
    const index: Record<string, any> = {};

    const officialFiles = existsSync(join(imagesDir, 'official')) ? readdirSync(join(imagesDir, 'official')) : [];
    const homeFiles = existsSync(join(imagesDir, 'home')) ? readdirSync(join(imagesDir, 'home')) : [];
    const dreamFiles = existsSync(join(imagesDir, 'dream')) ? readdirSync(join(imagesDir, 'dream')) : [];
    const pixelFiles = existsSync(join(imagesDir, 'pixel-assets', 'pokemon')) ? readdirSync(join(imagesDir, 'pixel-assets', 'pokemon')) : [];

    const pixelByInt = new Map<number, string>();
    for (const f of pixelFiles) {
      const m = /^(\d+)\.png$/.exec(f);
      if (m) pixelByInt.set(Number(m[1]), f);
    }

    const buildEntry = (id: string, intId: number, dreamEn?: string): any => {
      const entry: any = {};

      const pickPrefixed = (files: string[], preferPlain: boolean): string | null => {
        const prefixed = files.filter((f) => /^\d{4}-/.test(f) && f.slice(0, 4) === id);
        if (prefixed.length === 0) return null;
        if (preferPlain) {
          const nonShiny = prefixed.filter((f) => !f.includes('-shiny'));
          const base = nonShiny.find(
            (f) => !/-(雄性|雌性|超极巨化|超级|戴着|换装|搭档|初始|世界|Mega|Gigantamax)/i.test(f)
          );
          return base ?? nonShiny[0] ?? prefixed[0];
        }
        return prefixed[0];
      };

      const officialFile = pickPrefixed(officialFiles, true);
      if (officialFile) entry.official = `/images/official/${encodeURIComponent(officialFile)}`;

      const homeFile = pickPrefixed(homeFiles, true);
      if (homeFile) entry.home = `/images/home/${encodeURIComponent(homeFile)}`;

      const pixelFile = pixelByInt.get(intId);
      if (pixelFile) entry.pixel = `/images/pixel-assets/pokemon/${pixelFile}`;

      if (dreamEn) {
        const norm = (s: string) => s.replace(/\s+/g, '_').toLowerCase();
        const target = norm(dreamEn);
        const candidates = dreamFiles.filter((f) => {
          const m = /^\d+(.+)_Dream\.png$/.exec(f);
          return m && norm(m[1]) === target;
        });
        if (candidates.length > 0) {
          const base = candidates.find((f) => !/-/.test(f));
          entry.dream = `/images/dream/${encodeURIComponent(base ?? candidates[0])}`;
        }
      }

      return entry;
    };

    // dream 文件名形如 001Bulbasaur_Dream.png / 122Mr._Mime_Dream.png：从文件名提取 id → 英文名
    const dreamEnById = new Map<number, string>();
    for (const f of dreamFiles) {
      const m = /^(\d+)(.+)_Dream\.png$/.exec(f);
      if (m) {
        const intId = Number(m[1]);
        const existing = dreamEnById.get(intId);
        // 优先保留基础形态名（不含 - 形态后缀）
        if (!existing || (existing.includes('-') && !m[2].includes('-'))) {
          dreamEnById.set(intId, m[2]);
        }
      }
    }

    // 覆盖到最大 id（official/home/dream/pixel 合并）
    const maxId = Math.max(1025, ...pixelByInt.keys(), ...dreamEnById.keys(), 1025);
    for (let i = 1; i <= maxId; i++) {
      const id = String(i).padStart(4, '0');
      const en = dreamEnById.get(i);
      index[id] = buildEntry(id, i, en);
    }

    PokemonService.spritesCache = index;
    return index;
  }

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
      const types = type.split(',').map(t => t.trim()).filter(Boolean);
      if (types.length === 1) {
        where.types = { contains: types[0] };
      } else if (types.length > 1) {
        where.AND = types.map(t => ({ types: { contains: t } }));
      }
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
    if (PokemonService.typesCache) return PokemonService.typesCache;
    const all = await this.prisma.pokemon.findMany({ select: { types: true } });
    const map = new Map<string, number>();
    for (const p of all) {
      for (const t of JSON.parse(p.types) as string[]) {
        map.set(t, (map.get(t) || 0) + 1);
      }
    }
    PokemonService.typesCache = Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
    return PokemonService.typesCache;
  }

  async ids() {
    if (PokemonService.idsCache) return PokemonService.idsCache;
    PokemonService.idsCache = await this.prisma.pokemon.findMany({
      orderBy: { id: 'asc' },
      select: { id: true, nameZh: true },
    });
    return PokemonService.idsCache;
  }

  async eggGroups() {
    if (PokemonService.eggGroupsCache) return PokemonService.eggGroupsCache;
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
    PokemonService.eggGroupsCache = Array.from(groups.values())
      .map((g) => ({ name: g.name, count: g.members.length, members: g.members }))
      .sort((a, b) => b.count - a.count);
    return PokemonService.eggGroupsCache;
  }

  private normalizeEggGroup(raw: string): string {
    let name = raw.trim();
    if (name.endsWith('群')) name = name.slice(0, -1);
    if (name === '未知蛋') name = '未知';
    return name;
  }

  async detail(id: string) {
    // 先尝试精确匹配
    let p = await this.prisma.pokemon.findUnique({ where: { id } });
    // 如果找不到且 ID 带地区后缀（如 0079G），去掉后缀查基础形态
    let formSuffix = '';
    if (!p && /^[A-Z]$/.test(id.slice(-1))) {
      formSuffix = id.slice(-1);
      const baseId = id.slice(0, -1);
      p = await this.prisma.pokemon.findUnique({ where: { id: baseId } });
    }
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
        formSuffix,
      },
    };
  }

  async encounters(id: string) {
    // 去掉地区后缀查基础形态
    const baseId = /^[A-Z]$/.test(id.slice(-1)) ? id.slice(0, -1) : id;
    const p = await this.prisma.pokemon.findUnique({ where: { id: baseId } });
    if (!p) return null;
    if (!p.encounters) return [];
    try {
      return JSON.parse(p.encounters);
    } catch {
      return [];
    }
  }
}

registerCacheResetter('pokemon', () => PokemonService.resetCaches());
