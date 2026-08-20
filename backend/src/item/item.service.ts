import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ItemService {
  constructor(private readonly prisma: PrismaService) {}

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
    const categories = await this.prisma.item.findMany({
      where: { type: 'category' },
      select: { id: true, nameZh: true },
      orderBy: { id: 'asc' },
    });
    return categories;
  }
}
