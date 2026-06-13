import { randomUUID } from 'crypto';
import { getChannel, EXCHANGE } from './rabbitmq.js';
import { logger } from '../shared/logger.js';

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
    logger.info('evento publicado', { routingKey, eventId: event.eventId, correlationId });
  } else {
    logger.warn('RabbitMQ no conectado — evento no enviado', { routingKey });
  }

  return event;
}
