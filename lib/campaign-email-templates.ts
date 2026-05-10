// Email template registry — maps campaign_events.category to available email templates.
// Each entry lists templates in preference order; add more as variants are created.
// presetKey references a key in CAMPAIGN_PRESETS.

export interface EmailTemplate {
  presetKey: string;
  label: string;
}

export const CATEGORY_TEMPLATES: Record<string, EmailTemplate[]> = {
  black_friday:   [{ presetKey: "BLACK_FRIDAY",   label: "Black Friday" }],
  cyber_monday:   [{ presetKey: "CYBER_MONDAY",   label: "Cyber Monday" }],
  valentines_day: [{ presetKey: "VALENTINES",     label: "Valentine's Day" }],
  mothers_day:    [{ presetKey: "MOTHERS_DAY",    label: "Mother's Day" }],
  womens_day:     [{ presetKey: "WOMENS_DAY",     label: "Women's Day" }],
  birthday:       [{ presetKey: "BINGBING_BDAY",  label: "Our Birthday" }],
  lunar_new_year: [{ presetKey: "LUNAR_NEW_YEAR", label: "Lunar New Year" }],
  christmas:      [{ presetKey: "CHRISTMAS",      label: "Christmas" }],
  anniversary:    [{ presetKey: "ANNIVERSARY",    label: "Anniversary" }],
  flash_sale:     [{ presetKey: "FLASH_SALE",     label: "Flash Sale" }],
  vip_access:     [{ presetKey: "VIP",            label: "VIP Access" }],
  last_chance:    [{ presetKey: "LAST_CHANCE",    label: "Last Chance" }],
};

/** Returns the ordered template list for a campaign category; empty array if unknown. */
export function getTemplatesForCategory(category: string): EmailTemplate[] {
  return CATEGORY_TEMPLATES[category] ?? [];
}
