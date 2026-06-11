import { ReservaRepository } from '../reserva.repository.js';
import { publish } from '../../../messaging/publisher.js';
import { NotFoundException, ValidationException } from '../../../shared/errors/BusinessException.js';

const INVENTARIO_URL = process.env.INVENTARIO_SERVICE_URL ?? 'http://localhost:3002';

async function fetchInventario<T>(path: string): Promise<T | null> {
  try {
    const res  = await fetch(`${INVENTARIO_URL}${path}`);
    if (!res.ok) return null;
    const body = await res.json() as { success: boolean; data: T };
    return body.success ? body.data : null;
  } catch { return null; }
}

function calcularDias(inicio: string, fin: string): number {
  const ms = new Date(fin).getTime() - new Date(inicio).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function generarCodigo(): string {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `RES-${ts}-${rnd}`;
}

export class ReservaServiceV2 {
  constructor(private readonly repo: ReservaRepository) {}

  async crearReserva(body: any, usuarioId: string) {
    const { vehiculoId, agenciaId, seguroId, canalVentaId, fechaInicio, fechaFin, notas, extras } = body;

    // Lectura sincrónica — necesitamos precio y disponibilidad antes de crear
    const vehiculo = await fetchInventario<{ id: string; precioDia: string; status: string }>(
      `/api/v1/emilypamela/vehiculos/${vehiculoId}`,
    );
    if (!vehiculo) throw new NotFoundException('Vehiculo', vehiculoId);
    if (vehiculo.status !== 'DISPONIBLE') throw new ValidationException('El vehículo no está disponible');

    const dias       = calcularDias(fechaInicio, fechaFin);
    const precioBase = Number(vehiculo.precioDia) * dias;

    let precioSeguro = 0;
    if (seguroId) {
      const seguro = await this.repo.findSeguroById(seguroId);
      if (seguro) precioSeguro = Number(seguro.precioDia) * dias;
    }

    let precioExtras = 0;
    const extrasData: any[] = [];
    if (extras?.length) {
      for (const e of extras) {
        const extra = await fetchInventario<{ id: string; precioDia: string }>(
          `/api/v1/emilypamela/extras/${e.extraId}`,
        );
        if (!extra) throw new NotFoundException('Extra', e.extraId);
        const subtotal = Number(extra.precioDia) * e.cantidad * dias;
        precioExtras += subtotal;
        extrasData.push({ extraId: e.extraId, cantidad: e.cantidad, precioDia: Number(extra.precioDia), subtotal });
      }
    }

    const reserva = await this.repo.create({
      usuarioId, vehiculoId, agenciaId, seguroId, canalVentaId,
      fechaInicio, fechaFin, diasTotal: dias,
      precioBase, precioExtras, precioSeguro,
      totalAmount:   precioBase + precioExtras + precioSeguro,
      codigoReserva: generarCodigo(),
      notas,
      extras: extrasData,
    });

    // V2: publicar evento — inventario-service actualiza el estado del vehículo al consumirlo
    publish('reservas.reserva.creada', reserva.id, {
      reservaId:   reserva.id,
      vehiculoId,
      usuarioId,
      agenciaId,
      totalAmount: reserva.totalAmount,
      fechaInicio,
      fechaFin,
    });

    return reserva;
  }

  async cancelarReserva(id: string, usuarioId?: string) {
    const reserva = await this.repo.findById(id);
    if (!reserva) throw new NotFoundException('Reserva', id);
    if (reserva.status === 'COMPLETADA' || reserva.status === 'CANCELADA') {
      throw new ValidationException(`No se puede cancelar una reserva en estado ${reserva.status}`);
    }

    const cancelled = await this.repo.update(id, { status: 'CANCELADA' });

    publish('reservas.reserva.cancelada', id, {
      reservaId:  id,
      vehiculoId: reserva.vehiculoId,
      usuarioId,
    });

    return cancelled;
  }

  async confirmarReserva(id: string, usuarioId?: string) {
    const reserva = await this.repo.findById(id);
    if (!reserva) throw new NotFoundException('Reserva', id);

    const confirmed = await this.repo.update(id, { status: 'CONFIRMADA' });

    publish('reservas.reserva.confirmada', id, {
      reservaId:  id,
      vehiculoId: reserva.vehiculoId,
      usuarioId,
    });

    return confirmed;
  }
}
