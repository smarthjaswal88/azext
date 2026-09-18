/**
 * DEMO DATA — every product, price, specification and review in this file is
 * invented for this prototype. None of it describes a real product, and the
 * reviews are written content, not customer feedback. Brand names are fictional
 * and were chosen to avoid resembling real ones.
 *
 * This module is the only place demo content lives. Swapping to Supabase means
 * replacing the readers in ./catalog.ts, not touching anything that imports it.
 */

import type {
  OptionAxis,
  OptionValue,
  Product,
  ProductImage,
  RatingSummary,
  Review,
  Variant,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// builders
// ---------------------------------------------------------------------------

function colorAxis(values: OptionValue[]): OptionAxis {
  return { key: "color", label: "Color", values };
}

function sizeAxis(values: OptionValue[]): OptionAxis {
  return { key: "size", label: "Size", values };
}

const TOP_SIZES: OptionValue[] = [
  { id: "xs", label: "XS" },
  { id: "s", label: "S" },
  { id: "m", label: "M" },
  { id: "l", label: "L" },
  { id: "xl", label: "XL" },
  { id: "xxl", label: "XXL" },
];

const WAIST_SIZES: OptionValue[] = [
  { id: "28", label: '28"' },
  { id: "30", label: '30"' },
  { id: "32", label: '32"' },
  { id: "34", label: '34"' },
  { id: "36", label: '36"' },
  { id: "38", label: '38"' },
];

/** Three views per colour, matching scripts/generate-product-images.py. */
function images(slug: string, colors: OptionValue[], noun: string): ProductImage[] {
  const views = ["front view", "side view", "detail"];
  return colors.flatMap((c) =>
    views.map((view, i) => ({
      src: `/images/${slug}/${c.id}-${i + 1}.svg`,
      alt: `${noun} in ${c.label} — ${view}`,
      colorId: c.id,
    })),
  );
}

interface VariantSpec {
  priceCents: number;
  listPriceCents?: number;
  /** Variant ids (without the product prefix) that are out of stock. */
  unavailable?: string[];
  /** Surcharge in cents keyed by size id — larger sizes often cost more. */
  sizeSurcharge?: Record<string, number>;
  /** Surcharge in cents keyed by colour id. */
  colorSurcharge?: Record<string, number>;
}

function buildVariants(
  productId: string,
  colors: OptionValue[],
  sizes: OptionValue[] | undefined,
  spec: VariantSpec,
): Variant[] {
  const unavailable = new Set(spec.unavailable ?? []);
  const combos: Array<{ color: string; size?: string }> = sizes
    ? colors.flatMap((c) => sizes.map((s) => ({ color: c.id, size: s.id })))
    : colors.map((c) => ({ color: c.id }));

  return combos.map((options) => {
    const key = options.size ? `${options.color}-${options.size}` : options.color;
    const surcharge =
      (spec.colorSurcharge?.[options.color] ?? 0) +
      (options.size ? (spec.sizeSurcharge?.[options.size] ?? 0) : 0);
    return {
      id: `${productId}-${key}`,
      options,
      priceCents: spec.priceCents + surcharge,
      listPriceCents: spec.listPriceCents ? spec.listPriceCents + surcharge : undefined,
      available: !unavailable.has(key),
    };
  });
}

/** Derives the average and total from the histogram so the summary can never
 *  contradict itself. reviewCount is passed separately because writing a review
 *  is rarer than leaving a rating. */
function rating(
  histogram: Record<1 | 2 | 3 | 4 | 5, number>,
  reviewCount: number,
): RatingSummary {
  const entries = [5, 4, 3, 2, 1] as const;
  const ratingCount = entries.reduce((sum, star) => sum + histogram[star], 0);
  const weighted = entries.reduce((sum, star) => sum + star * histogram[star], 0);
  return {
    average: Math.round((weighted / ratingCount) * 10) / 10,
    ratingCount,
    reviewCount,
    histogram,
  };
}

let reviewSeq = 0;
function review(
  rating: 1 | 2 | 3 | 4 | 5,
  title: string,
  body: string,
  createdAt: string,
  opts: { variantId?: string; verified?: boolean; helpful?: number } = {},
): Review {
  reviewSeq += 1;
  return {
    id: `demo-review-${String(reviewSeq).padStart(3, "0")}`,
    rating,
    title,
    body,
    authorLabel: `Demo reviewer ${String(reviewSeq).padStart(3, "0")}`,
    createdAt,
    variantId: opts.variantId,
    verifiedPurchase: opts.verified ?? true,
    helpfulCount: opts.helpful ?? 0,
  };
}

// ---------------------------------------------------------------------------
// headphones
// ---------------------------------------------------------------------------

const AUREAL_COLORS: OptionValue[] = [
  { id: "midnight", label: "Midnight", swatch: "#22304a" },
  { id: "sand", label: "Sand", swatch: "#cbb79a" },
  { id: "slate", label: "Slate", swatch: "#5d6472" },
];

const NORDWAVE_COLORS: OptionValue[] = [
  { id: "black", label: "Black", swatch: "#24262b" },
  { id: "ivory", label: "Ivory", swatch: "#e6e0d4" },
];

const KESTREL_COLORS: OptionValue[] = [
  { id: "black", label: "Black", swatch: "#1e2024" },
  { id: "silver", label: "Silver", swatch: "#b9bdc4" },
];

const LUMEN_COLORS: OptionValue[] = [
  { id: "graphite", label: "Graphite", swatch: "#3b3f46" },
  { id: "walnut", label: "Walnut", swatch: "#7b5334" },
];

const PINEBANK_COLORS: OptionValue[] = [
  { id: "moss", label: "Moss", swatch: "#4f6448" },
  { id: "bone", label: "Bone", swatch: "#ded6c6" },
  { id: "ink", label: "Ink", swatch: "#262a33" },
];

const VERSO_COLORS: OptionValue[] = [
  { id: "navy", label: "Navy", swatch: "#28354f" },
  { id: "rust", label: "Rust", swatch: "#a4552f" },
];

const HEADPHONES: Product[] = [
  {
    id: "hp-aureal-h9",
    slug: "aureal-h9-anc",
    title: "Aureal H9 Wireless Noise-Cancelling Over-Ear Headphones",
    brand: "Aureal",
    category: "headphones",
    comparisonGroup: "personal-audio",
    summary:
      "Adaptive noise cancelling with a 40-hour battery, built for long flights and open-plan offices.",
    images: images("aureal-h9-anc", AUREAL_COLORS, "Aureal H9 headphones"),
    optionAxes: [colorAxis(AUREAL_COLORS)],
    variants: buildVariants("hp-aureal-h9", AUREAL_COLORS, undefined, {
      priceCents: 29999,
      listPriceCents: 34999,
      unavailable: ["slate"],
    }),
    specs: [
      { label: "Form factor", value: "Over-ear, closed back" },
      { label: "Driver", value: "40 mm dynamic" },
      { label: "Frequency response", value: "4 Hz – 40 kHz" },
      { label: "Active noise cancelling", value: "Adaptive, 3 levels" },
      { label: "Battery life", value: "40 hours (ANC on)" },
      { label: "Charging", value: "USB-C, 10 min for 5 hours" },
      { label: "Connectivity", value: "Bluetooth 5.3, multipoint, 3.5 mm" },
      { label: "Microphones", value: "8, beamforming" },
      { label: "Weight", value: "254 g" },
      { label: "Water resistance", value: "IPX4" },
    ],
    rating: rating({ 5: 1840, 4: 512, 3: 148, 2: 64, 1: 96 }, 412),
    reviews: [
      review(
        5,
        "Cancels the office completely",
        "The adaptive mode is the reason to buy these. It notices when the room gets loud and tightens up without me touching anything. Battery easily lasts a working week.",
        "2026-08-29",
        { variantId: "hp-aureal-h9-midnight", helpful: 34 },
      ),
      review(
        4,
        "Excellent, but the case is bulky",
        "Sound and comfort are both first rate. My only complaint is the case, which is far larger than it needs to be and does not fit in a laptop bag alongside a 14-inch machine.",
        "2026-08-14",
        { variantId: "hp-aureal-h9-sand", helpful: 12 },
      ),
      review(
        2,
        "Creaking headband after three months",
        "Sound is fine but the left hinge developed a creak I cannot unhear. At this price I expected the build to hold up longer.",
        "2026-07-22",
        { variantId: "hp-aureal-h9-midnight", helpful: 41 },
      ),
      review(
        5,
        "Multipoint actually works",
        "Switches between my laptop and phone without dropping either, which is more than I can say for the pair these replaced.",
        "2026-06-30",
        { variantId: "hp-aureal-h9-sand" },
      ),
    ],
  },
  {
    id: "hp-nordwave-drift",
    slug: "nordwave-drift",
    title: "Nordwave Drift Wireless Over-Ear Headphones",
    brand: "Nordwave",
    category: "headphones",
    comparisonGroup: "personal-audio",
    summary:
      "A lightweight everyday pair with a warm tuning and 30-hour battery, without noise cancelling.",
    images: images("nordwave-drift", NORDWAVE_COLORS, "Nordwave Drift headphones"),
    optionAxes: [colorAxis(NORDWAVE_COLORS)],
    variants: buildVariants("hp-nordwave-drift", NORDWAVE_COLORS, undefined, {
      priceCents: 14950,
    }),
    specs: [
      { label: "Form factor", value: "Over-ear, closed back" },
      { label: "Driver", value: "40 mm dynamic" },
      { label: "Frequency response", value: "20 Hz – 20 kHz" },
      { label: "Active noise cancelling", value: "None" },
      { label: "Battery life", value: "30 hours" },
      { label: "Charging", value: "USB-C" },
      { label: "Connectivity", value: "Bluetooth 5.2, 3.5 mm" },
      { label: "Microphones", value: "2" },
      { label: "Weight", value: "198 g" },
      { label: "Water resistance", value: "None" },
    ],
    rating: rating({ 5: 610, 4: 402, 3: 121, 2: 44, 1: 33 }, 188),
    reviews: [
      review(
        5,
        "The comfort surprised me",
        "Light enough that I forget I have them on. Bass is generous rather than accurate, which suits how I actually listen.",
        "2026-09-02",
        { variantId: "hp-nordwave-drift-ivory", helpful: 19 },
      ),
      review(
        3,
        "Fine, but no ANC is a real limit",
        "For the money the sound is good. On a train it is not enough — you end up turning the volume higher than you should.",
        "2026-08-05",
        { variantId: "hp-nordwave-drift-black", helpful: 27 },
      ),
      review(
        4,
        "Ivory stays clean",
        "Six weeks of daily use and the light colour has not picked up marks the way I feared.",
        "2026-07-11",
        { variantId: "hp-nordwave-drift-ivory" },
      ),
    ],
  },
  {
    id: "hp-kestrel-k2",
    slug: "kestrel-k2-studio",
    title: "Kestrel Audio K2 Studio Monitor Headphones",
    brand: "Kestrel Audio",
    category: "headphones",
    comparisonGroup: "personal-audio",
    summary:
      "Wired closed-back monitors with a deliberately flat response, intended for mixing rather than listening.",
    images: images("kestrel-k2-studio", KESTREL_COLORS, "Kestrel K2 studio headphones"),
    optionAxes: [colorAxis(KESTREL_COLORS)],
    variants: buildVariants("hp-kestrel-k2", KESTREL_COLORS, undefined, {
      priceCents: 19900,
    }),
    specs: [
      { label: "Form factor", value: "Over-ear, closed back" },
      { label: "Driver", value: "45 mm dynamic" },
      { label: "Frequency response", value: "5 Hz – 35 kHz" },
      { label: "Active noise cancelling", value: "None" },
      { label: "Battery life", value: "Not applicable (wired)" },
      { label: "Connectivity", value: "Detachable 3 m cable, 3.5 mm with 6.35 mm adapter" },
      { label: "Impedance", value: "38 Ω" },
      { label: "Weight", value: "285 g" },
      { label: "Included", value: "Coiled and straight cables, hard case" },
    ],
    rating: rating({ 5: 402, 4: 156, 3: 38, 2: 12, 1: 9 }, 97),
    reviews: [
      review(
        5,
        "Unflattering in the best way",
        "Mixes that sound good on these translate everywhere else. They are not a fun listen and that is the entire point.",
        "2026-08-19",
        { variantId: "hp-kestrel-k2-black", helpful: 48 },
      ),
      review(
        4,
        "Cable is long enough to trip over",
        "The three-metre cable is right for a studio and wrong for a desk. Worth buying the shorter one separately.",
        "2026-07-28",
        { variantId: "hp-kestrel-k2-silver", helpful: 8 },
      ),
      review(
        5,
        "Clamp loosens after a week",
        "Tight out of the box, which worried me, but it settles. Now comfortable for a four-hour session.",
        "2026-06-15",
        { variantId: "hp-kestrel-k2-black" },
      ),
    ],
  },
  {
    id: "hp-lumen-halo",
    slug: "lumen-halo-open",
    title: "Lumen Acoustics Halo Open-Back Reference Headphones",
    brand: "Lumen Acoustics",
    category: "headphones",
    comparisonGroup: "personal-audio",
    summary:
      "Open-back reference headphones with a wide soundstage. They leak sound in both directions by design.",
    images: images("lumen-halo-open", LUMEN_COLORS, "Lumen Halo open-back headphones"),
    optionAxes: [colorAxis(LUMEN_COLORS)],
    variants: buildVariants("hp-lumen-halo", LUMEN_COLORS, undefined, {
      priceCents: 44900,
      colorSurcharge: { walnut: 3000 },
    }),
    specs: [
      { label: "Form factor", value: "Over-ear, open back" },
      { label: "Driver", value: "50 mm planar magnetic" },
      { label: "Frequency response", value: "6 Hz – 50 kHz" },
      { label: "Active noise cancelling", value: "None — open back" },
      { label: "Connectivity", value: "Detachable balanced cable, 4.4 mm and 3.5 mm" },
      { label: "Impedance", value: "64 Ω" },
      { label: "Amplification", value: "Recommended" },
      { label: "Weight", value: "330 g" },
      { label: "Earpads", value: "Replaceable lambskin" },
    ],
    rating: rating({ 5: 288, 4: 74, 3: 21, 2: 14, 1: 11 }, 64),
    reviews: [
      review(
        5,
        "Soundstage is the whole story",
        "Instruments sit in space rather than in your head. Once you have heard it you cannot go back to closed backs for listening at home.",
        "2026-09-05",
        { variantId: "hp-lumen-halo-walnut", helpful: 22 },
      ),
      review(
        2,
        "Unusable in a shared room",
        "Nobody warned me quite how much these leak. My partner can hear the lyrics from across the room. Entirely my fault for not reading, but worth stating plainly.",
        "2026-08-11",
        { variantId: "hp-lumen-halo-graphite", helpful: 63 },
      ),
      review(
        4,
        "Needs a real amplifier",
        "Straight out of a laptop they sound thin. With a proper amp they open up completely — budget for one.",
        "2026-07-03",
        { variantId: "hp-lumen-halo-graphite", helpful: 31 },
      ),
    ],
  },
  {
    id: "hp-pinebank-trail",
    slug: "pinebank-trail-buds",
    title: "Pinebank Trail Buds True Wireless Earbuds",
    brand: "Pinebank",
    category: "headphones",
    comparisonGroup: "personal-audio",
    summary:
      "Sweat-resistant true wireless earbuds with a secure fit, aimed at running and gym use.",
    images: images("pinebank-trail-buds", PINEBANK_COLORS, "Pinebank Trail Buds earbuds"),
    optionAxes: [colorAxis(PINEBANK_COLORS)],
    variants: buildVariants("hp-pinebank-trail", PINEBANK_COLORS, undefined, {
      priceCents: 8999,
      listPriceCents: 10999,
      unavailable: ["bone"],
    }),
    specs: [
      { label: "Form factor", value: "In-ear, true wireless" },
      { label: "Driver", value: "10 mm dynamic" },
      { label: "Frequency response", value: "20 Hz – 20 kHz" },
      { label: "Active noise cancelling", value: "Yes, with transparency mode" },
      { label: "Battery life", value: "7 hours, 28 with case" },
      { label: "Charging", value: "USB-C and wireless" },
      { label: "Connectivity", value: "Bluetooth 5.3" },
      { label: "Weight", value: "5.1 g per bud" },
      { label: "Water resistance", value: "IPX7" },
      { label: "Included", value: "Four ear tip sizes, wing tips" },
    ],
    rating: rating({ 5: 2210, 4: 880, 3: 340, 2: 180, 1: 210 }, 706),
    reviews: [
      review(
        5,
        "Stayed in through a half marathon",
        "The wing tips are what make these work. No readjusting for two hours, which no other pair has managed for me.",
        "2026-09-08",
        { variantId: "hp-pinebank-trail-moss", helpful: 57 },
      ),
      review(
        3,
        "Transparency mode is noisy",
        "ANC is decent for the price. Transparency hisses enough that I stopped using it, which defeats half the point on a road run.",
        "2026-08-21",
        { variantId: "hp-pinebank-trail-ink", helpful: 44 },
      ),
      review(
        1,
        "Left bud died in four months",
        "Stopped charging entirely. Replacement process was straightforward but I would rather it had not been necessary.",
        "2026-08-02",
        { variantId: "hp-pinebank-trail-ink", helpful: 88 },
      ),
      review(
        4,
        "Case is genuinely pocket sized",
        "Small enough for a running belt. Wireless charging on a budget pair is a nice surprise.",
        "2026-07-19",
        { variantId: "hp-pinebank-trail-moss", helpful: 15 },
      ),
    ],
  },
  {
    id: "hp-verso-compact",
    slug: "verso-compact-on-ear",
    title: "Verso Compact On-Ear Bluetooth Headphones",
    brand: "Verso",
    category: "headphones",
    comparisonGroup: "personal-audio",
    summary:
      "Folding on-ear headphones for commuting, with a 24-hour battery and a soft carry pouch.",
    images: images("verso-compact-on-ear", VERSO_COLORS, "Verso Compact on-ear headphones"),
    optionAxes: [colorAxis(VERSO_COLORS)],
    variants: buildVariants("hp-verso-compact", VERSO_COLORS, undefined, {
      priceCents: 7900,
    }),
    specs: [
      { label: "Form factor", value: "On-ear, closed back" },
      { label: "Driver", value: "32 mm dynamic" },
      { label: "Frequency response", value: "20 Hz – 20 kHz" },
      { label: "Active noise cancelling", value: "None" },
      { label: "Battery life", value: "24 hours" },
      { label: "Charging", value: "USB-C" },
      { label: "Connectivity", value: "Bluetooth 5.1, 3.5 mm" },
      { label: "Folding", value: "Yes, flat and inward" },
      { label: "Weight", value: "162 g" },
    ],
    rating: rating({ 5: 402, 4: 388, 3: 190, 2: 96, 1: 74 }, 214),
    reviews: [
      review(
        4,
        "Right size for a jacket pocket",
        "Folds smaller than anything else I tried. Sound is ordinary but the portability is the reason to own them.",
        "2026-08-27",
        { variantId: "hp-verso-compact-navy", helpful: 21 },
      ),
      review(
        2,
        "On-ear pressure gets painful",
        "After about an hour my ears ache. That is on-ear designs generally, but these clamp harder than most.",
        "2026-07-30",
        { variantId: "hp-verso-compact-rust", helpful: 36 },
      ),
      review(
        5,
        "Battery claim holds up",
        "Charged it a fortnight ago and it is still going on a daily commute.",
        "2026-06-24",
        { variantId: "hp-verso-compact-navy" },
      ),
    ],
  },
];

// ---------------------------------------------------------------------------
// clothing
// ---------------------------------------------------------------------------

const FIELDHOUSE_COLORS: OptionValue[] = [
  { id: "black", label: "Black", swatch: "#232428" },
  { id: "heather-grey", label: "Heather Grey", swatch: "#a8aab0" },
  { id: "olive", label: "Olive", swatch: "#5e6446" },
];

const MERIDIAN_COLORS: OptionValue[] = [
  { id: "white", label: "White", swatch: "#eceef1" },
  { id: "sky", label: "Sky", swatch: "#9fbcd6" },
  { id: "stone", label: "Stone", swatch: "#c3bbaa" },
];

const TORREY_COLORS: OptionValue[] = [
  { id: "charcoal", label: "Charcoal", swatch: "#3c3f45" },
  { id: "oat", label: "Oat", swatch: "#d3c7b1" },
  { id: "forest", label: "Forest", swatch: "#31513f" },
];

const COASTLINE_COLORS: OptionValue[] = [
  { id: "natural", label: "Natural", swatch: "#ded4c2" },
  { id: "indigo", label: "Indigo", swatch: "#38455f" },
];

const RAMPART_COLORS: OptionValue[] = [
  { id: "khaki", label: "Khaki", swatch: "#bfa781" },
  { id: "navy", label: "Navy", swatch: "#2c3752" },
  { id: "black", label: "Black", swatch: "#242529" },
];

const SUMMIT_COLORS: OptionValue[] = [
  { id: "slate", label: "Slate", swatch: "#5a6472" },
  { id: "moss", label: "Moss", swatch: "#586b4c" },
];

const CLOTHING: Product[] = [
  {
    id: "cl-fieldhouse-tee",
    slug: "fieldhouse-heavyweight-tee",
    title: "Fieldhouse Heavyweight Cotton T-Shirt",
    brand: "Fieldhouse",
    category: "clothing",
    comparisonGroup: "shirts-and-tops",
    summary:
      "A 240 gsm cotton tee with a boxy cut and reinforced collar, made to survive repeated washing.",
    images: images("fieldhouse-heavyweight-tee", FIELDHOUSE_COLORS, "Fieldhouse heavyweight tee"),
    optionAxes: [colorAxis(FIELDHOUSE_COLORS), sizeAxis(TOP_SIZES)],
    variants: buildVariants("cl-fieldhouse-tee", FIELDHOUSE_COLORS, TOP_SIZES, {
      priceCents: 3200,
      sizeSurcharge: { xxl: 300 },
      unavailable: ["olive-xs", "olive-s", "black-xxl", "heather-grey-xs"],
    }),
    specs: [
      { label: "Material", value: "100% combed ring-spun cotton" },
      { label: "Fabric weight", value: "240 gsm" },
      { label: "Fit", value: "Boxy, true to size" },
      { label: "Neckline", value: "Ribbed crew, taped shoulder to shoulder" },
      { label: "Sleeve", value: "Short, set-in" },
      { label: "Care", value: "Machine wash cold, tumble dry low" },
      { label: "Origin", value: "Woven and sewn in Portugal" },
    ],
    rating: rating({ 5: 1420, 4: 610, 3: 180, 2: 72, 1: 58 }, 388),
    reviews: [
      review(
        5,
        "Holds shape after twenty washes",
        "The collar has not stretched at all, which is the only thing I care about in a tee. Heavier than most so it hangs properly.",
        "2026-09-01",
        { variantId: "cl-fieldhouse-tee-black-l", helpful: 52 },
      ),
      review(
        3,
        "Boxy really does mean boxy",
        "Size down if you want anything close to fitted. On me the medium sits like a large would elsewhere.",
        "2026-08-16",
        { variantId: "cl-fieldhouse-tee-olive-m", helpful: 71 },
      ),
      review(
        4,
        "Olive is darker than pictured",
        "Closer to a deep army green than the lighter shade on screen. I like it more than what I ordered, but it is not a match.",
        "2026-07-25",
        { variantId: "cl-fieldhouse-tee-olive-l", helpful: 29 },
      ),
      review(
        5,
        "Bought three more",
        "Enough said. The heather grey is the pick of the colours.",
        "2026-07-04",
        { variantId: "cl-fieldhouse-tee-heather-grey-m" },
      ),
    ],
  },
  {
    id: "cl-meridian-oxford",
    slug: "meridian-oxford-shirt",
    title: "Meridian Oxford Button-Down Shirt",
    brand: "Meridian",
    category: "clothing",
    comparisonGroup: "shirts-and-tops",
    summary:
      "A washed oxford shirt with a soft roll collar, cut slim through the body without being tight.",
    images: images("meridian-oxford-shirt", MERIDIAN_COLORS, "Meridian oxford shirt"),
    optionAxes: [colorAxis(MERIDIAN_COLORS), sizeAxis(TOP_SIZES)],
    variants: buildVariants("cl-meridian-oxford", MERIDIAN_COLORS, TOP_SIZES, {
      priceCents: 6800,
      listPriceCents: 7900,
      sizeSurcharge: { xxl: 400 },
      unavailable: ["sky-xs", "stone-xs", "stone-xxl", "white-xxl"],
    }),
    specs: [
      { label: "Material", value: "100% cotton oxford" },
      { label: "Fabric weight", value: "140 gsm" },
      { label: "Fit", value: "Slim, sized for a jacket over it" },
      { label: "Collar", value: "Button-down, unlined soft roll" },
      { label: "Sleeve", value: "Long, single-button cuff" },
      { label: "Closure", value: "Front placket, corozo buttons" },
      { label: "Pockets", value: "None" },
      { label: "Care", value: "Machine wash warm, iron damp" },
      { label: "Origin", value: "Sewn in Portugal" },
    ],
    rating: rating({ 5: 980, 4: 430, 3: 145, 2: 60, 1: 41 }, 276),
    reviews: [
      review(
        5,
        "The collar roll is right",
        "Most button-downs get this wrong and the collar sits flat. This one has actual roll to it without needing starch.",
        "2026-09-04",
        { variantId: "cl-meridian-oxford-white-m", helpful: 38 },
      ),
      review(
        2,
        "Shrank more than I expected",
        "Washed warm as instructed and lost most of a size in the length. Fine across the chest, now too short to tuck comfortably.",
        "2026-08-09",
        { variantId: "cl-meridian-oxford-sky-l", helpful: 64 },
      ),
      review(
        4,
        "Slim is genuinely slim",
        "Went up a size from my usual and it is right. If you are between sizes take the larger one.",
        "2026-07-16",
        { variantId: "cl-meridian-oxford-stone-l", helpful: 33 },
      ),
    ],
  },
  {
    id: "cl-torrey-merino",
    slug: "torrey-merino-crew",
    title: "Torrey Merino Wool Crew Neck Sweater",
    brand: "Torrey",
    category: "clothing",
    comparisonGroup: "knitwear-and-layers",
    summary:
      "A fine-gauge merino crew that layers under a jacket without bulk, in a mid-weight 18.5 micron yarn.",
    images: images("torrey-merino-crew", TORREY_COLORS, "Torrey merino crew sweater"),
    optionAxes: [colorAxis(TORREY_COLORS), sizeAxis(TOP_SIZES)],
    variants: buildVariants("cl-torrey-merino", TORREY_COLORS, TOP_SIZES, {
      priceCents: 12500,
      sizeSurcharge: { xxl: 800 },
      unavailable: ["forest-xs", "forest-xxl", "oat-xs", "charcoal-xxl", "oat-xxl"],
    }),
    specs: [
      { label: "Material", value: "100% extra-fine merino wool" },
      { label: "Yarn", value: "18.5 micron, 12 gauge" },
      { label: "Fit", value: "Regular, slightly tapered" },
      { label: "Neckline", value: "Ribbed crew" },
      { label: "Sleeve", value: "Long, set-in with ribbed cuff" },
      { label: "Care", value: "Hand wash cold or wool cycle, dry flat" },
      { label: "Origin", value: "Knitted in Scotland" },
    ],
    rating: rating({ 5: 512, 4: 198, 3: 66, 2: 38, 1: 24 }, 148),
    reviews: [
      review(
        5,
        "No itch at all",
        "I cannot wear most wool against skin. This is genuinely fine enough that I wear it without a shirt underneath.",
        "2026-08-31",
        { variantId: "cl-torrey-merino-charcoal-m", helpful: 47 },
      ),
      review(
        3,
        "Pills at the underarm",
        "Lovely for the first month, then pilling where the arm rubs the body. A comb sorts it but I would rather not need one.",
        "2026-08-07",
        { variantId: "cl-torrey-merino-oat-l", helpful: 55 },
      ),
      review(
        4,
        "Layers under a jacket properly",
        "Thin enough that a blazer still closes. That is exactly what I wanted and hard to find.",
        "2026-07-12",
        { variantId: "cl-torrey-merino-forest-m", helpful: 18 },
      ),
    ],
  },
  {
    id: "cl-coastline-linen",
    slug: "coastline-linen-shirt",
    title: "Coastline Linen Camp Collar Shirt",
    brand: "Coastline",
    category: "clothing",
    comparisonGroup: "shirts-and-tops",
    summary:
      "A relaxed camp collar shirt in washed European linen, cut long enough to wear untucked.",
    images: images("coastline-linen-shirt", COASTLINE_COLORS, "Coastline linen camp shirt"),
    optionAxes: [colorAxis(COASTLINE_COLORS), sizeAxis(TOP_SIZES)],
    variants: buildVariants("cl-coastline-linen", COASTLINE_COLORS, TOP_SIZES, {
      priceCents: 7400,
      sizeSurcharge: { xxl: 500 },
      unavailable: ["indigo-xs", "natural-xs", "indigo-xxl"],
    }),
    specs: [
      { label: "Material", value: "100% washed European linen" },
      { label: "Fabric weight", value: "165 gsm" },
      { label: "Fit", value: "Relaxed, cut to wear untucked" },
      { label: "Collar", value: "Camp, one piece" },
      { label: "Sleeve", value: "Short" },
      { label: "Pockets", value: "One patch chest pocket" },
      { label: "Care", value: "Machine wash cold, line dry" },
      { label: "Origin", value: "Woven in Lithuania, sewn in Portugal" },
    ],
    rating: rating({ 5: 388, 4: 210, 3: 92, 2: 44, 1: 30 }, 132),
    reviews: [
      review(
        5,
        "Creases, as linen does",
        "If you want a shirt that stays smooth, buy something else. If you want linen that softens beautifully, this is it.",
        "2026-08-24",
        { variantId: "cl-coastline-linen-natural-l", helpful: 26 },
      ),
      review(
        4,
        "Indigo bled on first wash",
        "Washed alone as I suspected it might. It did, once, and not since. Worth knowing before it joins the whites.",
        "2026-08-03",
        { variantId: "cl-coastline-linen-indigo-m", helpful: 49 },
      ),
      review(
        3,
        "Sheer in natural",
        "The lighter colour is more transparent than I expected in bright sun. Fine over a vest, less so alone.",
        "2026-07-09",
        { variantId: "cl-coastline-linen-natural-m", helpful: 37 },
      ),
    ],
  },
  {
    id: "cl-rampart-chino",
    slug: "rampart-chino",
    title: "Rampart Straight-Leg Cotton Chino Trousers",
    brand: "Rampart",
    category: "clothing",
    comparisonGroup: "trousers",
    summary:
      "A straight-leg chino in mid-weight twill with a touch of stretch, unhemmed for tailoring.",
    images: images("rampart-chino", RAMPART_COLORS, "Rampart straight-leg chino"),
    optionAxes: [colorAxis(RAMPART_COLORS), sizeAxis(WAIST_SIZES)],
    variants: buildVariants("cl-rampart-chino", RAMPART_COLORS, WAIST_SIZES, {
      priceCents: 8900,
      unavailable: ["khaki-28", "navy-28", "black-38", "navy-38"],
    }),
    specs: [
      { label: "Material", value: "98% cotton twill, 2% elastane" },
      { label: "Fabric weight", value: "290 gsm" },
      { label: "Fit", value: "Straight leg, mid rise" },
      { label: "Leg opening", value: '16.5" at size 32' },
      { label: "Inseam", value: 'Unhemmed 36", intended for tailoring' },
      { label: "Closure", value: "Zip fly, hook and bar" },
      { label: "Pockets", value: "Two slant front, two welt back" },
      { label: "Care", value: "Machine wash cold, tumble dry low" },
      { label: "Origin", value: "Sewn in Vietnam" },
    ],
    rating: rating({ 5: 720, 4: 480, 3: 210, 2: 110, 1: 86 }, 302),
    reviews: [
      review(
        4,
        "Unhemmed is the right call",
        "Took them straight to a tailor and they now fit properly. Anyone between standard lengths should appreciate this.",
        "2026-09-06",
        { variantId: "cl-rampart-chino-khaki-32", helpful: 41 },
      ),
      review(
        2,
        "Waistband stretches out by evening",
        "Fits well in the morning and is noticeably loose by the end of the day. The elastane may be the cause.",
        "2026-08-13",
        { variantId: "cl-rampart-chino-navy-34", helpful: 58 },
      ),
      review(
        5,
        "Twill is substantial",
        "Heavier than the chinos I usually buy and better for it. Holds a crease and does not go transparent when stretched.",
        "2026-07-20",
        { variantId: "cl-rampart-chino-black-32", helpful: 23 },
      ),
    ],
  },
  {
    id: "cl-summit-quarter-zip",
    slug: "summit-quarter-zip",
    title: "Summit Quarter-Zip Recycled Fleece",
    brand: "Summit",
    category: "clothing",
    comparisonGroup: "knitwear-and-layers",
    summary:
      "A grid-fleece quarter-zip in recycled polyester, warm for its weight and quick to dry.",
    images: images("summit-quarter-zip", SUMMIT_COLORS, "Summit quarter-zip fleece"),
    optionAxes: [colorAxis(SUMMIT_COLORS), sizeAxis(TOP_SIZES)],
    variants: buildVariants("cl-summit-quarter-zip", SUMMIT_COLORS, TOP_SIZES, {
      priceCents: 9800,
      listPriceCents: 11500,
      sizeSurcharge: { xxl: 600 },
      unavailable: ["moss-xs", "moss-s", "slate-xxl"],
    }),
    specs: [
      { label: "Material", value: "100% recycled polyester grid fleece" },
      { label: "Fabric weight", value: "220 gsm" },
      { label: "Fit", value: "Regular, layering cut" },
      { label: "Collar", value: "Stand collar with chin guard" },
      { label: "Closure", value: "Quarter-length YKK zip" },
      { label: "Pockets", value: "One zipped chest pocket" },
      { label: "Care", value: "Machine wash cold, do not tumble dry" },
      { label: "Origin", value: "Sewn in Vietnam" },
    ],
    rating: rating({ 5: 610, 4: 288, 3: 96, 2: 40, 1: 32 }, 194),
    reviews: [
      review(
        5,
        "Warm without being bulky",
        "The grid backing makes a real difference. Packs down to nothing and dries in an hour after a wet walk.",
        "2026-09-03",
        { variantId: "cl-summit-quarter-zip-slate-l", helpful: 35 },
      ),
      review(
        4,
        "Chest pocket is too small",
        "Fits a card, not a phone. Otherwise no complaints — the zip is smooth and the collar sits properly.",
        "2026-08-18",
        { variantId: "cl-summit-quarter-zip-moss-m", helpful: 17 },
      ),
      review(
        3,
        "Static build-up",
        "Comes with the material, but it is noticeable enough to mention when pulling it over a fleece-lined shirt.",
        "2026-07-27",
        { variantId: "cl-summit-quarter-zip-slate-m", helpful: 28 },
      ),
    ],
  },
];

export const DEMO_PRODUCTS: Product[] = [...HEADPHONES, ...CLOTHING];
