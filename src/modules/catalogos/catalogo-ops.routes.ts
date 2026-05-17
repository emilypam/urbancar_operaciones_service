import { Router } from 'express';
import { CatalogoOpsController } from './catalogo-ops.controller.js';
import { authenticate, requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import { validateBody } from '../../shared/middlewares/validate.middleware.js';
import {
  SeguroCreateSchema, SeguroUpdateSchema,
  TarifaCreateSchema, TarifaUpdateSchema,
  CanalVentaCreateSchema,
} from './catalogo-ops.dto.js';

export function createCatalogoOpsRouter(controller: CatalogoOpsController): Router {
  const router = Router();

  // ── Seguros ───────────────────────────────────────────────────────────────────
  router.get('/seguros',     controller.listSeguros);
  router.get('/seguros/:id', controller.getSeguroById);
  router.post('/seguros',    authenticate, requireAdmin, validateBody(SeguroCreateSchema),  controller.createSeguro);
  router.patch('/seguros/:id', authenticate, requireAdmin, validateBody(SeguroUpdateSchema), controller.updateSeguro);
  router.delete('/seguros/:id', authenticate, requireAdmin, controller.deleteSeguro);

  // ── Tarifas ───────────────────────────────────────────────────────────────────
  router.get('/tarifas',     controller.listTarifas);
  router.get('/tarifas/:id', controller.getTarifaById);
  router.post('/tarifas',    authenticate, requireAdmin, validateBody(TarifaCreateSchema),  controller.createTarifa);
  router.patch('/tarifas/:id', authenticate, requireAdmin, validateBody(TarifaUpdateSchema), controller.updateTarifa);
  router.delete('/tarifas/:id', authenticate, requireAdmin, controller.deleteTarifa);

  // ── Canales de Venta ──────────────────────────────────────────────────────────
  router.get('/canales-venta',     controller.listCanales);
  router.get('/canales-venta/:id', controller.getCanalById);
  router.post('/canales-venta',    authenticate, requireAdmin, validateBody(CanalVentaCreateSchema), controller.createCanal);
  router.delete('/canales-venta/:id', authenticate, requireAdmin, controller.deleteCanal);

  return router;
}
