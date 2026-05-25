import { Server as HttpServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { logger } from '../lib/logger.js';
import type { AuthPayload } from '../middleware/auth.js';

interface ConnectedClient {
  ws: WebSocket;
  userId: string;
}

const clients: Map<string, Set<ConnectedClient>> = new Map();

let wss: WebSocketServer | null = null;

export function initWebSocket(server: HttpServer): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Authentication required');
      return;
    }

    let payload: AuthPayload;
    try {
      payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    } catch {
      ws.close(4001, 'Invalid or expired token');
      return;
    }

    const client: ConnectedClient = { ws, userId: payload.userId };

    if (!clients.has(payload.userId)) {
      clients.set(payload.userId, new Set());
    }
    clients.get(payload.userId)!.add(client);

    logger.info('WebSocket client connected', { userId: payload.userId });

    ws.send(JSON.stringify({ event: 'connected', data: { userId: payload.userId } }));

    ws.on('close', () => {
      const userClients = clients.get(payload.userId);
      if (userClients) {
        userClients.delete(client);
        if (userClients.size === 0) {
          clients.delete(payload.userId);
        }
      }
      logger.info('WebSocket client disconnected', { userId: payload.userId });
    });

    ws.on('error', (err) => {
      logger.error('WebSocket error', { userId: payload.userId, error: err.message });
    });
  });

  return wss;
}

export function broadcastToUser(userId: string, event: string, data: unknown): void {
  const userClients = clients.get(userId);
  if (!userClients) return;

  const message = JSON.stringify({ event, data });
  for (const client of userClients) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

export function broadcastToAll(event: string, data: unknown): void {
  const message = JSON.stringify({ event, data });
  for (const userClients of clients.values()) {
    for (const client of userClients) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(message);
      }
    }
  }
}

export function getConnectedCount(): number {
  let count = 0;
  for (const userClients of clients.values()) {
    count += userClients.size;
  }
  return count;
}

export function getWss(): WebSocketServer | null {
  return wss;
}
