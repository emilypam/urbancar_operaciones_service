import { getChannel, EXCHANGE, DLQ } from '../rabbitmq.js';
import prisma from '../../shared/database/prisma.js';

const QUEUE = 'operaciones.pagos.procesados';

export async function startPagoProcesadoConsumer(): Promise<void> {
  const ch = getChannel();
  if (!ch) {
    console.warn('[operaciones-service] consumer pago-procesado no iniciado — RabbitMQ no disponible');
    return;
  }

  await ch.assertQueue(QUEUE, {
    durable: true,
    arguments: { 'x-dead-letter-exchange': '', 'x-dead-letter-routing-key': DLQ },
  });
  await ch.bindQueue(QUEUE, EXCHANGE, 'pagos.pago.procesado');
  await ch.prefetch(1);

  ch.consume(QUEUE, async (msg) => {
    if (!msg) return;
    try {
      const event = JSON.parse(msg.content.toString());
      const { reservaId } = event.data as { reservaId?: string };

      if (reservaId) {
        await prisma.reserva.update({
          where: { id: reservaId },
          data:  { status: 'CONFIRMADA' },
        });
        await prisma.outboxEvent.create({
          data: { evento: 'RESERVA_CONFIRMADA_POR_PAGO', correlationId: reservaId, payload: event.data as any },
        }).catch(() => {});
        console.log(`[operaciones-service] ✅ reserva ${reservaId} confirmada por pago`);
      }

      ch.ack(msg);
    } catch (err) {
      console.error('[operaciones-service] consumer pago-procesado error:', err);
      ch.nack(msg, false, false);
    }
  });

  console.log(`[operaciones-service] consumer escuchando → ${QUEUE}`);
}
