import { randomUUID } from 'crypto';
import { getChannel, EXCHANGE } from './rabbitmq.js';

export interface DomainEvent {
  eventId:       string;
  eventType:     string;
  eventVersion:  string;
  timestamp:     string;
  correlationId: string;
  source:        string;
  data:          Record<string, unknown>;
}

export function publish(
  routingKey: string,
  correlationId: string,
  data: Record<string, unknown>,
): DomainEvent {
  const event: DomainEvent = {
    eventId:      randomUUID(),
    eventType:    routingKey,
    eventVersion: '2.0',
    timestamp:    new Date().toISOString(),
    correlationId,
    source:       'operaciones-service',
    data,
  };

  const ch = getChannel();
  if (ch) {
    ch.publish(
      EXCHANGE,
      routingKey,
      Buffer.from(JSON.stringify(event)),
      { contentType: 'application/json', persistent: true, messageId: event.eventId },
    );
    console.log(`[operaciones-service] ✉️  ${routingKey} → ${event.eventId}`);
  } else {
    console.warn(`[operaciones-service] RabbitMQ no conectado — evento local: ${routingKey}`);
  }

  return event;
}
