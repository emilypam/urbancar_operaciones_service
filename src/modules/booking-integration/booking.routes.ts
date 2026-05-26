import { Router, Request, Response, NextFunction } from 'express';
import { ReservaRepository }  from '../reservas/reserva.repository.js';
import { AlquilerRepository } from '../alquileres/alquiler.repository.js';
import prisma from '../../shared/database/prisma.js';
import jwt from 'jsonwebtoken';

const INVENTARIO_URL = process.env['INVENTARIO_SERVICE_URL'] ?? 'http://localhost:3002';
const JWT_SECRET     = process.env['JWT_SECRET'] ?? 'dev-secret';

function serviceToken(): string {
  return jwt.sign(
    { id: 'operaciones-service', email: 'service@urbancar.internal', role: 'ADMIN' },
    JWT_SECRET,
    { expiresIn: '60s' },
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchVehiculo(vehiculoId: string): Promise<any | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5_000);
  try {
    const res = await fetch(
      `${INVENTARIO_URL}/api/v1/emilypamela/vehiculos/${vehiculoId}`,
      { signal: controller.signal },
    );
    if (!res.ok) return null;
    const body = await res.json() as { success: boolean; data: any };
    return body.success ? body.data : null;
  } catch { return null; }
  finally { clearTimeout(timer); }
}

function generarCodigo(): string {
  const ts  = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `RES-${ts}-${rnd}`;
}

interface FechaError { error: string }
interface FechaOk   { dInicio: Date; dFin: Date; dias: number }
type FechaValidation = FechaError | FechaOk;

function validateFechas(rawInicio: unknown, rawFin: unknown): FechaValidation {
  if (typeof rawInicio !== 'string' || !rawInicio.trim())
    return { error: 'fechaInicio debe ser un string ISO 8601 válido' };
  if (typeof rawFin !== 'string' || !rawFin.trim())
    return { error: 'fechaFin debe ser un string ISO 8601 válido' };

  const dInicio = new Date(rawInicio);
  const dFin    = new Date(rawFin);

  if (!Number.isFinite(dInicio.getTime()))
    return { error: 'fechaInicio no es una fecha ISO 8601 válida' };
  if (!Number.isFinite(dFin.getTime()))
    return { error: 'fechaFin no es una fecha ISO 8601 válida' };

  const hoy = new Date();
  hoy.setUTCHours(0, 0, 0, 0);
  if (dInicio < hoy)
    return { error: 'fechaInicio no puede ser una fecha pasada' };
  if (dFin <= dInicio)
    return { error: 'fechaFin debe ser estrictamente posterior a fechaInicio' };

  const dias = Math.ceil((dFin.getTime() - dInicio.getTime()) / 86_400_000);
  return { dInicio, dFin, dias };
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

// ── State machine (Fix C-4) ───────────────────────────────────────────────────
//
// NOTE (Fix C-1): The definitive fix for the vehicle race condition requires a
// unique partial index in PostgreSQL to be atomic at the DB level:
//
//   CREATE UNIQUE INDEX idx_one_active_per_vehicle ON reservas(vehiculo_id)
//   WHERE status NOT IN ('CANCELADA', 'COMPLETADA');
//
// The application-level check below (paso 5) reduces the window but does not
// eliminate it under high concurrency. Apply the index when possible.

const ALLOWED_TRANSITIONS: Record<string, readonly string[]> = {
  PENDIENTE:  ['CONFIRMADA', 'CANCELADA'],
  CONFIRMADA: ['ACTIVA',     'CANCELADA'],
  ACTIVA:     ['COMPLETADA', 'CANCELADA'],
  COMPLETADA: [],
  CANCELADA:  [],
} as const;

const VALID_STATUSES = Object.keys(ALLOWED_TRANSITIONS);

// ── /reservas/booking ─────────────────────────────────────────────────────────
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

      // 1. Presence check
      if (!vehiculoId || !clienteId || !fechaInicio || !fechaFin) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'vehiculoId, clienteId, fechaInicio y fechaFin son requeridos' } });
        return;
      }

      // 2. Date validation — Fix C-2
      const fechaResult = validateFechas(fechaInicio, fechaFin);
      if ('error' in fechaResult) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: fechaResult.error } });
        return;
      }
      const { dias, dInicio, dFin } = fechaResult;

      // 3. Vehicle fetch + availability
      const vehiculo = await fetchVehiculo(vehiculoId);
      if (!vehiculo) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Vehiculo ${vehiculoId} no encontrado` } });
        return;
      }
      if (vehiculo.status !== 'DISPONIBLE') {
        res.status(422).json({ success: false, error: { code: 'VEHICLE_NOT_AVAILABLE', message: 'El vehículo no está disponible' } });
        return;
      }

      // 4. Price validation — Fix W-4
      const precioDia = Number(vehiculo.precioDia);
      if (!Number.isFinite(precioDia) || precioDia <= 0) {
        res.status(422).json({ success: false, error: { code: 'VEHICLE_PRICE_MISSING', message: 'El vehículo no tiene precio por día configurado' } });
        return;
      }

      // 5. Active-reservation conflict — application-level Fix C-1
      const conflicto = await prisma.reserva.findFirst({
        where: { vehiculoId, status: { notIn: ['CANCELADA', 'COMPLETADA'] } },
      });
      if (conflicto) {
        res.status(409).json({ success: false, error: { code: 'CONFLICT', message: 'El vehículo ya tiene una reserva activa' } });
        return;
      }

      const agenciaId = bodyAgenciaId ?? vehiculo.agenciaId;
      if (!agenciaId) {
        res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: 'No se pudo determinar agenciaId del vehículo' } });
        return;
      }

      const precioBase = precioDia * dias;

      const fechaInicioDate = dInicio.toISOString().split('T')[0]!;
      const fechaFinDate    = dFin.toISOString().split('T')[0]!;

      const reserva = await reservaRepo.create({
        usuarioId:     clienteId,
        vehiculoId,
        agenciaId,
        fechaInicio:   fechaInicioDate,
        fechaFin:      fechaFinDate,
        diasTotal:     dias,
        precioBase,
        precioExtras:  0,
        precioSeguro:  0,
        totalAmount:   precioBase,
        codigoReserva: generarCodigo(),
      });

      res.status(201).json({ success: true, data: toReservaBookingDto(reserva) });
    } catch (err) { next(err); }
  });

  // PATCH /api/v1/emilypamela/reservas/booking/:id — Fix C-4
  router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const nuevoStatus: unknown = req.body.status;

      if (typeof nuevoStatus !== 'string' || !VALID_STATUSES.includes(nuevoStatus)) {
        res.status(400).json({
          success: false,
          error: {
            code:    'INVALID_STATUS',
            message: `status inválido. Valores permitidos: ${VALID_STATUSES.join(', ')}`,
          },
        });
        return;
      }

      const reserva = await reservaRepo.findById(req.params['id'] as string);
      if (!reserva) {
        res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: `Reserva ${req.params['id']} no encontrada` } });
        return;
      }

      const currentStatus = reserva.status as string;
      const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? [];

      if (!allowed.includes(nuevoStatus)) {
        res.status(422).json({
          success: false,
          error: {
            code:    'INVALID_TRANSITION',
            message: `No se puede cambiar de ${currentStatus} a ${nuevoStatus}`,
          },
        });
        return;
      }

      const updated = await reservaRepo.update(req.params['id'] as string, { status: nuevoStatus });

      // Sync vehicle status in inventario when reservation changes
      if (reserva.vehiculoId) {
        const vehiculoStatus =
          nuevoStatus === 'CONFIRMADA' ? 'RESERVADO' :
          nuevoStatus === 'CANCELADA'  ? 'DISPONIBLE' : null;
        if (vehiculoStatus) {
          fetch(`${INVENTARIO_URL}/api/v1/emilypamela/vehiculos/${reserva.vehiculoId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceToken()}` },
            body: JSON.stringify({ status: vehiculoStatus }),
          }).catch(() => {});
          const kardexEstadoAnterior = nuevoStatus === 'CANCELADA' ? 'RESERVADO' : 'DISPONIBLE';
          const kardexEstadoNuevo    = nuevoStatus === 'CANCELADA' ? 'DISPONIBLE' : 'RESERVADO';
          const kardexEvento         = nuevoStatus === 'CANCELADA' ? 'RESERVA_CANCELADA_BOOKING' : 'RESERVA_CONFIRMADA_BOOKING';
          prisma.kardex.create({
            data: { vehiculoId: reserva.vehiculoId, estadoAnterior: kardexEstadoAnterior, estadoNuevo: kardexEstadoNuevo, evento: kardexEvento, referencia: req.params['id'] as string },
          }).catch(() => {});
        }
      }

      res.json({ success: true, data: toReservaBookingDto(updated) });
    } catch (err) { next(err); }
  });

  return router;
}

// ── /alquileres/booking ───────────────────────────────────────────────────────
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

      if (reserva.vehiculoId) {
        fetch(`${INVENTARIO_URL}/api/v1/emilypamela/vehiculos/${reserva.vehiculoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceToken()}` },
          body: JSON.stringify({ status: 'EN_USO' }),
        }).catch(() => {});
        prisma.kardex.create({
          data: { vehiculoId: reserva.vehiculoId, estadoAnterior: 'RESERVADO', estadoNuevo: 'EN_USO', evento: 'ALQUILER_INICIADO', referencia: alquiler.id },
        }).catch(() => {});
      }

      const result = await alquilerRepo.findById(alquiler.id);
      res.status(201).json({ success: true, data: result });
    } catch (err) { next(err); }
  });

  return router;
}

// ── /devoluciones/booking ─────────────────────────────────────────────────────
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

      if (reservaObj?.vehiculoId) {
        fetch(`${INVENTARIO_URL}/api/v1/emilypamela/vehiculos/${reservaObj.vehiculoId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceToken()}` },
          body: JSON.stringify({ status: 'DISPONIBLE', kilometraje: kmEntrada }),
        }).catch(() => {});
        prisma.kardex.create({
          data: { vehiculoId: reservaObj.vehiculoId, estadoAnterior: 'EN_USO', estadoNuevo: 'DISPONIBLE', evento: 'VEHICULO_DEVUELTO', referencia: devolucion.id },
        }).catch(() => {});
      }

      res.status(201).json({ success: true, data: devolucion });
    } catch (err) { next(err); }
  });

  return router;
}
