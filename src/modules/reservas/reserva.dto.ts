import { z } from 'zod';

const fechaDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)');

export const ReservaCreateSchema = z.object({
  vehiculoId:   z.string().uuid('vehiculoId debe ser UUID'),
  agenciaId:    z.string().uuid('agenciaId debe ser UUID'),
  seguroId:     z.string().uuid().optional(),
  canalVentaId: z.string().uuid().optional(),
  fechaInicio:  fechaDate,
  fechaFin:     fechaDate,
  notas:        z.string().optional(),
  extras: z.array(z.object({
    extraId:  z.string().uuid(),
    cantidad: z.number().int().min(1).default(1),
  })).optional(),
}).refine(d => new Date(d.fechaFin) > new Date(d.fechaInicio), {
  message: 'fechaFin debe ser posterior a fechaInicio',
  path: ['fechaFin'],
});

export const ReservaUpdateSchema = z.object({
  status:      z.enum(['PENDIENTE', 'CONFIRMADA', 'ACTIVA', 'COMPLETADA', 'CANCELADA']).optional(),
  seguroId:    z.string().uuid().optional(),
  notas:       z.string().optional(),
  expiresAt:   z.string().datetime().optional(),
});

export type ReservaCreateDto = z.infer<typeof ReservaCreateSchema>;
export type ReservaUpdateDto = z.infer<typeof ReservaUpdateSchema>;
