import { randomUUID } from "crypto";
import { SSE_CONFIG } from "./config";

interface SSEClient {
  id: string;
  userId?: string;
  sessionId?: string;
  controller: ReadableStreamDefaultController<Uint8Array | string>;
  lastPing: number;
  metadata?: Record<string, unknown>;
}

interface SSEEvent<T = unknown> {
  id?: string;
  event?: string;
  data: T;
  retry?: number;
}

export class SSEManager<TEventData = unknown> {
  private static instance: SSEManager;
  private clients = new Map<string, SSEClient>();
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // Configuration constants from SSE_CONFIG
  private readonly HEARTBEAT_INTERVAL = SSE_CONFIG.HEARTBEAT_INTERVAL;
  private readonly CLIENT_TIMEOUT = SSE_CONFIG.CLIENT_TIMEOUT;
  private readonly MAX_CLIENTS = SSE_CONFIG.MAX_CLIENTS;

  private constructor() {
    // Start periodic heartbeat to keep connections alive and cleanup stale clients
    this.startHeartbeat();
  }

  public static getInstance(): SSEManager {
    if (!SSEManager.instance) {
      SSEManager.instance = new SSEManager();
    }
    return SSEManager.instance;
  }

  /**
   * Add a new SSE client connection
   * @param controller - Stream controller to send messages to client
   * @param options - Optional userId, sessionId and metadata for client identification
   * @returns unique client ID
   * @throws error if maximum client connections exceeded
   */
  public addClient(
    controller: ReadableStreamDefaultController<Uint8Array>,
    options: {
      userId?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): string {
    if (this.clients.size >= this.MAX_CLIENTS) {
      throw new Error(`Connection limit of ${this.MAX_CLIENTS} exceeded`);
    }

    const clientId = randomUUID();
    const client: SSEClient = {
      id: clientId,
      userId: options.userId,
      sessionId: options.sessionId,
      controller,
      lastPing: Date.now(),
      metadata: options.metadata,
    };

    this.clients.set(clientId, client);

    if (SSE_CONFIG.LOG_CLIENT_CONNECTIONS) {
      console.log(`SSE Client connected: ${clientId}`, {
        userId: options.userId,
        sessionId: options.sessionId,
        totalClients: this.clients.size,
      });
    }

    this.sendToClient(clientId, {
      event: "connected",
      data: { clientId, timestamp: new Date().toISOString() },
    });

    return clientId;
  }

  // Remove a client connection by ID, closing the stream
  public removeClient(clientId: string): boolean {
    const client = this.clients.get(clientId);
    if (!client) return false;

    try {
      client.controller.close();
    } catch (error) {
      console.warn(`Error closing SSE client ${clientId}:`, error);
    }

    this.clients.delete(clientId);

    if (SSE_CONFIG.LOG_CLIENT_CONNECTIONS) {
      console.log(`SSE Client disconnected: ${clientId}`, {
        userId: client?.userId,
        sessionId: client?.sessionId,
        totalClients: this.clients.size,
      });
    }

    return true;
  }

  /**
   * Get a client by its ID
   * @param clientId - Client ID
   * @returns SSEClient object or undefined if not found
   */
  public getClient(clientId: string): SSEClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get all clients associated with a specific userId
   * @param userId - User identifier
   * @returns Array of SSEClient objects matching the userId
   */
  public getClientsByUser(userId: string): SSEClient[] {
    return Array.from(this.clients.values()).filter(
      (client) => client.userId === userId,
    );
  }

  /**
   * Get all clients associated with a specific sessionId
   * @param sessionId - Session identifier
   * @returns Array of SSEClient objects matching the sessionId
   */
  public getClientsBySession(sessionId: string): SSEClient[] {
    return Array.from(this.clients.values()).filter(
      (client) => client.sessionId === sessionId,
    );
  }

  /**
   * Send an SSE event to a single client by ID
   * @param clientId - Target client ID
   * @param event - SSEEvent object to send
   * @returns true if sent successfully, false otherwise
   */
  public sendToClient<T>(clientId: string, event: SSEEvent<T>): boolean {
    const client = this.clients.get(clientId);
    if (!client) {
      if (SSE_CONFIG.ENABLE_DEBUG_LOGS) {
        console.warn(`Client ${clientId} not found`);
      }
      return false;
    }

    try {
      const message = this.formatSSEMessage(event);
      client.controller.enqueue(new TextEncoder().encode(message));
      client.lastPing = Date.now();

      if (SSE_CONFIG.LOG_EVENT_DISPATCHING) {
        console.log(`Sent event "${event.event}" to client ${clientId}`);
      }

      return true;
    } catch (error) {
      console.error(`Error sending to client ${clientId}:`, error);
      this.removeClient(clientId);
      return false;
    }
  }

  /**
   * Send an SSE event to multiple clients by their IDs
   * @param clientIds - Array of client IDs
   * @param event - SSEEvent object to send
   * @returns Number of successful sends
   */
  public sendToClients<T>(clientIds: string[], event: SSEEvent<T>): number {
    let successCount = 0;
    clientIds.forEach((clientId) => {
      if (this.sendToClient(clientId, event)) {
        successCount++;
      }
    });
    return successCount;
  }

  /**
   * Send an SSE event to all clients of a specific user
   * @param userId - User identifier
   * @param event - SSEEvent object to send
   * @returns Number of successful sends
   */
  public sendToUser<T>(userId: string, event: SSEEvent<T>): number {
    return this.sendToClients(
      this.getClientsByUser(userId).map((c) => c.id),
      event,
    );
  }

  /**
   * Send an SSE event to all clients of a specific session
   * @param sessionId - Session identifier
   * @param event - SSEEvent object to send
   * @returns Number of successful sends
   */
  public sendToSession<T>(sessionId: string, event: SSEEvent<T>): number {
    return this.sendToClients(
      this.getClientsBySession(sessionId).map((c) => c.id),
      event,
    );
  }

  /**
   * Broadcast an SSE event to all connected clients
   * @param event - SSEEvent object to send
   * @returns Number of successful sends
   */
  public broadcast<T>(event: SSEEvent<T>): number {
    return this.sendToClients(Array.from(this.clients.keys()), event);
  }

  /**
   * Get statistics about current connected clients
   * @returns Object containing counts of total, user, anonymous clients and unique users and sessions
   */
  public getStats() {
    const clients = Array.from(this.clients.values());

    return {
      totalClients: clients.length,
      userClients: clients.filter((c) => c.userId).length,
      anonymousClients: clients.filter((c) => !c.userId).length,
      uniqueUsers: new Set(clients.filter((c) => c.userId).map((c) => c.userId))
        .size,
      uniqueSessions: new Set(
        clients.filter((c) => c.sessionId).map((c) => c.sessionId),
      ).size,
    };
  }

  // Start periodic heartbeat to keep SSE connections alive and cleanup stale clients
  private startHeartbeat(): void {
    if (!SSE_CONFIG.ENABLE_HEARTBEAT) return;

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      this.sendHeartbeat();
      if (SSE_CONFIG.ENABLE_CLIENT_CLEANUP) {
        this.cleanupStaleClients();
      }
    }, this.HEARTBEAT_INTERVAL);

    if (SSE_CONFIG.ENABLE_DEBUG_LOGS) {
      console.log("SSE Heartbeat started");
    }
  }

  // Send heartbeat event to all connected clients
  private sendHeartbeat(): void {
    const activeClients = this.broadcast({
      event: "heartbeat",
      data: { timestamp: new Date().toISOString() },
    });

    if (activeClients > 0 && SSE_CONFIG.ENABLE_DEBUG_LOGS) {
      console.log(`Heartbeat sent to ${activeClients} clients`);
    }
  }

  // Remove clients which have not pinged within CLIENT_TIMEOUT period
  private cleanupStaleClients(): void {
    const now = Date.now();
    const staleClients = Array.from(this.clients.entries())
      .filter(([_, client]) => now - client.lastPing > this.CLIENT_TIMEOUT)
      .map(([id]) => id);

    staleClients.forEach((clientId) => {
      if (SSE_CONFIG.ENABLE_DEBUG_LOGS) {
        console.log(`Removing stale client: ${clientId}`);
      }
      this.removeClient(clientId);
    });

    if (staleClients.length > 0 && SSE_CONFIG.ENABLE_DEBUG_LOGS) {
      console.log(`Cleaned up ${staleClients.length} stale clients`);
    }
  }

  /**
   * Format an SSEEvent object into a properly formatted SSE message string
   * @param event - SSEEvent object
   * @returns Formatted string to send via SSE stream
   */
  private formatSSEMessage<T>(event: SSEEvent<T>): string {
    let message = "";

    if (event.id) {
      message += `id: ${event.id}\n`;
    }
    if (event.event) {
      message += `event: ${event.event}\n`;
    }
    if (event.retry) {
      message += `retry: ${event.retry}\n`;
    }

    const dataString =
      typeof event.data === "string" ? event.data : JSON.stringify(event.data);

    dataString.split("\n").forEach((line) => {
      message += `data: ${line}\n`;
    });

    return message + "\n";
  }

  // Cleanup all clients and stop heartbeat interval
  public cleanup(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    Array.from(this.clients.keys()).forEach((id) => this.removeClient(id));
    if (SSE_CONFIG.ENABLE_DEBUG_LOGS) {
      console.log("SSE Manager cleaned up");
    }
  }
}
