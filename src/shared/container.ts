import prisma from './database/prisma.js';
import { ReservaRepository }     from '../modules/reservas/reserva.repository.js';
import { ReservaController }     from '../modules/reservas/reserva.controller.js';
import { AlquilerRepository }    from '../modules/alquileres/alquiler.repository.js';
import { AlquilerController }    from '../modules/alquileres/alquiler.controller.js';
import { CatalogoOpsRepository } from '../modules/catalogos/catalogo-ops.repository.js';
import { CatalogoOpsController } from '../modules/catalogos/catalogo-ops.controller.js';

const reservaRepo     = new ReservaRepository(prisma);
const alquilerRepo    = new AlquilerRepository(prisma);
const catalogoOpsRepo = new CatalogoOpsRepository(prisma);

export const reservaRepository     = reservaRepo;
export const alquilerRepository    = alquilerRepo;
export const reservaController     = new ReservaController(reservaRepo);
export const alquilerController    = new AlquilerController(alquilerRepo);
export const catalogoOpsController = new CatalogoOpsController(catalogoOpsRepo);
