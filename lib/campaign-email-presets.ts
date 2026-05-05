// Campaign email presets — add new campaigns here.

export interface CampaignPreset {
  id: string;
  label: string;
  emoji: string;
  /** Tailwind color name used in admin UI only */
  color: string;
  subject: string;
  headline: string;
  intro: string;
  urgencyLine?: string;
  ctaText: string;
  ctaLink: string;
}

export const CAMPAIGN_PRESETS: CampaignPreset[] = [
  {
    id: "black_friday",
    label: "Black Friday",
    emoji: "🛍",
    color: "gray",
    subject: "Early Access: Black Friday Begins Now",
    headline: "Black Friday, Refined.",
    intro:
      "We rarely discount. When we do, it means something. A curated selection of natural jadeite — each piece handpicked, each one a genuine rarity. This is not a sale. This is an opportunity.",
    urgencyLine: "Ends Sunday · Limited pieces available",
    ctaText: "Shop the Selection",
    ctaLink: "/products",
  },
  {
    id: "cyber_monday",
    label: "Cyber Monday",
    emoji: "💻",
    color: "blue",
    subject: "Cyber Monday — Rare Finds, Quietly Available",
    headline: "Rare Finds. No Rush.",
    intro:
      "A select few pieces are available at a special value today. No countdown timers. No pressure. Simply beautiful jadeite, yours if you'd like.",
    urgencyLine: "Today only · While pieces remain",
    ctaText: "View Available Pieces",
    ctaLink: "/products",
  },
  {
    id: "valentines",
    label: "Valentine's Day",
    emoji: "💝",
    color: "rose",
    subject: "A Gift She'll Treasure for a Lifetime",
    headline: "For the One Who Deserves Something Real.",
    intro:
      "Natural jadeite carries meaning that goes beyond beauty — centuries of culture, a stone that endures. This Valentine's Day, give something that will still matter in twenty years.",
    ctaText: "Find the Right Piece",
    ctaLink: "/products",
  },
  {
    id: "mothers_day",
    label: "Mother's Day",
    emoji: "💐",
    color: "violet",
    subject: "For the Woman Who Gave You Everything",
    headline: "A Gift as Enduring as She Is.",
    intro:
      "Natural jadeite has been passed between generations for thousands of years. Give your mother something that carries that weight — beautiful, meaningful, and entirely hers.",
    ctaText: "Shop Mother's Day Gifts",
    ctaLink: "/products",
  },
  {
    id: "womens_day",
    label: "International Women's Day",
    emoji: "🌸",
    color: "pink",
    subject: "Celebrating Her — March 8",
    headline: "Strong. Beautiful. Enduring.",
    intro:
      "Like the women we celebrate, natural jadeite is formed under pressure, refined over time, and more valuable with age. This International Women's Day, honor her with something that reflects exactly that.",
    ctaText: "Browse the Collection",
    ctaLink: "/products",
  },
  {
    id: "bingbing_birthday",
    label: "BingBing Birthday",
    emoji: "🎂",
    color: "amber",
    subject: "It's Our Birthday — A Gift for You",
    headline: "We're Celebrating. So Are You.",
    intro:
      "On April 17th, BingBing Jade turns another year older. To thank you for being part of this journey, we're sharing something special. From our family to yours.",
    ctaText: "Claim Your Offer",
    ctaLink: "/products",
  },
  {
    id: "lunar_new_year",
    label: "Lunar New Year",
    emoji: "🧧",
    color: "red",
    subject: "Wishing You Jade Fortune This New Year",
    headline: "New Year. New Beginnings. New Jade.",
    intro:
      "In Chinese culture, jade is the stone of luck, protection, and prosperity. As the new year begins, we invite you to carry a piece of that tradition — beautifully, and entirely your own.",
    ctaText: "Shop Lunar New Year",
    ctaLink: "/products",
  },
  {
    id: "christmas",
    label: "Christmas",
    emoji: "🎄",
    color: "emerald",
    subject: "A Christmas Gift Worth Unwrapping",
    headline: "The Gift of Something Real.",
    intro:
      "Beneath the wrapping paper, some gifts are forgotten by February. Natural jadeite is not one of them. This Christmas, give something with lasting beauty and quiet significance.",
    ctaText: "Shop Holiday Gifts",
    ctaLink: "/products",
  },
  {
    id: "anniversary_sale",
    label: "Anniversary Sale",
    emoji: "✦",
    color: "teal",
    subject: "Our Anniversary. Your Reward.",
    headline: "A Milestone Worth Sharing.",
    intro:
      "We've been honored to bring rare natural jadeite to collectors and enthusiasts around the world. To mark this anniversary, we're offering something to those who've made it possible — our customers.",
    ctaText: "Explore the Anniversary Edit",
    ctaLink: "/products",
  },
  {
    id: "flash_sale",
    label: "Flash Sale",
    emoji: "⚡",
    color: "amber",
    subject: "48 Hours. Select Pieces. Rare Opportunity.",
    headline: "A Quiet Window of Availability.",
    intro:
      "A small selection of natural jadeite is available at a special value for the next 48 hours. These are genuine pieces — not clearance, not compromises. Simply a rare moment of accessibility.",
    urgencyLine: "Closes in 48 hours · No extensions",
    ctaText: "View Available Pieces",
    ctaLink: "/products",
  },
  {
    id: "vip_exclusive",
    label: "VIP Exclusive",
    emoji: "◆",
    color: "indigo",
    subject: "Exclusively for You — Before Anyone Else",
    headline: "First Access. Yours Alone.",
    intro:
      "Before these pieces reach anyone else, we're sharing them with you. This is not a public announcement. Consider it a quiet invitation — for collectors who appreciate something truly rare.",
    ctaText: "View Your Exclusive Selection",
    ctaLink: "/products",
  },
  {
    id: "clearance",
    label: "Last Chance",
    emoji: "⏳",
    color: "orange",
    subject: "Last Chance — These Pieces Won't Return",
    headline: "Once Gone, Gone Forever.",
    intro:
      "A handful of pieces are being retired from our collection. Each is genuine, each is beautiful, and none will be restocked. If one has caught your eye, now is the time.",
    urgencyLine: "Final availability · No restock",
    ctaText: "See What Remains",
    ctaLink: "/products",
  },
];

export function getCampaignPreset(id: string): CampaignPreset | undefined {
  return CAMPAIGN_PRESETS.find((p) => p.id === id);
}
