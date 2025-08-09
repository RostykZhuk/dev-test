import { type NextRequest } from "next/server";
import { headers } from "next/headers";
import { muxWebhookService } from "@/features/mux";
import {
  notifyUser,
  notifyMediaEvent,
  NotificationType,
  broadcast,
} from "@/lib/sse/utils";
import type { UserId } from "@/lib/sse/types";

function toUserId(id: string): UserId {
  return id as UserId;
}

export async function POST(request: NextRequest) {
  try {
    const headersList = await headers();
    const body = await request.text();

    // Verify webhook authenticity and parse event payload
    const rawEvent = await muxWebhookService.verifyWebhookEvent(
      body,
      headersList,
    );
    const event = rawEvent;

    const userIdString = event.data.metadata?.userId;
    const userId = userIdString ? toUserId(userIdString as string) : undefined;

    console.log(`Processing Mux webhook: ${event.type}`, {
      eventId: event.id,
      userId,
      assetId: event.data.id,
    });

    // Handle different webhook event types
    switch (event.type) {
      case "video.upload.created": {
        if (userId) {
          await notifyUser(userId, {
            type: NotificationType.MEDIA_UPLOAD_STARTED,
            title: "Video Upload Started",
            message: "Your video upload has been initiated",
            data: {
              uploadId: event.data.id,
              status: "created",
              webhookData: event.data,
            },
            priority: "normal",
          });
        }
        break;
      }

      case "video.upload.asset_created": {
        if (userId) {
          await notifyUser(userId, {
            type: NotificationType.MEDIA_UPLOAD_COMPLETED,
            title: "Upload Complete",
            message:
              "Your video has been uploaded successfully and is now processing",
            data: {
              assetId: event.data.asset_id,
              uploadId: event.data.id,
              status: "asset_created",
              webhookData: event.data,
            },
            priority: "normal",
          });
        }
        break;
      }

      case "video.upload.cancelled": {
        if (userId) {
          await notifyUser(userId, {
            type: NotificationType.MEDIA_UPLOAD_FAILED,
            title: "Upload Cancelled",
            message: "Your video upload was cancelled",
            data: {
              uploadId: event.data.id,
              status: "cancelled",
              reason: "User cancelled or upload timeout",
              webhookData: event.data,
            },
            priority: "high",
          });
        }
        break;
      }

      case "video.upload.errored": {
        if (userId) {
          await notifyUser(userId, {
            type: NotificationType.MEDIA_UPLOAD_FAILED,
            title: "Upload Failed",
            message: "There was an error uploading your video",
            data: {
              uploadId: event.data.id,
              status: "error",
              error: event.data.error,
              webhookData: event.data,
            },
            priority: "high",
          });
        }
        break;
      }

      case "video.asset.created": {
        if (userId) {
          await notifyMediaEvent(userId, "processing", event.data.id, {
            status: "created",
            duration: event.data.duration,
            webhookData: event.data,
          });
        }
        break;
      }

      case "video.asset.updated": {
        if (userId) {
          await notifyUser(userId, {
            type: NotificationType.MEDIA_PROCESSING,
            title: "Processing Update",
            message: "Your video processing has been updated",
            data: {
              assetId: event.data.id,
              status: event.data.status,
              playbackUrl: event.data.playback_ids?.[0]?.id,
              webhookData: event.data,
            },
            priority: "low",
          });
        }
        break;
      }

      case "video.asset.ready": {
        if (userId) {
          const renditions = Array.isArray(event.data.static_renditions)
            ? (event.data.static_renditions as { name: string; url: string }[])
            : [];

          await notifyMediaEvent(userId, "ready", event.data.id, {
            status: "ready",
            duration: event.data.duration,
            playbackUrl: event.data.playback_ids?.[0]?.id,
            thumbnailUrl: renditions.find((r) => r.name === "medium.jpg")?.url,
            webhookData: event.data,
          });

          await notifyUser(userId, {
            type: NotificationType.MEDIA_READY,
            title: "Video Ready! 🎉",
            message: "Your video has been processed and is ready to watch",
            data: {
              assetId: event.data.id,
              playbackUrl: event.data.playback_ids?.[0]?.id,
              viewUrl: `/watch/${event.data.id}`,
            },
            priority: "high",
            persistent: true,
            actions: [
              {
                id: "view",
                label: "Watch Now",
                action: `/watch/${event.data.id}`,
              },
            ],
          });
        }
        break;
      }

      case "video.asset.deleted": {
        if (userId) {
          await notifyUser(userId, {
            type: NotificationType.CONTENT_DELETED,
            title: "Video Deleted",
            message: "Your video has been deleted",
            data: {
              assetId: event.data.id,
              status: "deleted",
              webhookData: event.data,
            },
            priority: "normal",
          });
        }
        break;
      }

      case "video.asset.errored": {
        if (userId) {
          await notifyMediaEvent(userId, "error", event.data.id, {
            status: "error",
            error: event.data.errors,
            webhookData: event.data,
          });

          await notifyUser(userId, {
            type: NotificationType.MEDIA_ERROR,
            title: "Video Processing Failed",
            message: "There was an error processing your video",
            data: {
              assetId: event.data.id,
              error: event.data.errors,
              supportTicket: `Create support ticket for asset ${event.data.id}`,
              webhookData: event.data,
            },
            priority: "high",
            persistent: true,
            actions: [
              {
                id: "retry",
                label: "Try Again",
                action: `/upload?retry=${event.data.id}`,
              },
              {
                id: "support",
                label: "Contact Support",
                action: "/support",
              },
            ],
          });
        }
        break;
      }

      default: {
        await broadcast({
          type: NotificationType.WEBHOOK_RECEIVED,
          title: "Unhandled Webhook",
          message: `Received unhandled webhook: ${event.type as string}`,
          data: {
            eventType: event.type,
            eventId: event.id,
            webhookData: event.data,
          },
          priority: "low",
        });
        break;
      }
    }

    return Response.json(
      {
        message: "ok",
        processed: true,
        eventType: event.type,
        notificationsSent: userId ? 1 : 0,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error processing Mux webhook:", error);

    await broadcast({
      type: NotificationType.SYSTEM_ALERT,
      title: "Webhook Processing Error",
      message: "Failed to process Mux webhook",
      data: {
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      priority: "urgent",
    });

    return Response.json(
      {
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
