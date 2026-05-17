import { Request, Response, NextFunction } from 'express';
import { CatalogoOpsRepository } from './catalogo-ops.repository.js';
import { NotFoundException } from '../../shared/errors/BusinessException.js';

export class CatalogoOpsController {
  constructor(private readonly repo: CatalogoOpsRepository) {}

  // ── Seguros ───────────────────────────────────────────────────────────────────
  listSeguros = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const onlyActive = req.query['active'] === 'true';
      res.json({ success: true, data: await this.repo.findAllSeguros(onlyActive) });
    } catch (err) { next(err); }
  };

  getSeguroById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const seguro = await this.repo.findSeguroById(req.params['id'] as string);
      if (!seguro) throw new NotFoundException('Seguro', req.params['id'] as string);
      res.json({ success: true, data: seguro });
    } catch (err) { next(err); }
  };

  createSeguro = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { res.status(201).json({ success: true, data: await this.repo.createSeguro(req.body) }); }
    catch (err) { next(err); }
  };

  updateSeguro = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { res.json({ success: true, data: await this.repo.updateSeguro(req.params['id'] as string, req.body) }); }
    catch (err) { next(err); }
  };

  deleteSeguro = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.repo.deleteSeguro(req.params['id'] as string);
      res.json({ success: true, data: { deactivated: true } });
    } catch (err) { next(err); }
  };

  // ── Tarifas ───────────────────────────────────────────────────────────────────
  listTarifas = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categoriaId = req.query['categoriaId'] as string | undefined;
      const onlyActive  = req.query['active'] === 'true';
      res.json({ success: true, data: await this.repo.findAllTarifas(categoriaId, onlyActive) });
    } catch (err) { next(err); }
  };

  getTarifaById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const tarifa = await this.repo.findTarifaById(req.params['id'] as string);
      if (!tarifa) throw new NotFoundException('Tarifa', req.params['id'] as string);
      res.json({ success: true, data: tarifa });
    } catch (err) { next(err); }
  };

  createTarifa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { res.status(201).json({ success: true, data: await this.repo.createTarifa(req.body) }); }
    catch (err) { next(err); }
  };

  updateTarifa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { res.json({ success: true, data: await this.repo.updateTarifa(req.params['id'] as string, req.body) }); }
    catch (err) { next(err); }
  };

  deleteTarifa = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.repo.deleteTarifa(req.params['id'] as string);
      res.json({ success: true, data: { deactivated: true } });
    } catch (err) { next(err); }
  };

  // ── Canales de Venta ──────────────────────────────────────────────────────────
  listCanales = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { res.json({ success: true, data: await this.repo.findAllCanales() }); }
    catch (err) { next(err); }
  };

  getCanalById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const canal = await this.repo.findCanalById(req.params['id'] as string);
      if (!canal) throw new NotFoundException('Canal de Venta', req.params['id'] as string);
      res.json({ success: true, data: canal });
    } catch (err) { next(err); }
  };

  createCanal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try { res.status(201).json({ success: true, data: await this.repo.createCanal(req.body) }); }
    catch (err) { next(err); }
  };

  deleteCanal = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.repo.deleteCanal(req.params['id'] as string);
      res.json({ success: true, data: { deleted: true } });
    } catch (err) { next(err); }
  };
}
