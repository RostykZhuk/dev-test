# Nomey Web App

This is the official repository for the Nomey web app, built on the T3 Stack with custom extensions.

## Tech Stack

- [Next.js](https://nextjs.org) - App Framework
- [NextAuth.js](https://next-auth.js.org) - Authentication
- [Prisma](https://prisma.io) - Database ORM
- [Tailwind CSS](https://tailwindcss.com) - CSS Utility Framework
- [tRPC](https://trpc.io) - API Framework
- [Mux]() - Video handling (upload / storage / etc.)
- [tolgee](https://tolgee.io/) - Translation Management
- [Meilisearch](https://www.meilisearch.com/) - Full-text search
- [Upstash](https://upstash.com/) Next compatible redis
- [Qstash](https://upstash.com/docs/qstash) Next compatible queue handling
- [Vitest](https://vitest.dev/) - Testing Framework

## Testing

This project uses [Vitest](https://vitest.dev/) to run both client-side (browser) and server-side (Node.js) tests.

### Project Structure

Tests are split into two environments:

- **Browser (jsdom)** — for React/browser environment tests.
- **Node.js** — for backend and server-only logic.

### File Naming Conventions

- Node-specific tests: `*.node.test.ts`
- Browser tests: any other `*.test.ts`, `*.test.tsx`, etc.

### Running Tests

Run **all tests**:

```bash
npm run test
```

## Local Development

### Clone and Install

```bash
git clone git@github.com:nomeyy/nomey-next.git
cd nomey-next
npm install
```

### Run Containers

You'll need to have `docker` installed locally. We advise running `./scripts/start-services.sh` to safely start your environment, but a normal docker workflow will also work.

### Run Next

```bash
npm run dev
```

> ⚠️ **Warning:** The T3 stack hard-enforces environment variables to provide type-safety. The project will not build without all environment variables in place. Contact a dev to get their variables to quickly get yourself up and running.

## Learn More

- [Nomey Documentation (WIP)](https://nomey.mintlify.app/)
- [Next Documentation](https://nextjs.org/docs)
- [T3 Stack Documentation](https://create.t3.gg/en/usage/first-steps)
- [Mux Documentation](https://www.mux.com/docs)

# Server-Sent Events (SSE) Real-time Notification System

A comprehensive, production-ready SSE implementation for real-time server-to-client notifications with connection management, heartbeat support, and clean backend integration APIs.

## 🚀 Features

- **Centralized Connection Management**: Singleton-based SSE manager tracking all active connections
- **Multi-target Messaging**: Send to specific users, sessions, clients, or broadcast to all
- **Connection Lifecycle**: Automatic handling of connects, disconnects, and cleanup
- **Heartbeat System**: Keep connections alive with configurable ping intervals
- **Typed Notifications**: Pre-defined notification types with structured payloads
- **Error Handling**: Comprehensive error handling with custom error types

## 📋 Table of Contents

- [Installation & Setup](#installation--setup)
- [Core Architecture](#core-architecture)
- [API Reference](#api-reference)
- [Usage Examples](#usage-examples)
- [Configuration](#configuration)
- [Error Handling](#error-handling)
- [Testing](#testing)
- [Production Deployment](#production-deployment)

## 🔧 Installation & Setup

### Prerequisites

```bash
npm install crypto uuid
```

### Configuration

Update your SSE configuration file:

```typescript
// lib/sse/config.ts
export const SSE_CONFIG = {
  HEARTBEAT_INTERVAL: 30000,
  CLIENT_TIMEOUT: 120000,
  MAX_CLIENTS: 1000,
  ENABLE_HEARTBEAT: true,
  ENABLE_CLIENT_CLEANUP: true,
  LOG_CLIENT_CONNECTIONS: true,
  LOG_EVENT_DISPATCHING: false,
  ENABLE_DEBUG_LOGS: false,
};
```

### Basic Setup

```typescript
// app/api/sse/route.ts
import { SSEManager } from "@/lib/sse/sse-manager";
import { sseNotifications } from "@/lib/sse/utils";

export async function GET(request: NextRequest) {
  const sseManager = SSEManager.getInstance();

  const stream = new ReadableStream<string>({
    start(controller) {
      const clientId = sseManager.addClient(controller, {
        userId: "user123",
        sessionId: "session456",
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
```

## 🏗 Core Architecture

### SSE Manager

The central hub managing all SSE connections:

```typescript
import { SSEManager } from "@/lib/sse/sse-manager";

const sseManager = SSEManager.getInstance();

// Add client
const clientId = sseManager.addClient(controller, {
  userId: "user123",
  sessionId: "session456",
  metadata: { userAgent: "Mozilla/5.0..." },
});

// Send to specific client
sseManager.sendToClient(clientId, {
  event: "notification",
  data: { message: "Hello!" },
});

// Remove client
sseManager.removeClient(clientId);
```

### Notification Service

High-level abstraction for sending notifications:

```typescript
import {
  notifyUser,
  notifySession,
  broadcast,
  NotificationType,
} from "@/lib/sse/utils";

// Notify specific user
await notifyUser("user123", {
  type: NotificationType.USER_MESSAGE,
  title: "New Message",
  message: "You have a new message",
  priority: "high",
});

// Broadcast to all clients
await broadcast({
  type: NotificationType.SYSTEM_ALERT,
  title: "System Maintenance",
  message: "Scheduled maintenance in 10 minutes",
  priority: "urgent",
});
```

## 📖 API Reference

### SSE Manager Methods

#### `addClient(controller, options)`

Add a new SSE client connection.

```typescript
addClient(
  controller: ReadableStreamDefaultController<Uint8Array>,
  options: {
    userId?: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
  }
): string
```

#### `removeClient(clientId)`

Remove and cleanup a client connection.

```typescript
removeClient(clientId: string): boolean
```

#### `sendToClient(clientId, event)`

Send event to a specific client.

```typescript
sendToClient<T>(clientId: string, event: SSEEvent<T>): boolean
```

#### `sendToUser(userId, event)`

Send event to all connections for a user.

```typescript
sendToUser<T>(userId: string, event: SSEEvent<T>): number
```

#### `sendToSession(sessionId, event)`

Send event to all connections in a session.

```typescript
sendToSession<T>(sessionId: string, event: SSEEvent<T>): number
```

#### `broadcast(event)`

Send event to all connected clients.

```typescript
broadcast<T>(event: SSEEvent<T>): number
```

#### `getStats()`

Get connection statistics.

```typescript
getStats(): {
  totalClients: number;
  userClients: number;
  anonymousClients: number;
  uniqueUsers: number;
  uniqueSessions: number;
}
```

### Notification Types

```typescript
enum NotificationType {
  // System notifications
  SYSTEM_MESSAGE = "system.message",
  SYSTEM_ALERT = "system.alert",
  SYSTEM_MAINTENANCE = "system.maintenance",

  // User notifications
  USER_MESSAGE = "user.message",
  USER_MENTION = "user.mention",
  USER_FOLLOW = "user.follow",

  // Content notifications
  CONTENT_CREATED = "content.created",
  CONTENT_UPDATED = "content.updated",
  CONTENT_DELETED = "content.deleted",

  // Media processing
  MEDIA_UPLOAD_STARTED = "media.upload.started",
  MEDIA_UPLOAD_PROGRESS = "media.upload.progress",
  MEDIA_UPLOAD_COMPLETED = "media.upload.completed",
  MEDIA_UPLOAD_FAILED = "media.upload.failed",
  MEDIA_PROCESSING = "media.processing",
  MEDIA_READY = "media.ready",
  MEDIA_ERROR = "media.error",

  // Job processing
  JOB_STARTED = "job.started",
  JOB_PROGRESS = "job.progress",
  JOB_COMPLETED = "job.completed",
  JOB_FAILED = "job.failed",

  // Webhook events
  WEBHOOK_RECEIVED = "webhook.received",
  WEBHOOK_PROCESSED = "webhook.processed",
}
```

### Notification Payload

```typescript
interface NotificationPayload {
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
```

## 💡 Usage Examples

### Basic User Notification

```typescript
import { notifyUser, NotificationType } from "@/lib/sse/utils";

await notifyUser("user123", {
  type: NotificationType.USER_MESSAGE,
  title: "Welcome!",
  message: "Welcome to our platform",
  priority: "normal",
});
```

### File Upload Progress

```typescript
import { notifyUser, NotificationType } from "@/lib/sse/utils";

// Upload started
await notifyUser(userId, {
  type: NotificationType.MEDIA_UPLOAD_STARTED,
  title: "Upload Started",
  message: "Your file upload has begun",
  data: { filename: "video.mp4", size: 1024000 },
});

// Progress updates
await notifyUser(userId, {
  type: NotificationType.MEDIA_UPLOAD_PROGRESS,
  title: "Upload Progress",
  message: `Upload is 45% complete`,
  data: { progress: 45, filename: "video.mp4" },
});

// Upload completed
await notifyUser(userId, {
  type: NotificationType.MEDIA_UPLOAD_COMPLETED,
  title: "Upload Complete",
  message: "Your file has been uploaded successfully",
  data: { fileId: "file_123", url: "/files/file_123" },
  priority: "high",
});
```

### Job Processing Notifications

```typescript
import { notifyJobProgress } from "@/lib/sse/utils";

// Using helper function
await notifyJobProgress("user123", "job_456", 75, "Processing your data...");

// Manual notification
await notifyUser("user123", {
  type: NotificationType.JOB_COMPLETED,
  title: "Job Complete",
  message: "Your data processing job has finished",
  data: {
    jobId: "job_456",
    resultUrl: "/results/job_456",
    duration: "2m 30s",
  },
  persistent: true,
  actions: [{ id: "view", label: "View Results", action: "/results/job_456" }],
});
```

### Webhook Integration

```typescript
export async function POST(request: NextRequest) {
  const event = await parseWebhook(request);

  switch (event.type) {
    case "payment.succeeded":
      await notifyUser(event.userId, {
        type: NotificationType.SYSTEM_MESSAGE,
        title: "Payment Successful",
        message: "Your payment has been processed",
        data: { amount: event.amount, currency: event.currency },
        priority: "high",
      });
      break;

    case "video.ready":
      await notifyMediaEvent(event.userId, "ready", event.videoId, {
        duration: event.duration,
        thumbnail: event.thumbnail,
      });
      break;
  }
}
```

### Broadcasting System Messages

```typescript
import { broadcast, NotificationType } from "@/lib/sse/utils";

// Maintenance notification
await broadcast({
  type: NotificationType.SYSTEM_MAINTENANCE,
  title: "Scheduled Maintenance",
  message: "System will be down for maintenance in 15 minutes",
  priority: "urgent",
  persistent: true,
  actions: [{ id: "details", label: "More Info", action: "/maintenance" }],
});
```

### Session-based Notifications

```typescript
import { notifySession, NotificationType } from "@/lib/sse/utils";

// Notify all clients in a collaborative session
await notifySession("session_abc", {
  type: NotificationType.CONTENT_UPDATED,
  title: "Document Updated",
  message: "The document has been modified by another user",
  data: {
    documentId: "doc_123",
    updatedBy: "John Doe",
    changes: ["paragraph 2 modified"],
  },
});
```

## ⚙️ Configuration

### Environment Variables

```bash
# SSE Configuration
SSE_HEARTBEAT_INTERVAL=30000
SSE_CLIENT_TIMEOUT=120000
SSE_MAX_CLIENTS=1000
SSE_ENABLE_DEBUG=false
```

## 🚨 Error Handling

### Custom Error Types

```typescript
import {
  SSEError,
  ClientNotFoundError,
  ConnectionLimitError,
  handleSSEError,
} from "@/lib/sse/errors";

try {
  const clientId = sseManager.addClient(controller, options);
} catch (error) {
  if (error instanceof ConnectionLimitError) {
    return handleSSEError(error); // Returns 429 response
  }
  throw error;
}
```

### Error Response Format

```json
{
  "error": "CONNECTION_LIMIT_EXCEEDED",
  "message": "Connection limit of 1000 exceeded"
}
```

### Handling Client Errors

```typescript
// Automatic error handling in SSE Manager
sseManager.sendToClient(clientId, event); // Returns false if client not found

// Manual error checking
const client = sseManager.getClient(clientId);
if (!client) {
  throw new ClientNotFoundError(clientId);
}
```
