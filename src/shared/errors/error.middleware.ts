import { Request, Response, NextFunction } from 'express';
import { BusinessException } from './BusinessException.js';

const PRISMA_ERROR_MAP: Record<string, { status: number; code: string; message: string }> = {
  P2002: { status: 409, code: 'CONFLICT',           message: 'Ya existe un registro con ese dato único' },
  P2003: { status: 422, code: 'FOREIGN_KEY_FAILED', message: 'Un ID referenciado no existe en el sistema' },
  P2009: { status: 400, code: 'VALIDATION_ERROR',   message: 'Valor inválido para el campo indicado' },
  P2025: { status: 404, code: 'NOT_FOUND',          message: 'Registro no encontrado' },
};

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof BusinessException) {
    res.status(err.statusCode).json({
      success: false,
      error: { code: err.code, message: err.message },
    });
    return;
  }

  const prismaEntry = typeof err.code === 'string' ? PRISMA_ERROR_MAP[err.code] : undefined;
  if (prismaEntry) {
    res.status(prismaEntry.status).json({
      success: false,
      error: { code: prismaEntry.code, message: prismaEntry.message },
    });
    return;
  }

  console.error('❌ Error no controlado:', err);
  res.status(500).json({
    success: false,
    error: {
      code:    'INTERNAL_ERROR',
      message: 'Error interno del servidor',
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
}
