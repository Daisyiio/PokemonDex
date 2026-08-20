import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PokedexService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const dexes = await this.prisma.pokedex.findMany({
      orderBy: { id: 'asc' },
    });
    return dexes.map((d) => ({
      name: d.name,
      count: JSON.parse(d.data).length,
    }));
  }

  async get(name: string) {
    const dex = await this.prisma.pokedex.findUnique({ where: { name } });
    if (!dex) return null;
    return {
      name: dex.name,
      entries: JSON.parse(dex.data),
    };
  }
}
