export const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'UrbanCar — Operaciones Service',
    version: '1.0.0',
    description: 'Gestión de reservas, alquileres, devoluciones, seguros, tarifas y canales de venta.',
  },
  servers: [
    { url: 'http://localhost:3004', description: 'Local' },
    { url: 'https://urbancar-operaciones.azurewebsites.net', description: 'Azure (producción)' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      ReservaCreate: {
        type: 'object',
        required: ['vehiculoId', 'agenciaId', 'fechaInicio', 'fechaFin'],
        properties: {
          vehiculoId:   { type: 'string', format: 'uuid' },
          agenciaId:    { type: 'string', format: 'uuid' },
          seguroId:     { type: 'string', format: 'uuid' },
          canalVentaId: { type: 'string', format: 'uuid' },
          fechaInicio:  { type: 'string', format: 'date', example: '2026-06-01' },
          fechaFin:     { type: 'string', format: 'date', example: '2026-06-05' },
          notas:        { type: 'string' },
          extras: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                extraId:  { type: 'string', format: 'uuid' },
                cantidad: { type: 'integer', minimum: 1, default: 1 },
              },
            },
          },
        },
      },
      AlquilerCreate: {
        type: 'object',
        required: ['reservaId', 'kmSalida'],
        properties: {
          reservaId:     { type: 'string', format: 'uuid' },
          kmSalida:      { type: 'integer', minimum: 0, example: 15000 },
          observaciones: { type: 'string' },
        },
      },
      DevolucionCreate: {
        type: 'object',
        required: ['kmEntrada'],
        properties: {
          kmEntrada:      { type: 'integer', minimum: 0, example: 15500 },
          estadoVehiculo: { type: 'string', example: 'Buen estado' },
          cargoExtra:     { type: 'number', minimum: 0 },
          observaciones:  { type: 'string' },
        },
      },
      SeguroCreate: {
        type: 'object',
        required: ['nombre', 'precioDia'],
        properties: {
          nombre:      { type: 'string', example: 'Seguro Básico' },
          descripcion: { type: 'string' },
          precioDia:   { type: 'number', example: 8.50 },
        },
      },
      TarifaCreate: {
        type: 'object',
        required: ['nombre', 'categoriaId'],
        properties: {
          nombre:      { type: 'string' },
          categoriaId: { type: 'string', format: 'uuid' },
          precioDia:   { type: 'number' },
        },
      },
      CanalVentaCreate: {
        type: 'object',
        required: ['nombre', 'codigo'],
        properties: {
          nombre: { type: 'string', example: 'Web' },
          codigo: { type: 'string', example: 'WEB' },
        },
      },
    },
  },
  paths: {
    '/api/v1/emilypamela/reservas': {
      get: {
        tags: ['Reservas'],
        summary: 'Listar reservas (autenticado)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page',       in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit',      in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'usuarioId',  in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'vehiculoId', in: 'query', schema: { type: 'string', format: 'uuid' } },
          { name: 'status',     in: 'query', schema: { type: 'string', enum: ['PENDIENTE', 'CONFIRMADA', 'ACTIVA', 'COMPLETADA', 'CANCELADA'] } },
        ],
        responses: { 200: { description: 'Lista paginada de reservas' } },
      },
      post: {
        tags: ['Reservas'],
        summary: 'Crear reserva (autenticado)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/ReservaCreate' } } },
        },
        responses: {
          201: { description: 'Reserva creada con precios calculados' },
          400: { description: 'Datos inválidos' },
          404: { description: 'Vehículo o seguro no encontrado' },
          422: { description: 'Vehículo no disponible' },
        },
      },
    },
    '/api/v1/emilypamela/reservas/{id}': {
      get: {
        tags: ['Reservas'],
        summary: 'Obtener reserva por ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Reserva encontrada' }, 404: { description: 'No encontrada' } },
      },
      put: {
        tags: ['Reservas'],
        summary: 'Actualizar reserva (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object' } } } },
        responses: { 200: { description: 'Actualizada' } },
      },
    },
    '/api/v1/emilypamela/reservas/{id}/cancel': {
      post: {
        tags: ['Reservas'],
        summary: 'Cancelar reserva',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Reserva cancelada' },
          422: { description: 'No se puede cancelar (ya completada/cancelada)' },
        },
      },
    },
    '/api/v1/emilypamela/alquileres': {
      get: {
        tags: ['Alquileres'],
        summary: 'Listar alquileres (autenticado)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'page',      in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit',     in: 'query', schema: { type: 'integer', default: 20 } },
          { name: 'status',    in: 'query', schema: { type: 'string', enum: ['ACTIVO', 'FINALIZADO', 'CANCELADO'] } },
          { name: 'reservaId', in: 'query', schema: { type: 'string', format: 'uuid' } },
        ],
        responses: { 200: { description: 'Lista de alquileres' } },
      },
      post: {
        tags: ['Alquileres'],
        summary: 'Iniciar alquiler (ADMIN)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/AlquilerCreate' } } },
        },
        responses: { 201: { description: 'Alquiler iniciado' }, 404: { description: 'Reserva no encontrada' } },
      },
    },
    '/api/v1/emilypamela/alquileres/{id}': {
      get: {
        tags: ['Alquileres'],
        summary: 'Obtener alquiler por ID',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Alquiler encontrado' }, 404: { description: 'No encontrado' } },
      },
    },
    '/api/v1/emilypamela/alquileres/{id}/devolucion': {
      post: {
        tags: ['Alquileres'],
        summary: 'Registrar devolución (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { $ref: '#/components/schemas/DevolucionCreate' } } },
        },
        responses: { 201: { description: 'Devolución registrada' } },
      },
    },
    '/api/v1/emilypamela/seguros': {
      get: {
        tags: ['Catálogos Ops'],
        summary: 'Listar seguros (público)',
        responses: { 200: { description: 'Lista de seguros' } },
      },
      post: {
        tags: ['Catálogos Ops'],
        summary: 'Crear seguro (ADMIN)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SeguroCreate' } } } },
        responses: { 201: { description: 'Seguro creado' } },
      },
    },
    '/api/v1/emilypamela/seguros/{id}': {
      put: {
        tags: ['Catálogos Ops'],
        summary: 'Actualizar seguro (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/SeguroCreate' } } } },
        responses: { 200: { description: 'Actualizado' } },
      },
      delete: {
        tags: ['Catálogos Ops'],
        summary: 'Desactivar seguro (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: { 200: { description: 'Desactivado (soft delete)' } },
      },
    },
    '/api/v1/emilypamela/tarifas': {
      get: {
        tags: ['Catálogos Ops'],
        summary: 'Listar tarifas (público)',
        responses: { 200: { description: 'Lista de tarifas' } },
      },
      post: {
        tags: ['Catálogos Ops'],
        summary: 'Crear tarifa (ADMIN)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/TarifaCreate' } } } },
        responses: { 201: { description: 'Tarifa creada' } },
      },
    },
    '/api/v1/emilypamela/canales-venta': {
      get: {
        tags: ['Catálogos Ops'],
        summary: 'Listar canales de venta (público)',
        responses: { 200: { description: 'Lista de canales' } },
      },
      post: {
        tags: ['Catálogos Ops'],
        summary: 'Crear canal de venta (ADMIN)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CanalVentaCreate' } } } },
        responses: { 201: { description: 'Canal creado' } },
      },
    },

    // ── Booking Integration ─────────────────────────────────────────────────
    '/api/v1/emilypamela/reservas/booking': {
      post: {
        tags: ['Booking Integration'],
        summary: 'Crear reserva desde plataforma Booking',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['vehiculoId', 'clienteId', 'fechaInicio', 'fechaFin'],
                properties: {
                  vehiculoId:  { type: 'string', format: 'uuid' },
                  clienteId:   { type: 'string', format: 'uuid', description: 'ID del usuario cliente en UrbanCar' },
                  agenciaId:   { type: 'string', format: 'uuid', description: 'Opcional; se deriva del vehículo si no se envía' },
                  fechaInicio: { type: 'string', format: 'date', example: '2026-06-01' },
                  fechaFin:    { type: 'string', format: 'date', example: '2026-06-05' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Reserva creada (formato Booking)' },
          400: { description: 'Datos inválidos' },
          404: { description: 'Vehículo no encontrado' },
          422: { description: 'Vehículo no disponible' },
        },
      },
    },
    '/api/v1/emilypamela/reservas/booking/{id}': {
      get: {
        tags: ['Booking Integration'],
        summary: 'Obtener reserva por ID (formato Booking)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        responses: {
          200: { description: 'Reserva en formato Booking' },
          404: { description: 'No encontrada' },
        },
      },
      patch: {
        tags: ['Booking Integration'],
        summary: 'Actualizar estado de reserva (ADMIN)',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: { status: { type: 'string', enum: ['PENDIENTE', 'CONFIRMADA', 'ACTIVA', 'COMPLETADA', 'CANCELADA'] } },
              },
            },
          },
        },
        responses: { 200: { description: 'Estado actualizado' }, 404: { description: 'No encontrada' } },
      },
    },
    '/api/v1/emilypamela/alquileres/booking': {
      post: {
        tags: ['Booking Integration'],
        summary: 'Iniciar alquiler desde plataforma Booking (ADMIN)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reservaId'],
                properties: {
                  reservaId:    { type: 'string', format: 'uuid' },
                  kmSalida:     { type: 'integer', example: 50000 },
                  fechaInicio:  { type: 'string', format: 'date-time' },
                  observaciones:{ type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Alquiler iniciado' },
          400: { description: 'Datos inválidos' },
          404: { description: 'Reserva no encontrada' },
          422: { description: 'La reserva no está CONFIRMADA' },
          409: { description: 'Ya existe alquiler para esta reserva' },
        },
      },
    },
    '/api/v1/emilypamela/devoluciones/booking': {
      post: {
        tags: ['Booking Integration'],
        summary: 'Registrar devolución desde plataforma Booking (ADMIN)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['alquilerId', 'kmEntrada', 'estadoVehiculo'],
                properties: {
                  alquilerId:    { type: 'string', format: 'uuid' },
                  kmEntrada:     { type: 'integer', example: 51500 },
                  estadoVehiculo:{ type: 'string', example: 'BUENO' },
                  cargoExtra:    { type: 'number', example: 0 },
                  observaciones: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Devolución registrada' },
          400: { description: 'Datos inválidos' },
          404: { description: 'Alquiler no encontrado' },
          422: { description: 'El alquiler no está ACTIVO' },
          409: { description: 'Ya existe devolución para este alquiler' },
        },
      },
    },
  },
};
