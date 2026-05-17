import { PrismaClient } from '@prisma/client';

const ALQUILER_INCLUDE = {
  reserva:    true,
  devolucion: true,
} as const;

export class AlquilerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(page = 1, limit = 20, status?: string) {
    const where: any = {};
    if (status) where.status = status;

    const [total, data] = await Promise.all([
      this.prisma.alquiler.count({ where }),
      this.prisma.alquiler.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        include: ALQUILER_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findById(id: string) {
    return this.prisma.alquiler.findUnique({ where: { id }, include: ALQUILER_INCLUDE });
  }

  findByReservaId(reservaId: string) {
    return this.prisma.alquiler.findUnique({ where: { reservaId }, include: ALQUILER_INCLUDE });
  }

  create(data: any) {
    return this.prisma.alquiler.create({ data, include: ALQUILER_INCLUDE });
  }

  update(id: string, data: any) {
    return this.prisma.alquiler.update({ where: { id }, data, include: ALQUILER_INCLUDE });
  }

  // Devolución
  findDevolucion(alquilerId: string) {
    return this.prisma.devolucion.findUnique({ where: { alquilerId } });
  }

  createDevolucion(alquilerId: string, data: any) {
    return this.prisma.devolucion.create({
      data: { alquilerId, ...data },
    });
  }
}
