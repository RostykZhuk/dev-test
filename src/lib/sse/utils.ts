import { SSEManager } from "./sse-manager";
import type { ClientId, UserId, SessionId, SSEEvent } from "./types";

export enum NotificationType {
  SYSTEM_MESSAGE = "system.message",
  SYSTEM_ALERT = "system.alert",
  SYSTEM_MAINTENANCE = "system.maintenance",

  USER_MESSAGE = "user.message",
  USER_MENTION = "user.mention",
  USER_FOLLOW = "user.follow",

  CONTENT_CREATED = "content.created",
  CONTENT_UPDATED = "content.updated",
  CONTENT_DELETED = "content.deleted",

  MEDIA_UPLOAD_STARTED = "media.upload.started",
  MEDIA_UPLOAD_PROGRESS = "media.upload.progress",
  MEDIA_UPLOAD_COMPLETED = "media.upload.completed",
  MEDIA_UPLOAD_FAILED = "media.upload.failed",
  MEDIA_PROCESSING = "media.processing",
  MEDIA_READY = "media.ready",
  MEDIA_ERROR = "media.error",

  JOB_STARTED = "job.started",
  JOB_PROGRESS = "job.progress",
  JOB_COMPLETED = "job.completed",
  JOB_FAILED = "job.failed",

  WEBHOOK_RECEIVED = "webhook.received",
  WEBHOOK_PROCESSED = "webhook.processed",
}

export interface NotificationPayload {
  type: NotificationType;
  title?: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  persistent?: boolean;
  actions?: Array<{
    id: string;
    label: string;
    action: string;
  }>;
}

// Service class wrapping SSEManager to handle notification sending and formatting
export class SSENotificationService {
  private sseManager: SSEManager;

  constructor() {
    this.sseManager = SSEManager.getInstance();
  }

  /**
   * Send a notification event to all SSE clients of a given userId
   * @param userId - Target user identifier
   * @param payload - Notification details
   * @returns Number of clients notified successfully
   */
  async notifyUser(
    userId: UserId,
    payload: NotificationPayload,
  ): Promise<number> {
    const enrichedPayload = this.enrichPayload(payload);

    const sentCount =
      this.sseManager.sendToUser(userId, {
        event: payload.type,
        data: enrichedPayload,
        id: this.generateEventId(),
      }) ?? 0;

    console.log(`Notification sent to user ${userId}:`, {
      type: payload.type,
      sentToClients: sentCount,
    });

    return sentCount;
  }

  /**
   * Send notifications to multiple users
   * @param userIds - List of user identifiers
   * @param payload - Notification details
   * @returns Total number of clients notified
   */
  async notifyUsers(
    userIds: UserId[],
    payload: NotificationPayload,
  ): Promise<number> {
    let totalSent = 0;
    for (const userId of userIds) {
      totalSent += await this.notifyUser(userId, payload);
    }
    return totalSent;
  }

  /**
   * Send a notification to all SSE clients within a session
   * @param sessionId - Session identifier
   * @param payload - Notification details
   * @returns Number of clients notified successfully
   */
  async notifySession(
    sessionId: SessionId,
    payload: NotificationPayload,
  ): Promise<number> {
    const enrichedPayload = this.enrichPayload(payload);

    const sentCount =
      this.sseManager.sendToSession(sessionId, {
        event: payload.type,
        data: enrichedPayload,
        id: this.generateEventId(),
      }) ?? 0;

    console.log(`Notification sent to session ${sessionId}:`, {
      type: payload.type,
      sentToClients: sentCount,
    });

    return sentCount;
  }

  /**
   * Broadcast a notification event to all connected SSE clients
   * @param payload - Notification details
   * @returns Number of clients notified successfully
   */
  async broadcast(payload: NotificationPayload): Promise<number> {
    const enrichedPayload = this.enrichPayload(payload);

    const sentCount =
      this.sseManager.broadcast({
        event: payload.type,
        data: enrichedPayload,
        id: this.generateEventId(),
      }) ?? 0;

    console.log(`Broadcast notification sent:`, {
      type: payload.type,
      sentToClients: sentCount,
    });

    return sentCount;
  }

  /**
   * Send a raw SSE event to specific target(s)
   * @param target - Can be "broadcast", or specific clientId/userId/sessionId
   * @param event - Event name
   * @param data - Event payload data
   * @returns Number of clients notified
   */
  async sendRawEvent(
    target:
      | { userId?: UserId; sessionId?: SessionId; clientId?: ClientId }
      | "broadcast",
    event: string,
    data: unknown,
  ): Promise<number> {
    const eventData: SSEEvent = {
      event,
      data,
      id: this.generateEventId(),
    };

    if (target === "broadcast") {
      return this.sseManager.broadcast(eventData) ?? 0;
    } else if (target.clientId) {
      return this.sseManager.sendToClient(target.clientId, eventData) ? 1 : 0;
    } else if (target.userId) {
      return this.sseManager.sendToUser(target.userId, eventData) ?? 0;
    } else if (target.sessionId) {
      return this.sseManager.sendToSession(target.sessionId, eventData) ?? 0;
    }
    return 0;
  }

  /**
   * Retrieve current SSE client statistics
   * @returns Object with counts of connected clients and unique users/sessions
   */
  getStats() {
    return this.sseManager.getStats();
  }

  // Add timestamp, default priority, and persistence flags if missing
  private enrichPayload(payload: NotificationPayload): NotificationPayload {
    return {
      ...payload,
      timestamp: payload.timestamp ?? new Date().toISOString(),
      priority: payload.priority ?? "normal",
      persistent: payload.persistent ?? false,
    };
  }

  // Generate a unique ID for SSE events
  private generateEventId(): string {
    return `sse_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }
}

export const sseNotifications = new SSENotificationService();

// Helper functions for easier imports and usage
export const notifyUser = (userId: UserId, payload: NotificationPayload) =>
  sseNotifications.notifyUser(userId, payload);

export const notifyUsers = (userIds: UserId[], payload: NotificationPayload) =>
  sseNotifications.notifyUsers(userIds, payload);

export const broadcast = (payload: NotificationPayload) =>
  sseNotifications.broadcast(payload);

export const notifySession = (
  sessionId: SessionId,
  payload: NotificationPayload,
) => sseNotifications.notifySession(sessionId, payload);

// Convenience function to notify user of a received webhook event
export const notifyWebhookEvent = async (
  userId: UserId,
  webhookType: string,
  data: unknown,
) => {
  return notifyUser(userId, {
    type: NotificationType.WEBHOOK_RECEIVED,
    title: `Webhook: ${webhookType}`,
    message: `Received ${webhookType} webhook event`,
    data: {
      webhookType,
      payload: data,
      processedAt: new Date().toISOString(),
    },
    priority: "normal",
  });
};

// Convenience function to notify user of job progress updates
export const notifyJobProgress = async (
  userId: UserId,
  jobId: string,
  progress: number,
  message?: string,
) => {
  return notifyUser(userId, {
    type: NotificationType.JOB_PROGRESS,
    title: "Job Progress",
    message: message ?? `Job ${jobId} is ${progress}% complete`,
    data: {
      jobId,
      progress,
      updatedAt: new Date().toISOString(),
    },
    priority: "low",
  });
};

// Convenience function to notify user about media events like upload, processing, ready, error
export const notifyMediaEvent = async (
  userId: UserId,
  eventType: "upload" | "processing" | "ready" | "error",
  assetId: string,
  data?: Record<string, unknown>,
) => {
  const typeMap: Record<typeof eventType, NotificationType> = {
    upload: NotificationType.MEDIA_UPLOAD_STARTED,
    processing: NotificationType.MEDIA_PROCESSING,
    ready: NotificationType.MEDIA_READY,
    error: NotificationType.MEDIA_ERROR,
  };

  return notifyUser(userId, {
    type: typeMap[eventType],
    title: `Media ${eventType}`,
    message: `Media asset ${assetId} is ${eventType}`,
    data: {
      assetId,
      eventType,
      ...data,
      timestamp: new Date().toISOString(),
    },
    priority: eventType === "error" ? "high" : "normal",
  });
};
