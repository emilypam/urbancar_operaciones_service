import { PrismaClient } from '@prisma/client';

const RESERVA_INCLUDE = {
  seguro:    true,
  canalVenta: true,
  extras:    true,
} as const;

interface ReservaFilters {
  usuarioId?:  string;
  vehiculoId?: string;
  agenciaId?:  string;
  status?:     string;
}

export class ReservaRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findAll(page = 1, limit = 20, filters: ReservaFilters = {}) {
    const where: any = {};
    if (filters.usuarioId)  where.usuarioId  = filters.usuarioId;
    if (filters.vehiculoId) where.vehiculoId = filters.vehiculoId;
    if (filters.agenciaId)  where.agenciaId  = filters.agenciaId;
    if (filters.status)     where.status      = filters.status;

    const [total, data] = await Promise.all([
      this.prisma.reserva.count({ where }),
      this.prisma.reserva.findMany({
        where,
        skip:    (page - 1) * limit,
        take:    limit,
        include: RESERVA_INCLUDE,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  findById(id: string) {
    return this.prisma.reserva.findUnique({ where: { id }, include: RESERVA_INCLUDE });
  }

  findByCodigoReserva(codigo: string) {
    return this.prisma.reserva.findUnique({ where: { codigoReserva: codigo }, include: RESERVA_INCLUDE });
  }

  async create(data: {
    usuarioId:    string;
    vehiculoId:   string;
    agenciaId:    string;
    seguroId?:    string;
    canalVentaId?: string;
    fechaInicio:  string;
    fechaFin:     string;
    diasTotal:    number;
    precioBase:   number;
    precioExtras: number;
    precioSeguro: number;
    totalAmount:  number;
    codigoReserva: string;
    notas?:       string;
    extras?: Array<{ extraId: string; cantidad: number; precioDia: number; subtotal: number }>;
  }) {
    const { extras, fechaInicio, fechaFin, ...rest } = data;
    return this.prisma.reserva.create({
      data: {
        ...rest,
        fechaInicio: new Date(`${fechaInicio}T00:00:00.000Z`),
        fechaFin:    new Date(`${fechaFin}T00:00:00.000Z`),
        ...(extras?.length && {
          extras: { create: extras },
        }),
      },
      include: RESERVA_INCLUDE,
    });
  }

  update(id: string, data: any) {
    return this.prisma.reserva.update({ where: { id }, data, include: RESERVA_INCLUDE });
  }

  findSeguroById(id: string) {
    return this.prisma.seguro.findUnique({ where: { id } });
  }

  // Extras de una reserva
  findExtras(reservaId: string) {
    return this.prisma.reservaExtra.findMany({
      where: { reservaId },
    });
  }

  addExtra(reservaId: string, extraId: string, precioDia: number, cantidad: number) {
    const subtotal = precioDia * cantidad;
    return this.prisma.reservaExtra.create({
      data: { reservaId, extraId, precioDia, cantidad, subtotal },
    });
  }

  removeExtra(reservaId: string, extraId: string) {
    return this.prisma.reservaExtra.delete({
      where: { reservaId_extraId: { reservaId, extraId } },
    });
  }
}
