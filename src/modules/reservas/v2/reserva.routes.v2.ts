import { Router } from 'express';
import { ReservaControllerV2 } from './reserva.controller.v2.js';
import { ReservaServiceV2 } from './reserva.service.v2.js';
import { ReservaRepository } from '../reserva.repository.js';
import { authenticate } from '../../../shared/middlewares/auth.middleware.js';
import prisma from '../../../shared/database/prisma.js';

export function createReservaV2Router(): Router {
  const router = Router();
  const repo   = new ReservaRepository(prisma);
  const svc    = new ReservaServiceV2(repo);
  const ctrl   = new ReservaControllerV2(svc);

  router.post('/',                     authenticate, ctrl.create);
  router.post('/:id/cancelar',         authenticate, ctrl.cancel);
  router.post('/:id/confirmar',        authenticate, ctrl.confirm);

  return router;
}
