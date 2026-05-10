// Shared campaign category definitions — used by admin UI and email templates.

export interface CampaignCategory {
  value: string;
  label: string;
  emoji: string;
  /** Key into CAMPAIGN_PRESETS for auto-filling email content */
  presetKey: string;
}

export const CAMPAIGN_CATEGORIES: CampaignCategory[] = [
  { value: "black_friday",   label: "Black Friday",    emoji: "🖤", presetKey: "BLACK_FRIDAY" },
  { value: "cyber_monday",   label: "Cyber Monday",    emoji: "💻", presetKey: "CYBER_MONDAY" },
  { value: "valentines_day", label: "Valentine's Day", emoji: "❤️", presetKey: "VALENTINES_DAY" },
  { value: "mothers_day",    label: "Mother's Day",    emoji: "💐", presetKey: "MOTHERS_DAY" },
  { value: "womens_day",     label: "Women's Day",     emoji: "🌸", presetKey: "WOMENS_DAY" },
  { value: "birthday",       label: "Our Birthday",    emoji: "🎂", presetKey: "BIRTHDAY" },
  { value: "lunar_new_year", label: "Lunar New Year",  emoji: "🧧", presetKey: "LUNAR_NEW_YEAR" },
  { value: "christmas",      label: "Christmas",       emoji: "🎄", presetKey: "CHRISTMAS" },
  { value: "anniversary",    label: "Anniversary",     emoji: "🥂", presetKey: "ANNIVERSARY" },
  { value: "flash_sale",     label: "Flash Sale",      emoji: "⚡", presetKey: "FLASH_SALE" },
  { value: "vip_access",     label: "VIP Access",      emoji: "💎", presetKey: "VIP_ACCESS" },
  { value: "last_chance",    label: "Last Chance",     emoji: "⏰", presetKey: "LAST_CHANCE" },
];

export const CATEGORY_MAP = Object.fromEntries(
  CAMPAIGN_CATEGORIES.map((c) => [c.value, c])
) as Record<string, CampaignCategory>;

export function categoryLabel(value: string): string {
  return CATEGORY_MAP[value]?.label ?? value;
}

export function categoryEmoji(value: string): string {
  return CATEGORY_MAP[value]?.emoji ?? "◆";
}
