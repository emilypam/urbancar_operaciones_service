import amqp from 'amqplib';

export const EXCHANGE = 'urbancar.events';
export const DLQ      = 'urbancar.dlq';

let channel: amqp.Channel | null = null;
let connected = false;

export async function connectRabbitMQ(serviceName = 'operaciones-service'): Promise<void> {
  const url = process.env.RABBITMQ_URL ?? 'amqp://localhost';
  try {
    const conn = await amqp.connect(url);
    const ch   = await conn.createChannel();

    await ch.assertExchange(EXCHANGE, 'topic', { durable: true });
    await ch.assertQueue(DLQ, { durable: true });

    channel   = ch;
    connected = true;
    console.log(`[${serviceName}] RabbitMQ conectado → exchange: ${EXCHANGE}`);

    conn.on('error', (err) => {
      console.error(`[${serviceName}] RabbitMQ error:`, err.message);
      connected = false;
      channel   = null;
      setTimeout(() => connectRabbitMQ(serviceName), 5000);
    });
    conn.on('close', () => {
      console.warn(`[${serviceName}] RabbitMQ conexión cerrada — reintentando en 5s`);
      connected = false;
      channel   = null;
      setTimeout(() => connectRabbitMQ(serviceName), 5000);
    });
  } catch (err: any) {
    console.error(`[${serviceName}] RabbitMQ no disponible:`, err.message);
    setTimeout(() => connectRabbitMQ(serviceName), 5000);
  }
}

export function getChannel(): amqp.Channel | null {
  return channel;
}

export function isConnected(): boolean {
  return connected;
}
