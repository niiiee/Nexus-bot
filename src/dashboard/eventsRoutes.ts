import { Router, Request, Response } from 'express';
import { logger } from '../utils/logger.js';

export const eventsRouter = Router();

// Set of connected SSE client responses
const sseClients = new Set<Response>();

export interface DashboardEventPayload {
  type: 'incident' | 'new_member' | 'escrow_deal' | 'dispute_alert' | 'perk_purchase';
  data: Record<string, unknown>;
  timestamp: number;
}

/**
 * Server-Sent Events (SSE) stream endpoint for real-time dashboard telemetry
 */
eventsRouter.get('/events', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  sseClients.add(res);
  logger.info(`[Dashboard SSE] Client connected. Total active streams: ${sseClients.size}`);

  // Send initial ping
  res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: Date.now() })}\n\n`);

  req.on('close', () => {
    sseClients.delete(res);
    logger.info(`[Dashboard SSE] Client disconnected. Total active streams: ${sseClients.size}`);
  });
});

/**
 * Broadcasts an event to all connected dashboard clients
 */
export function broadcastDashboardEvent(type: DashboardEventPayload['type'], data: Record<string, unknown>): void {
  const payload: DashboardEventPayload = {
    type,
    data,
    timestamp: Date.now(),
  };

  const message = `data: ${JSON.stringify(payload)}\n\n`;

  for (const client of sseClients) {
    try {
      client.write(message);
    } catch {
      sseClients.delete(client);
    }
  }
}
