export type VendorPlatform = "zalo" | "facebook" | "wechat" | "tiktok" | "other";

export interface Vendor {
  id: string;
  name: string;
  platform: VendorPlatform;
  contact: string | null;
  notes: string | null;
}
