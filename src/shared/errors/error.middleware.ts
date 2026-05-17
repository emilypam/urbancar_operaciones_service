import { Request, Response, NextFunction } from 'express';
import { BusinessException } from './BusinessException.js';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof BusinessException) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  if (err.code === 'P2002') {
    const fields: string[] = err.meta?.target ?? [];
    res.status(409).json({
      success: false,
      error: { code: 'CONFLICT', message: `Ya existe un registro con ese dato único (${fields.join(', ')})` },
    });
    return;
  }
  if (err.code === 'P2025') {
    res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Registro no encontrado' } });
    return;
  }

  console.error('❌ Error no controlado:', err);
  res.status(err.status || 500).json({
    success: false,
    error: {
      code:    'INTERNAL_ERROR',
      message: err.message || 'Error interno del servidor',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}
