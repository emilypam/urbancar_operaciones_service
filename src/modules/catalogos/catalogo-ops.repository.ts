import { PrismaClient } from '@prisma/client';

export class CatalogoOpsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  // ── Seguros ───────────────────────────────────────────────────────────────────
  findAllSeguros(onlyActive = false) {
    return this.prisma.seguro.findMany({
      where:   onlyActive ? { isActive: true } : undefined,
      orderBy: { nombre: 'asc' },
    });
  }
  findSeguroById(id: string) {
    return this.prisma.seguro.findUnique({ where: { id } });
  }
  createSeguro(data: any) {
    return this.prisma.seguro.create({ data });
  }
  updateSeguro(id: string, data: any) {
    return this.prisma.seguro.update({ where: { id }, data });
  }
  deleteSeguro(id: string) {
    return this.prisma.seguro.update({ where: { id }, data: { isActive: false } });
  }

  // ── Tarifas ───────────────────────────────────────────────────────────────────
  findAllTarifas(categoriaId?: string, onlyActive = false) {
    return this.prisma.tarifa.findMany({
      where: {
        ...(categoriaId && { categoriaId }),
        ...(onlyActive   && { isActive: true }),
      },
      orderBy: { nombre: 'asc' },
    });
  }
  findTarifaById(id: string) {
    return this.prisma.tarifa.findUnique({ where: { id } });
  }
  createTarifa(data: any) {
    return this.prisma.tarifa.create({ data });
  }
  updateTarifa(id: string, data: any) {
    return this.prisma.tarifa.update({ where: { id }, data });
  }
  deleteTarifa(id: string) {
    return this.prisma.tarifa.update({ where: { id }, data: { isActive: false } });
  }

  // ── Canales de Venta ──────────────────────────────────────────────────────────
  findAllCanales() {
    return this.prisma.canalVenta.findMany({ orderBy: { nombre: 'asc' } });
  }
  findCanalById(id: string) {
    return this.prisma.canalVenta.findUnique({ where: { id } });
  }
  createCanal(data: { nombre: string; codigo: string }) {
    return this.prisma.canalVenta.create({ data });
  }
  deleteCanal(id: string) {
    return this.prisma.canalVenta.delete({ where: { id } });
  }
}
