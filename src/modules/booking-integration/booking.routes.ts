import { Router, Request, Response, NextFunction } from 'express';
import { ReservaRepository }  from '../reservas/reserva.repository.js';
import { AlquilerRepository } from '../alquileres/alquiler.repository.js';
import prisma from '../../shared/database/prisma.js';

const INVENTARIO_URL = process.env['INVENTARIO_SERVICE_URL'] ?? 'http://localhost:3002';

async function fetchVehiculo(vehiculoId: string): Promise<any | null> {
  try {
    const res = await fetch(`${INVENTARIO_URL}/api/v1/emilypamela/vehiculos/${vehiculoId}`);
    if (!res.ok) return null;
    const body = await res.json() as { success: boolean; data: any };
    return body.success ? body.data : null;
  } catch { return null; }
}

function generarCodigo(): string {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `RES-${ts}-${rnd}`;
}

function calcularDias(inicio: string, fin: string): number {
  const ms = new Date(fin).getTime() - new Date(inicio).getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

function toReservaBookingDto(reserva: any) {
  return {
    id:            reserva.id,
    codigoReserva: reserva.codigoReserva,
    vehiculoId:    reserva.vehiculoId,
    clienteId:     reserva.usuarioId,
    agenciaId:     reserva.agenciaId,
    fechaInicio:   reserva.fechaInicio,
    fechaFin:      reserva.fechaFin,
    diasTotal:     reserva.diasTotal,
    totalAmount:   Number(reserva.totalAmount),
    status:        reserva.status,
  };
}

// ── /reservas/booking ────────────────────────────────────────────────────────
export function createReservaBookingRouter(reservaRepo: ReservaRepository): Router {
  const router = Router();

  // GET /api/v1/emilypamela/reservas/booking/:id
  router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reserva = await reservaRepo.findById(req.params['id'] as string);
      if (!reserva) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Reserva ${req.params['id']} no encontrada` } });
        return;
      }
      res.json({ success: true, data: toReservaBookingDto(reserva) });
    } catch (err) { next(err); }
  });

  // POST /api/v1/emilypamela/reservas/booking
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { vehiculoId, clienteId, agenciaId: bodyAgenciaId, fechaInicio, fechaFin } = req.body;

      if (!vehiculoId || !clienteId || !fechaInicio || !fechaFin) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'vehiculoId, clienteId, fechaInicio y fechaFin son requeridos' } });
        return;
      }

      const vehiculo = await fetchVehiculo(vehiculoId);
      if (!vehiculo) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Vehiculo ${vehiculoId} no encontrado` } });
        return;
      }
      if (vehiculo.status !== 'DISPONIBLE') {
        res.status(422).json({ success: false, error: { code: 'VEHICLE_NOT_AVAILABLE', message: 'El vehículo no está disponible' } });
        return;
      }

      const agenciaId = bodyAgenciaId ?? vehiculo.agenciaId;
      if (!agenciaId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No se pudo determinar agenciaId del vehículo' } });
        return;
      }

      const dias       = calcularDias(fechaInicio, fechaFin);
      const precioBase = Number(vehiculo.precioDia) * dias;

      const reserva = await reservaRepo.create({
        usuarioId:    clienteId,
        vehiculoId,
        agenciaId,
        fechaInicio,
        fechaFin,
        diasTotal:    dias,
        precioBase,
        precioExtras: 0,
        precioSeguro: 0,
        totalAmount:  precioBase,
        codigoReserva: generarCodigo(),
      });

      res.status(201).json({ success: true, data: toReservaBookingDto(reserva) });
    } catch (err) { next(err); }
  });

  // PATCH /api/v1/emilypamela/reservas/booking/:id
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const reserva = await reservaRepo.findById(req.params['id'] as string);
      if (!reserva) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Reserva ${req.params['id']} no encontrada` } });
        return;
      }
      const updated = await reservaRepo.update(req.params['id'] as string, { status: req.body.status });
      res.json({ success: true, data: toReservaBookingDto(updated) });
    } catch (err) { next(err); }
  });

  return router;
}

// ── /alquileres/booking ──────────────────────────────────────────────────────
export function createAlquilerBookingRouter(alquilerRepo: AlquilerRepository): Router {
  const router = Router();

  // POST /api/v1/emilypamela/alquileres/booking
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { reservaId, kmSalida, fechaInicio, observaciones } = req.body;

      if (!reservaId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'reservaId es requerido' } });
        return;
      }

      const reserva = await prisma.reserva.findUnique({ where: { id: reservaId } });
      if (!reserva) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Reserva ${reservaId} no encontrada` } });
        return;
      }
      if (reserva.status !== 'CONFIRMADA') {
        res.status(422).json({ success: false, error: { code: 'INVALID_STATUS', message: 'Solo se puede iniciar un alquiler de una reserva CONFIRMADA' } });
        return;
      }

      const existente = await alquilerRepo.findByReservaId(reservaId);
      if (existente) {
        res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Ya existe un alquiler para esta reserva' } });
        return;
      }

      const alquiler = await prisma.$transaction(async (tx) => {
        const a = await tx.alquiler.create({
          data: {
            reservaId,
            kmSalida,
            fechaInicio: fechaInicio ? new Date(fechaInicio) : new Date(),
            observaciones,
            status: 'ACTIVO',
          },
        });
        await tx.reserva.update({ where: { id: reservaId }, data: { status: 'ACTIVA' } });
        return a;
      });

      // Notify inventario-service to update vehiculo status (best-effort, cross-service)
      if (reserva.vehiculoId) {
        fetch(`${INVENTARIO_URL}/api/v1/emilypamela/vehiculos/${reserva.vehiculoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization ?? '' },
          body: JSON.stringify({ status: 'EN_USO' }),
        }).catch(() => {});
      }

      const result = await alquilerRepo.findById(alquiler.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  });

  return router;
}

// ── /devoluciones/booking ────────────────────────────────────────────────────
export function createDevolucionBookingRouter(alquilerRepo: AlquilerRepository): Router {
  const router = Router();

  // POST /api/v1/emilypamela/devoluciones/booking
  router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { alquilerId, kmEntrada, estadoVehiculo, cargoExtra = 0, observaciones } = req.body;

      if (!alquilerId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'alquilerId es requerido' } });
        return;
      }

      const alquiler = await alquilerRepo.findById(alquilerId);
      if (!alquiler) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Alquiler ${alquilerId} no encontrado` } });
        return;
      }
      if (alquiler.status !== 'ACTIVO') {
        res.status(422).json({ success: false, error: { code: 'INVALID_STATUS', message: 'El alquiler no está activo' } });
        return;
      }

      const existente = await alquilerRepo.findDevolucion(alquilerId);
      if (existente) {
        res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'Este alquiler ya tiene una devolución registrada' } });
        return;
      }

      // Fetch vehiculoId from reserva before transaction (Reserva is in this schema)
      const reservaObj = await prisma.reserva.findUnique({ where: { id: alquiler.reservaId! } });

      const devolucion = await prisma.$transaction(async (tx) => {
        const d = await tx.devolucion.create({
          data: { alquilerId, kmEntrada, estadoVehiculo, cargoExtra, observaciones },
        });
        await tx.alquiler.update({
          where: { id: alquilerId },
          data:  { status: 'FINALIZADO', kmEntrada, fechaFin: new Date(), cargoAdicional: cargoExtra },
        });
        await tx.reserva.update({ where: { id: alquiler.reservaId! }, data: { status: 'COMPLETADA' } });
        return d;
      });

      // Notify inventario-service to release vehiculo (best-effort, cross-service)
      if (reservaObj?.vehiculoId) {
        fetch(`${INVENTARIO_URL}/api/v1/emilypamela/vehiculos/${reservaObj.vehiculoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: req.headers.authorization ?? '' },
          body: JSON.stringify({ status: 'DISPONIBLE', kilometraje: kmEntrada }),
        }).catch(() => {});
      }

      res.status(201).json({ success: true, data: devolucion });
    } catch (err) { next(err); }
  });

  return router;
}
