import { z } from 'zod';

export const AlquilerCreateSchema = z.object({
  reservaId:    z.string().uuid('reservaId debe ser UUID'),
  kmSalida:     z.number().int().min(0),
  fechaInicio:  z.string().datetime().optional(),
  observaciones: z.string().optional(),
});

export const AlquilerUpdateSchema = z.object({
  kmEntrada:     z.number().int().min(0).optional(),
  fechaFin:      z.string().datetime().optional(),
  cargoAdicional: z.number().min(0).optional(),
  status:        z.enum(['ACTIVO', 'FINALIZADO', 'CANCELADO']).optional(),
  observaciones: z.string().optional(),
});

export const DevolucionCreateSchema = z.object({
  kmEntrada:      z.number().int().min(0),
  estadoVehiculo: z.string().max(100).optional(),
  cargoExtra:     z.number().min(0).optional(),
  observaciones:  z.string().optional(),
});

export type AlquilerCreateDto  = z.infer<typeof AlquilerCreateSchema>;
export type AlquilerUpdateDto  = z.infer<typeof AlquilerUpdateSchema>;
export type DevolucionCreateDto = z.infer<typeof DevolucionCreateSchema>;
