export type MuxWebhookEventType =
  | "video.upload.created"
  | "video.upload.asset_created"
  | "video.upload.cancelled"
  | "video.upload.errored"
  | "video.asset.created"
  | "video.asset.updated"
  | "video.asset.ready"
  | "video.asset.deleted"
  | "video.asset.errored";

export interface MuxAssetData {
  id: string;
  asset_id?: string;
  status?: string;
  duration?: number;
  playback_ids?: { id: string }[];
  static_renditions?: Array<{ name: string; url: string }>;
  error?: { message: string; code?: string };
  metadata?: { userId?: string };
  [key: string]: unknown;
}

export interface MuxWebhookPayloadBase {
  id: string;
  type: MuxWebhookEventType;
  data: MuxAssetData;
}
