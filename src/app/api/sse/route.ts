import type { NextRequest } from "next/server";

import {
  sseNotifications,
  type NotificationType,
  type NotificationPayload,
} from "@/lib/sse/utils";
import { auth } from "@/features/auth/handlers";
import { SSEManager } from "@/lib/sse/sse-manager";

type Metadata = Record<string, unknown>;

const controllerClientIdMap = new WeakMap<
  ReadableStreamDefaultController<string>,
  string
>();

function safeParseJSON<T>(json: string): T | undefined {
  try {
    return JSON.parse(json) as T;
  } catch {
    return undefined;
  }
}

interface TestMessageRequest {
  type: string;
  message: string;
  userId?: string;
  sessionId?: string;
  clientId?: string;
  broadcast?: boolean;
  title?: string;
  priority?: "low" | "normal" | "high" | "urgent";
  data?: Record<string, any>;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);

  if (url.searchParams.get("stats")) {
    try {
      const stats = sseNotifications.getStats();
      return new Response(
        JSON.stringify({
          success: true,
          stats,
          timestamp: new Date().toISOString(),
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    } catch (error) {
      console.error("Error getting SSE stats:", error);
      return new Response(
        JSON.stringify({
          error: "Failed to get SSE statistics",
          message: error instanceof Error ? error.message : "Unknown error",
        }),
        {
          status: 500,
          headers: { "Content-Type": "application/json" },
        },
      );
    }
  }

  try {
    const session = await auth();

    const userId =
      url.searchParams.get("userId") ?? session?.user?.id ?? undefined;
    const sessionId = url.searchParams.get("sessionId") ?? undefined;
    const metadataParam = url.searchParams.get("metadata");

    const metadata = metadataParam
      ? (safeParseJSON<Metadata>(metadataParam) ?? {})
      : {};

    const sseManager = SSEManager.getInstance();

    const stream = new ReadableStream<string>({
      start(controller) {
        const clientId = sseManager.addClient(controller, {
          userId,
          sessionId,
          metadata: {
            ...metadata,
            userAgent: request.headers.get("user-agent") ?? "unknown",
            ip:
              request.headers.get("x-forwarded-for") ??
              request.headers.get("x-real-ip") ??
              "unknown",
            connectedAt: new Date().toISOString(),
          },
        });

        controllerClientIdMap.set(controller, clientId);

        request.signal.addEventListener("abort", () => {
          const id = controllerClientIdMap.get(controller);
          if (id) {
            sseManager.removeClient(id);
            controller.close();
          }
        });
      },

      cancel(controller) {
        const id = controllerClientIdMap.get(controller);
        if (id) {
          sseManager.removeClient(id);
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Content-Type, Cache-Control",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    console.error("SSE endpoint error:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to establish SSE connection",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: TestMessageRequest = await request.json();

    if (!body.type || (body.message === undefined && body.message !== "")) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: type, message" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const payload: NotificationPayload = {
      type: body.type as NotificationType,
      title: body.title ?? "Test Message",
      message: body.message,
      priority: body.priority ?? "normal",
      data: {
        ...body.data,
        testMessage: true,
        sentAt: new Date().toISOString(),
      },
    };

    let sentCount = 0;

    if (body.broadcast) {
      sentCount = await sseNotifications.broadcast(payload);
    } else if (body.clientId) {
      sentCount = await sseNotifications.sendRawEvent(
        { clientId: body.clientId },
        body.type,
        payload,
      );
    } else if (body.userId) {
      sentCount = await sseNotifications.notifyUser(body.userId, payload);
    } else if (body.sessionId) {
      sentCount = await sseNotifications.notifySession(body.sessionId, payload);
    } else {
      sentCount = await sseNotifications.broadcast(payload);
    }

    const stats = sseNotifications.getStats();

    return new Response(
      JSON.stringify({
        success: true,
        sentToClients: sentCount,
        payload,
        stats,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error in SSE test endpoint:", error);
    return new Response(
      JSON.stringify({
        error: "Failed to send test message",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Cache-Control",
    },
  });
}
