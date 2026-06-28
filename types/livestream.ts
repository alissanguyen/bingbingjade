export type LivestreamStatus = "draft" | "live" | "ended";
export type LivestreamPlatform = "instagram" | "tiktok" | "other";
export type LivestreamItemStatus = "available" | "checkout_sent" | "paid" | "passed" | "cancelled";
export type BackupBuyerStatus = "waiting" | "offered" | "declined" | "purchased";

export interface Livestream {
  id: string;
  title: string;
  platform: LivestreamPlatform;
  scheduled_at: string | null;
  code_prefix: string;
  item_count: number;
  status: LivestreamStatus;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LivestreamItem {
  id: string;
  livestream_id: string;
  code: string;
  display_order: number;
  product_id: string | null;
  title_snapshot: string;
  size: string | null;
  price: number;
  minimum_price: number | null;
  checkout_price: number | null;
  price_override_note: string | null;
  status: LivestreamItemStatus;
  buyer_handle: string | null;
  buyer_platform: string | null;
  checkout_url: string | null;
  checkout_token: string;
  checkout_session_id: string | null;
  checkout_expires_at: string | null;
  checkout_active: boolean;
  order_id: string | null;
  public_notes: string | null;
  private_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface LivestreamItemEvent {
  id: string;
  livestream_item_id: string;
  event_type: string;
  message: string | null;
  buyer_handle: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  created_by: string | null;
}

export interface LivestreamBackupBuyer {
  id: string;
  livestream_item_id: string;
  buyer_handle: string;
  buyer_platform: string | null;
  position: number;
  status: BackupBuyerStatus;
  created_at: string;
}
