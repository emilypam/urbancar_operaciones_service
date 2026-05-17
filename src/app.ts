import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import { createReservaRouter }     from './modules/reservas/reserva.routes.js';
import { createAlquilerRouter }    from './modules/alquileres/alquiler.routes.js';
import { createCatalogoOpsRouter } from './modules/catalogos/catalogo-ops.routes.js';
import {
  reservaRepository, alquilerRepository,
  reservaController, alquilerController, catalogoOpsController,
} from './shared/container.js';
import {
  createReservaBookingRouter,
  createAlquilerBookingRouter,
  createDevolucionBookingRouter,
} from './modules/booking-integration/booking.routes.js';
import { errorHandler } from './shared/errors/error.middleware.js';
import { swaggerSpec } from './shared/swagger.js';
import { authenticate, requireAdmin } from './shared/middlewares/auth.middleware.js';
import prisma from './shared/database/prisma.js';

const app = express();

app.set('trust proxy', 1);
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*' }));
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ service: 'operaciones-service', status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/api/v1/emilypamela/admin/dashboard', authenticate, requireAdmin, async (_req, res, next) => {
  try {
    const [reservasTotal, reservasActivas, alquileresTotal] = await Promise.all([
      prisma.reserva.count(),
      prisma.reserva.count({ where: { status: 'ACTIVA' } }),
      prisma.alquiler.count(),
    ]);
    res.json({
      success: true,
      data: {
        vehiculos:  { total: 0, disponibles: 0 },
        reservas:   { total: reservasTotal, activas: reservasActivas },
        usuarios:   { total: 0 },
        alquileres: { total: alquileresTotal },
        facturas:   { total: 0 },
        ingresos:   { total: 0 },
      },
    });
  } catch (err) { next(err); }
});

app.get('/api/v1/emilypamela/historial', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 50;
    const [total, events] = await Promise.all([
      prisma.outboxEvent.count(),
      prisma.outboxEvent.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({
      success: true,
      data: {
        items: events.map((e) => ({
          id:        e.id,
          usuarioId: e.usuarioId,
          accion:    e.evento,
          entidad:   'Sistema',
          entidadId: e.correlationId,
          payload:   e.payload,
          createdAt: e.createdAt,
        })),
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (err) { next(err); }
});

app.get('/api/v1/emilypamela/outbox-events', authenticate, requireAdmin, async (req, res, next) => {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 50;
    const [total, events] = await Promise.all([
      prisma.outboxEvent.count(),
      prisma.outboxEvent.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
    ]);
    res.json({
      success: true,
      data: { items: events, total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) { next(err); }
});

// Booking integration routes — registered BEFORE main routers to avoid /:id collision
app.use('/api/v1/emilypamela/reservas/booking',    createReservaBookingRouter(reservaRepository));
app.use('/api/v1/emilypamela/alquileres/booking',  createAlquilerBookingRouter(alquilerRepository));
app.use('/api/v1/emilypamela/devoluciones/booking', createDevolucionBookingRouter(alquilerRepository));

app.use('/api/v1/emilypamela/reservas',   createReservaRouter(reservaController));
app.use('/api/v1/emilypamela/alquileres', createAlquilerRouter(alquilerController));
app.use('/api/v1/emilypamela', createCatalogoOpsRouter(catalogoOpsController));

// Integración Booking: endpoint plano POST /devoluciones (legado)
app.post(
  '/api/v1/emilypamela/devoluciones',
  authenticate,
  requireAdmin,
  alquilerController.createDevolucionFlat,
);

app.use(errorHandler);

export default app;
