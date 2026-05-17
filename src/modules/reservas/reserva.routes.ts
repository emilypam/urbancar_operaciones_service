import { Router } from 'express';
import { ReservaController } from './reserva.controller.js';
import { authenticate, requireAdmin } from '../../shared/middlewares/auth.middleware.js';
import { validateBody } from '../../shared/middlewares/validate.middleware.js';
import { ReservaCreateSchema, ReservaUpdateSchema } from './reserva.dto.js';

export function createReservaRouter(controller: ReservaController): Router {
  const router = Router();

  router.get('/my',  authenticate, controller.listMy);
  router.get('/',    authenticate, controller.listAll);
  router.get('/:id', authenticate, controller.getById);

  router.post('/',
    authenticate,
    validateBody(ReservaCreateSchema),
    controller.create,
  );

  router.patch('/:id/cancelar',
    authenticate,
    controller.cancel,
  );

  router.patch('/:id',
    authenticate, requireAdmin,
    validateBody(ReservaUpdateSchema),
    controller.update,
  );

  router.delete('/:id',
    authenticate,
    controller.cancel,
  );

  // Extras de una reserva
  router.get('/:id/extras',    authenticate, controller.listExtras);
  router.post('/:id/extras',   authenticate, requireAdmin, controller.addExtra);
  router.delete('/:id/extras/:extraId', authenticate, requireAdmin, controller.removeExtra);

  return router;
}
