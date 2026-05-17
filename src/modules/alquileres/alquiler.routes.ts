import { Router } from 'express';
import { AlquilerController } from './alquiler.controller.js';
import { authenticate, requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import { validateBody } from '../../shared/middlewares/validate.middleware.js';
import { AlquilerCreateSchema, AlquilerUpdateSchema, DevolucionCreateSchema } from './alquiler.dto.js';

export function createAlquilerRouter(controller: AlquilerController): Router {
  const router = Router();

  router.use(authenticate, requireAdmin);

  router.get('/',    controller.listAll);
  router.get('/:id', controller.getById);

  router.post('/',
    validateBody(AlquilerCreateSchema),
    controller.create,
  );

  router.patch('/:id',
    validateBody(AlquilerUpdateSchema),
    controller.update,
  );

  // Devolución
  router.get('/:id/devolucion',  controller.getDevolucion);
  router.post('/:id/devolucion',
    validateBody(DevolucionCreateSchema),
    controller.createDevolucion,
  );

  return router;
}
