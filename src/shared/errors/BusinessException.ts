export class BusinessException extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 422,
  ) {
    super(message);
    this.name = 'BusinessException';
    Object.setPrototypeOf(this, BusinessException.prototype);
  }
}

export class NotFoundException extends BusinessException {
  constructor(entity: string, id?: string) {
    super(
      'NOT_FOUND',
      id ? `${entity} con id "${id}" no encontrado` : `${entity} no encontrado`,
      404,
    );
  }
}

export class ConflictException extends BusinessException {
  constructor(message: string) {
    super('CONFLICT', message, 409);
  }
}

export class ValidationException extends BusinessException {
  constructor(message: string) {
    super('VALIDATION_ERROR', message, 400);
  }
}

export class ForbiddenException extends BusinessException {
  constructor(message = 'Acceso denegado') {
    super('FORBIDDEN', message, 403);
  }
}
