// Extended ReadableStreamDefaultController with clientId
declare global {
  interface ReadableStreamDefaultController {
    clientId?: string;
  }
}

// Strong ID types for better type safety
export type ClientId = string & { readonly brand: unique symbol };
export type UserId = string & { readonly brand: unique symbol };
export type SessionId = string & { readonly brand: unique symbol };

// SSE Client interface
export interface SSEClient<Meta = unknown> {
  id: ClientId;
  userId?: UserId;
  sessionId?: SessionId;
  controller: ReadableStreamDefaultController;
  lastPing: number;
  metadata?: Record<string, Meta>;
}

// SSE Event interface
export interface SSEEvent<T = unknown> {
  id?: string;
  event?: string;
  data: T;
  retry?: number;
}

// SSE Manager configuration
export interface SSEManagerConfig {
  heartbeatInterval?: number;
  clientTimeout?: number;
  maxClients?: number;
  enableLogging?: boolean;
}

// Client connection options
export interface ClientConnectionOptions<Meta = unknown> {
  userId?: UserId;
  sessionId?: SessionId;
  metadata?: Record<string, Meta>;
}

// SSE Statistics interface
export interface SSEStats {
  totalClients: number;
  userClients: number;
  anonymousClients: number;
  uniqueUsers: number;
  uniqueSessions: number;
}

// Event target types for routing
export type EventTarget =
  | { type: "client"; clientId: ClientId }
  | { type: "user"; userId: UserId }
  | { type: "session"; sessionId: SessionId }
  | { type: "clients"; clientIds: ClientId[] }
  | { type: "users"; userIds: UserId[] }
  | { type: "broadcast" };

// SSE Manager interface
export interface ISSEManager<Meta = unknown, Payload = unknown> {
  addClient(
    controller: ReadableStreamDefaultController,
    options?: ClientConnectionOptions<Meta>,
  ): ClientId;

  removeClient(clientId: ClientId): boolean;

  getClient(clientId: ClientId): SSEClient<Meta> | undefined;

  getClientsByUser(userId: UserId): SSEClient<Meta>[];

  getClientsBySession(sessionId: SessionId): SSEClient<Meta>[];

  sendToClient(clientId: ClientId, event: SSEEvent<Payload>): boolean;

  sendToClients(clientIds: ClientId[], event: SSEEvent<Payload>): number;

  sendToUser(userId: UserId, event: SSEEvent<Payload>): number;

  sendToSession(sessionId: SessionId, event: SSEEvent<Payload>): number;

  broadcast(event: SSEEvent<Payload>): number;

  getStats(): SSEStats;

  cleanup(): void;
}
