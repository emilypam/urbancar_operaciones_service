import { Request, Response, NextFunction } from 'express';
import { AlquilerRepository } from './alquiler.repository.js';
import { NotFoundException, ValidationException } from '../../shared/errors/BusinessException.js';
import prisma from '../../shared/database/prisma.js';

const INVENTARIO_URL = process.env['INVENTARIO_SERVICE_URL'] ?? 'http://localhost:3002';

async function fetchInventario<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${INVENTARIO_URL}${path}`);
    if (!res.ok) return null;
    const body = await res.json() as { success: boolean; data: T };
    return body.success ? body.data : null;
  } catch { return null; }
}

async function enrichAlquileresWithVehiculos(alquileres: any[]): Promise<any[]> {
  const ids = [...new Set(
    alquileres.map((a) => a.reserva?.vehiculoId).filter(Boolean)
  )] as string[];
  if (!ids.length) return alquileres;
  const fetched = await Promise.all(
    ids.map((id) => fetchInventario<any>(`/api/v1/emilypamela/vehiculos/${id}`)),
  );
  const vehiculoMap = new Map<string, any>(ids.map((id, i) => [id, fetched[i]]));
  return alquileres.map((a) => ({
    ...a,
    reserva: a.reserva
      ? { ...a.reserva, vehiculo: vehiculoMap.get(a.reserva.vehiculoId) ?? null }
      : a.reserva,
  }));
}

async function patchVehiculoStatus(vehiculoId: string, data: object, authHeader?: string) {
  fetch(`${INVENTARIO_URL}/api/v1/emilypamela/vehiculos/${vehiculoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: authHeader ?? '' },
    body: JSON.stringify(data),
  }).catch(() => {});
}

export class AlquilerController {
  constructor(private readonly alquilerRepository: AlquilerRepository) {}

  listAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page   = Number(req.query.page)  || 1;
      const limit  = Number(req.query.limit) || 20;
      const status = req.query['status'] as string | undefined;
      const result = await this.alquilerRepository.findAll(page, limit, status);
      const enriched = await enrichAlquileresWithVehiculos(result.data);
      res.json({ success: true, data: { ...result, data: enriched } });
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const alquiler = await this.alquilerRepository.findById(req.params['id'] as string);
      if (!alquiler) throw new NotFoundException('Alquiler', req.params['id'] as string);
      res.json({ success: true, data: alquiler });
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { reservaId, kmSalida, fechaInicio, observaciones } = req.body;

      const reserva = await prisma.reserva.findUnique({ where: { id: reservaId } });
      if (!reserva) throw new NotFoundException('Reserva', reservaId);
      if (reserva.status !== 'CONFIRMADA') {
        throw new ValidationException('Solo se puede iniciar un alquiler de una reserva CONFIRMADA');
      }

      const existente = await this.alquilerRepository.findByReservaId(reservaId);
      if (existente) throw new ValidationException('Ya existe un alquiler para esta reserva');

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
        patchVehiculoStatus(reserva.vehiculoId, { status: 'EN_USO' }, req.headers.authorization);
      }

      res.status(201).json({ success: true, data: await this.alquilerRepository.findById(alquiler.id) });
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const alquiler = await this.alquilerRepository.findById(req.params['id'] as string);
      if (!alquiler) throw new NotFoundException('Alquiler', req.params['id'] as string);
      res.json({ success: true, data: await this.alquilerRepository.update(req.params['id'] as string, req.body) });
    } catch (err) { next(err); }
  };

  // Devolución anidada: PATCH /alquileres/:id/devolucion
  getDevolucion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const devolucion = await this.alquilerRepository.findDevolucion(req.params['id'] as string);
      if (!devolucion) throw new NotFoundException('Devolucion');
      res.json({ success: true, data: devolucion });
    } catch (err) { next(err); }
  };

  createDevolucion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const alquiler = await this.alquilerRepository.findById(req.params['id'] as string);
      if (!alquiler) throw new NotFoundException('Alquiler', req.params['id'] as string);
      if (alquiler.status !== 'ACTIVO') throw new ValidationException('El alquiler no está activo');

      const existente = await this.alquilerRepository.findDevolucion(req.params['id'] as string);
      if (existente) throw new ValidationException('Este alquiler ya tiene una devolución registrada');

      const { kmEntrada, estadoVehiculo, cargoExtra = 0, observaciones } = req.body;

      const reservaObj = await prisma.reserva.findUnique({ where: { id: alquiler.reservaId! } });

      const devolucion = await prisma.$transaction(async (tx) => {
        const d = await tx.devolucion.create({
          data: { alquilerId: req.params['id'] as string, kmEntrada, estadoVehiculo, cargoExtra, observaciones },
        });
        await tx.alquiler.update({
          where: { id: req.params['id'] as string },
          data:  { status: 'FINALIZADO', kmEntrada, fechaFin: new Date(), cargoAdicional: cargoExtra },
        });
        await tx.reserva.update({ where: { id: alquiler.reservaId! }, data: { status: 'COMPLETADA' } });
        return d;
      });

      if (reservaObj?.vehiculoId) {
        patchVehiculoStatus(reservaObj.vehiculoId, { status: 'DISPONIBLE', kilometraje: kmEntrada }, req.headers.authorization);
      }

      res.status(201).json({ success: true, data: devolucion });
    } catch (err) { next(err); }
  };

  // Devolución plana para integración con Booking: POST /devoluciones
  createDevolucionFlat = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { alquilerId, kmEntrada, estadoVehiculo, cargoExtra = 0, observaciones } = req.body;
      if (!alquilerId) throw new ValidationException('alquilerId es requerido');

      const alquiler = await this.alquilerRepository.findById(alquilerId);
      if (!alquiler) throw new NotFoundException('Alquiler', alquilerId);
      if (alquiler.status !== 'ACTIVO') throw new ValidationException('El alquiler no está activo');

      const existente = await this.alquilerRepository.findDevolucion(alquilerId);
      if (existente) throw new ValidationException('Este alquiler ya tiene una devolución registrada');

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
        patchVehiculoStatus(reservaObj.vehiculoId, { status: 'DISPONIBLE', kilometraje: kmEntrada }, req.headers.authorization);
      }

      res.status(201).json({ success: true, data: devolucion });
    } catch (err) { next(err); }
  };
}
