// Campaign email presets — add new campaigns here.

export interface CampaignPreset {
  label: string;
  emoji: string;
  /** Tailwind color name used in admin UI only */
  color: string;
  subject: string;
  headline: string;
  intro: string;
  urgency?: string;
  cta: string;
  ctaLink: string;
}

export const CAMPAIGN_PRESETS = {
  BLACK_FRIDAY: {
    label: "Black Friday",
    emoji: "🖤",
    color: "gray",
    subject: "Private Access: Black Friday Begins",
    headline: "Black Friday, Refined.",
    intro:
      "A small selection of jadeite pieces is now available at a special value. No chaos, no rush — just thoughtfully chosen pieces, offered quietly.",
    urgency: "Limited release · While pieces remain",
    cta: "Enter Private Access",
    ctaLink: "/products",
  },

  CYBER_MONDAY: {
    label: "Cyber Monday",
    emoji: "💻",
    color: "blue",
    subject: "Cyber Monday — Rare Finds, Quietly Available",
    headline: "Rare Finds, No Rush.",
    intro:
      "A select few pieces are available at a special value today. No countdown timers. No pressure. Simply beautiful jadeite, yours if you'd like.",
    urgency: "Today only · While pieces remain",
    cta: "View Available Pieces",
    ctaLink: "/products",
  },

  VALENTINES: {
    label: "Valentine's Day",
    emoji: "🌹",
    color: "rose",
    subject: "For You, or Someone You Love",
    headline: "A Gift She'll Treasure for a Lifetime.",
    intro:
      "Jade is more than jewelry — it's something carried, remembered, and passed on. This Valentine's, choose something that lasts longer than the moment.",
    urgency: "Arrives in time for Valentine's Day",
    cta: "Explore Gifts",
    ctaLink: "/products",
  },

  MOTHERS_DAY: {
    label: "Mother's Day",
    emoji: "🌸",
    color: "pink",
    subject: "For the Woman Who Gave You Everything",
    headline: "A Gift Worth Giving Back.",
    intro:
      "Some things can't be repaid — but they can be honored. Jadeite is a symbol of protection, strength, and love. A meaningful piece, for someone who means everything.",
    urgency: "Mother's Day is approaching",
    cta: "Find Her Piece",
    ctaLink: "/products",
  },

  WOMENS_DAY: {
    label: "Women's Day",
    emoji: "💜",
    color: "violet",
    subject: "Celebrating Her — March 8",
    headline: "Strength, Grace, and Everything In Between.",
    intro:
      "Today is a quiet celebration of women — their resilience, their beauty, their presence. Jadeite has long symbolized these qualities, in the most timeless way.",
    urgency: "International Women's Day · March 8",
    cta: "Celebrate With Jade",
    ctaLink: "/products",
  },

  BINGBING_BDAY: {
    label: "Our Birthday",
    emoji: "🎂",
    color: "amber",
    subject: "Our Birthday — A Gift for You",
    headline: "Another Year of Jade, With You.",
    intro:
      "BingBing Jade began with a simple idea: to make authentic jadeite more transparent and accessible. Today, we celebrate with a small offering — for those who've supported us.",
    urgency: "Anniversary release · Limited pieces",
    cta: "Celebrate With Us",
    ctaLink: "/products",
  },

  LUNAR_NEW_YEAR: {
    label: "Lunar New Year",
    emoji: "🧧",
    color: "red",
    subject: "A New Year, A New Beginning",
    headline: "Wishing You Jade Fortune.",
    intro:
      "The Lunar New Year marks renewal, luck, and intention. Jadeite has long symbolized protection and prosperity — a meaningful piece to begin the year ahead.",
    urgency: "New Year release · Limited availability",
    cta: "Start the Year Well",
    ctaLink: "/products",
  },

  CHRISTMAS: {
    label: "Christmas",
    emoji: "🎄",
    color: "emerald",
    subject: "A Gift Worth Unwrapping",
    headline: "Something They'll Keep Forever.",
    intro:
      "Some gifts are opened once. Others are kept for a lifetime. This season, choose something lasting — a piece of jadeite to be worn, remembered, and passed on.",
    urgency: "Arrives in time for Christmas",
    cta: "Shop Holiday Pieces",
    ctaLink: "/products",
  },

  ANNIVERSARY: {
    label: "Anniversary",
    emoji: "✨",
    color: "teal",
    subject: "Our Anniversary — Your Reward",
    headline: "A Quiet Thank You.",
    intro:
      "Another year, and we're still here because of you. To celebrate, we've released a small selection of pieces at special value — nothing loud, just meaningful.",
    urgency: "Anniversary release · While available",
    cta: "View Anniversary Pieces",
    ctaLink: "/products",
  },

  FLASH_SALE: {
    label: "Flash Sale",
    emoji: "⚡",
    color: "orange",
    subject: "A Rare Opportunity",
    headline: "Briefly Available.",
    intro:
      "A limited number of pieces have been released at a special value. Once they're gone, they won't return — and we won't be repeating this anytime soon.",
    urgency: "Short window · While pieces remain",
    cta: "View Pieces",
    ctaLink: "/products",
  },

  VIP: {
    label: "VIP Access",
    emoji: "👑",
    color: "indigo",
    subject: "Reserved for You",
    headline: "Before Anyone Else.",
    intro:
      "This release is not public. These pieces are shared first with a small group — those who have supported BingBing Jade from early on.",
    urgency: "Private access · Limited circulation",
    cta: "Enter Private Access",
    ctaLink: "/products",
  },

  LAST_CHANCE: {
    label: "Last Chance",
    emoji: "⏰",
    color: "red",
    subject: "Last Chance — These Won't Return",
    headline: "Final Opportunity.",
    intro:
      "These pieces are being retired from our collection. Once sold, they will not be restocked. If something caught your eye before, this is the moment.",
    urgency: "Final release · No restocks",
    cta: "View Final Pieces",
    ctaLink: "/products",
  },
} satisfies Record<string, CampaignPreset>;

export function getCampaignPreset(id: string): CampaignPreset | undefined {
  return CAMPAIGN_PRESETS[id as keyof typeof CAMPAIGN_PRESETS];
}
