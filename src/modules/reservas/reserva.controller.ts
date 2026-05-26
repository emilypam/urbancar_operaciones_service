import { Request, Response, NextFunction } from 'express';
import { ReservaRepository } from './reserva.repository.js';
import { NotFoundException, ValidationException } from '../../shared/errors/BusinessException.js';
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

function syncVehiculo(vehiculoId: string, status: string): void {
  fetch(`${INVENTARIO_URL}/api/v1/emilypamela/vehiculos/${vehiculoId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceToken()}` },
    body: JSON.stringify({ status }),
  }).catch(() => {});
}

async function fetchInventario<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${INVENTARIO_URL}${path}`);
    if (!res.ok) return null;
    const body = await res.json() as { success: boolean; data: T };
    return body.success ? body.data : null;
  } catch { return null; }
}

async function enrichWithVehiculos(reservas: any[]): Promise<any[]> {
  const ids = [...new Set(reservas.map((r) => r.vehiculoId).filter(Boolean))] as string[];
  if (!ids.length) return reservas;
  const fetched = await Promise.all(
    ids.map((id) => fetchInventario<any>(`/api/v1/emilypamela/vehiculos/${id}`)),
  );
  const vehiculoMap = new Map<string, any>(ids.map((id, i) => [id, fetched[i]]));
  return reservas.map((r) => ({ ...r, vehiculo: vehiculoMap.get(r.vehiculoId) ?? null }));
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

async function emitOutbox(
  evento: string, usuarioId?: string | null, correlationId?: string | null, payload?: object,
): Promise<void> {
  await prisma.outboxEvent.create({
    data: { evento, usuarioId, correlationId, payload: payload as any },
  }).catch(() => {});
}

export class ReservaController {
  constructor(private readonly reservaRepository: ReservaRepository) {}

  listMy = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const usuarioId = req.user!.id;
      const result = await this.reservaRepository.findAll(1, 500, { usuarioId });
      const enriched = await enrichWithVehiculos(result.data);
      res.json({ success: true, data: enriched });
    } catch (err) { next(err); }
  };

  listAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const page    = Number(req.query.page)  || 1;
      const limit   = Number(req.query.limit) || 20;
      const filters = {
        usuarioId:  req.query['usuarioId']  as string | undefined,
        vehiculoId: req.query['vehiculoId'] as string | undefined,
        agenciaId:  req.query['agenciaId']  as string | undefined,
        status:     req.query['status']     as string | undefined,
      };
      const result = await this.reservaRepository.findAll(page, limit, filters);
      const enrichedData = await enrichWithVehiculos(result.data);
      res.json({ success: true, data: { ...result, data: enrichedData } });
    } catch (err) { next(err); }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reserva = await this.reservaRepository.findById(req.params['id'] as string);
      if (!reserva) throw new NotFoundException('Reserva', req.params['id'] as string);
      res.json({ success: true, data: reserva });
    } catch (err) { next(err); }
  };

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { vehiculoId, agenciaId, seguroId, canalVentaId, fechaInicio, fechaFin, notas, extras } = req.body;
      const usuarioId = req.user!.id;

      // Obtener precio base del vehículo desde inventario-service
      const vehiculo = await fetchInventario<{ id: string; precioDia: string; status: string; isActive: boolean }>(
        `/api/v1/emilypamela/vehiculos/${vehiculoId}`
      );
      if (!vehiculo) throw new NotFoundException('Vehiculo', vehiculoId);
      if (vehiculo.status !== 'DISPONIBLE') throw new ValidationException('El vehículo no está disponible');

      const dias       = calcularDias(fechaInicio, fechaFin);
      const precioBase = Number(vehiculo.precioDia) * dias;

      // Calcular precio seguro
      let precioSeguro = 0;
      if (seguroId) {
        const seguro = await this.reservaRepository.findSeguroById(seguroId);
        if (seguro) precioSeguro = Number(seguro.precioDia) * dias;
      }

      // Calcular precio extras + preparar datos
      let precioExtras = 0;
      const extrasData: any[] = [];
      if (extras?.length) {
        for (const e of extras) {
          const extra = await fetchInventario<{ id: string; precioDia: string; isActive: boolean }>(
            `/api/v1/emilypamela/extras/${e.extraId}`
          );
          if (!extra) throw new NotFoundException('Extra', e.extraId);
          const subtotal = Number(extra.precioDia) * e.cantidad * dias;
          precioExtras += subtotal;
          extrasData.push({ extraId: e.extraId, cantidad: e.cantidad, precioDia: Number(extra.precioDia), subtotal });
        }
      }

      const reserva = await this.reservaRepository.create({
        usuarioId, vehiculoId, agenciaId, seguroId, canalVentaId,
        fechaInicio, fechaFin, diasTotal: dias,
        precioBase, precioExtras, precioSeguro,
        totalAmount: precioBase + precioExtras + precioSeguro,
        codigoReserva: generarCodigo(),
        notas,
        extras: extrasData,
      });

      void emitOutbox('RESERVA_CREADA', usuarioId, reserva.id, {
        reservaId: reserva.id, vehiculoId, totalAmount: reserva.totalAmount,
      });
      res.status(201).json({ success: true, data: reserva });
    } catch (err) { next(err); }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reserva = await this.reservaRepository.findById(req.params['id'] as string);
      if (!reserva) throw new NotFoundException('Reserva', req.params['id'] as string);
      const updated = await this.reservaRepository.update(req.params['id'] as string, req.body);
      if (req.body.status) {
        void emitOutbox(`RESERVA_${req.body.status}`, req.user?.id, updated.id, {
          reservaId: updated.id, status: req.body.status,
        });
        const vehiculoStatus =
          req.body.status === 'CONFIRMADA' ? 'RESERVADO' :
          req.body.status === 'CANCELADA'  ? 'DISPONIBLE' : null;
        if (vehiculoStatus && reserva.vehiculoId) syncVehiculo(reserva.vehiculoId, vehiculoStatus);
      }
      res.json({ success: true, data: updated });
    } catch (err) { next(err); }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reserva = await this.reservaRepository.findById(req.params['id'] as string);
      if (!reserva) throw new NotFoundException('Reserva', req.params['id'] as string);
      if (reserva.status === 'COMPLETADA' || reserva.status === 'CANCELADA') {
        throw new ValidationException(`No se puede cancelar una reserva en estado ${reserva.status}`);
      }
      const cancelled = await this.reservaRepository.update(req.params['id'] as string, { status: 'CANCELADA' });
      void emitOutbox('RESERVA_CANCELADA', req.user?.id, cancelled.id, { reservaId: cancelled.id });
      if (reserva.vehiculoId) syncVehiculo(reserva.vehiculoId, 'DISPONIBLE');
      res.json({ success: true, data: cancelled });
    } catch (err) { next(err); }
  };

  // Extras
  listExtras = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      res.json({ success: true, data: await this.reservaRepository.findExtras(req.params['id'] as string) });
    } catch (err) { next(err); }
  };

  addExtra = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { extraId, cantidad = 1 } = req.body;
      const reserva = await this.reservaRepository.findById(req.params['id'] as string);
      if (!reserva) throw new NotFoundException('Reserva', req.params['id'] as string);
      const extra = await fetchInventario<{ id: string; precioDia: string; isActive: boolean }>(
        `/api/v1/emilypamela/extras/${extraId}`
      );
      if (!extra) throw new NotFoundException('Extra', extraId);
      res.status(201).json({ success: true, data: await this.reservaRepository.addExtra(req.params['id'] as string, extraId, Number(extra.precioDia), cantidad) });
    } catch (err) { next(err); }
  };

  removeExtra = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.reservaRepository.removeExtra(req.params['id'] as string, req.params['extraId'] as string);
      res.json({ success: true, data: { deleted: true } });
    } catch (err) { next(err); }
  };
}
