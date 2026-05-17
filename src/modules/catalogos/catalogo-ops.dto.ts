import { z } from 'zod';

export const SeguroCreateSchema = z.object({
  nombre:      z.string().min(1).max(100),
  descripcion: z.string().optional(),
  precioDia:   z.number().positive('precioDia debe ser positivo'),
  cobertura:   z.string().optional(),
});
export const SeguroUpdateSchema = SeguroCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const TarifaCreateSchema = z.object({
  categoriaId:  z.string().uuid('categoriaId debe ser UUID'),
  nombre:       z.string().min(1).max(100),
  precioDia:    z.number().positive('precioDia debe ser positivo'),
  diasMinimos:  z.number().int().min(1).optional(),
});
export const TarifaUpdateSchema = TarifaCreateSchema.partial().extend({
  isActive: z.boolean().optional(),
});

export const CanalVentaCreateSchema = z.object({
  nombre: z.string().min(1).max(100),
  codigo: z.string().min(1).max(20),
});
