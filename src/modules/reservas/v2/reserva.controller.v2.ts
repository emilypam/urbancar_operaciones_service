import { Request, Response, NextFunction } from 'express';
import { ReservaServiceV2 } from './reserva.service.v2.js';

export class ReservaControllerV2 {
  constructor(private readonly service: ReservaServiceV2) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const reserva = await this.service.crearReserva(req.body, req.user!.id);
      res.status(201).json({ success: true, data: reserva });
    } catch (err) { next(err); }
  };

  cancel = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const cancelled = await this.service.cancelarReserva(req.params['id'] as string, req.user?.id);
      res.json({ success: true, data: cancelled });
    } catch (err) { next(err); }
  };

  confirm = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const confirmed = await this.service.confirmarReserva(req.params['id'] as string, req.user?.id);
      res.json({ success: true, data: confirmed });
    } catch (err) { next(err); }
  };
}
