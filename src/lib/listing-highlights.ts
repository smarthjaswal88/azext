/**
 * The few listing facts a product card shows at a glance, all taken from the
 * listing's own imported rows — nothing is inferred or invented:
 *
 *   - up to three short tags, each from a specification value or from a
 *     strict phrase match against the listing's own feature bullets;
 *   - the material composition, in full, from the listing's specification;
 *   - how many of the listing's options have a price.
 *
 * Tags that every listing of a kind would carry ("Machine wash", "Button",
 * "Pull on", plain "Bluetooth") are deliberately not generated.
 */

import type { CatalogAvailability, CatalogHighlight, CatalogSpecification } from "./catalog-api";

interface Source {
  /** Specification rows, in listing order. */
  specifications: CatalogSpecification[];
  /** Feature bullets, in listing order. */
  features: string[];
  productType: string;
}

type Rule = (source: Source) => CatalogHighlight | undefined;

function spec(source: Source, ...labels: string[]): CatalogSpecification | undefined {
  const wanted = labels.map((l) => l.toLowerCase());
  return source.specifications.find((s) => wanted.includes(s.label.trim().toLowerCase()) && s.value.trim());
}

/** The first feature bullet matching `pattern`, with the match. */
function feature(source: Source, pattern: RegExp): RegExpMatchArray | undefined {
  for (const text of source.features) {
    const match = text.match(pattern);
    if (match) return match;
  }
  return undefined;
}

function fromSpec(label: string, text: string): CatalogHighlight {
  return { text, source: "specification", label };
}

function fromFeature(text: string): CatalogHighlight {
  return { text, source: "feature", label: "Feature" };
}

/** "ACTIVE NOISE CANCELLATION" -> "Active noise cancellation". */
function sentence(value: string): string {
  const lower = value.trim().toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const HEADPHONE_RULES: Rule[] = [
  // Noise control: the specification when the listing has one, otherwise an
  // explicit "active noise cancelling" in its own feature bullets.
  (s) => {
    const row = spec(s, "Noise Control");
    if (row) return fromSpec(row.label, sentence(row.value));
    const match = feature(s, /\b(hybrid\s+)?active\s+noise[\s-]cancel(?:l)?ing\b/i);
    if (match) return fromFeature(match[1] ? "Hybrid active noise cancelling" : "Active noise cancelling");
    return undefined;
  },
  // Battery or playtime, only as a stated number of hours.
  (s) => {
    const row = spec(s, "Battery Average Life", "Battery Life");
    const hours = row?.value.match(/^(\d{1,3})\s*hours?$/i);
    if (row && hours) return fromSpec(row.label, `${hours[1]}-hour battery`);
    const upTo = feature(s, /\bup\s+to\s+(\d{1,3})[\s-]hours?\s+(?:of\s+)?battery\b/i);
    if (upTo) return fromFeature(`Up to ${upTo[1]}-hour battery`);
    const battery = feature(s, /\b(\d{1,3})[\s-]hours?\s+battery\s+life\b/i);
    if (battery) return fromFeature(`${battery[1]}-hour battery`);
    const playtime = feature(s, /\b(\d{1,3})[\s-]hours?\s+playtime\b/i);
    if (playtime) return fromFeature(`${playtime[1]}-hour playtime`);
    return undefined;
  },
  (s) => {
    const row = spec(s, "Water Resistance Level");
    return row && /^water resistant$/i.test(row.value.trim()) ? fromSpec(row.label, "Water resistant") : undefined;
  },
  (s) => (feature(s, /\bspatial\s+audio\b/i) ? fromFeature("Spatial audio") : undefined),
  (s) => (feature(s, /\btransparency\s+mode\b/i) ? fromFeature("Transparency mode") : undefined),
  (s) => (feature(s, /\blossless\s+audio\b/i) ? fromFeature("Lossless audio") : undefined),
  (s) => {
    const row = spec(s, "Additional Features");
    if (row && /\bfoldable\b/i.test(row.value)) return fromSpec(row.label, "Foldable");
    return feature(s, /\bfoldable\b/i) ? fromFeature("Foldable") : undefined;
  },
  // Ear placement only where the product type does not already say it.
  (s) => {
    if (s.productType === "over_ear_headphones") return undefined;
    const row = spec(s, "Ear Placement", "Headphones Ear Placement", "Form Factor");
    if (!row) return undefined;
    if (/^on[\s-]ear$/i.test(row.value.trim())) return fromSpec(row.label, "On-ear");
    if (/^over[\s-]ear$/i.test(row.value.trim())) return fromSpec(row.label, "Over-ear");
    return undefined;
  },
  (s) => {
    const row = spec(s, "Connectivity Technology");
    return row && /\bwired\b/i.test(row.value) && /\bwireless\b/i.test(row.value)
      ? fromSpec(row.label, "Wired and wireless")
      : undefined;
  },
  (s) => {
    const match = feature(s, /\bBluetooth\s+(\d\.\d)\b/i);
    return match ? fromFeature(`Bluetooth ${match[1]}`) : undefined;
  },
];

const CLOTHING_RULES: Rule[] = [
  (s) => {
    const row = spec(s, "Number of Items");
    const n = row?.value.trim();
    return row && n && /^\d{1,3}$/.test(n) && Number(n) > 1 ? fromSpec(row.label, `Pack of ${n}`) : undefined;
  },
  (s) => {
    if (feature(s, /\bshort[\s-]sleeves?\b/i)) return fromFeature("Short sleeve");
    if (feature(s, /\blong[\s-]sleeves?\b/i)) return fromFeature("Long sleeve");
    return undefined;
  },
  (s) => (feature(s, /\bchest\s+pocket\b/i) ? fromFeature("Chest pocket") : undefined),
  (s) =>
    feature(s, /\bmoisture[\s-]wicking\b|\bwicks?\s+(?:away\s+)?moisture\b/i) ? fromFeature("Moisture-wicking") : undefined,
  (s) => {
    if (feature(s, /\btag[\s-]?free\b|\btagless\b/i)) return fromFeature("Tag-free");
    if (feature(s, /\btear[\s-]away\s+label\b/i)) return fromFeature("Tear-away label");
    return undefined;
  },
  (s) => {
    if (feature(s, /\bheavyweight\b/i)) return fromFeature("Heavyweight");
    if (feature(s, /\bmid[\s-]weight\b/i)) return fromFeature("Mid-weight");
    return undefined;
  },
];

const MAX_HIGHLIGHTS = 3;

function rulesFor(category: string): Rule[] {
  if (category === "headphones") return HEADPHONE_RULES;
  if (category === "clothing") return CLOTHING_RULES;
  return [];
}

/** Up to three tags, in rule order, each text at most once. */
export function pickHighlights(category: string, source: Source): CatalogHighlight[] {
  const out: CatalogHighlight[] = [];
  for (const rule of rulesFor(category)) {
    if (out.length === MAX_HIGHLIGHTS) break;
    const highlight = rule(source);
    if (highlight && !out.some((h) => h.text.toLowerCase() === highlight.text.toLowerCase())) out.push(highlight);
  }
  return out;
}

/** The listing's material composition, exactly as stated, or null. */
export function pickMaterial(source: Pick<Source, "specifications">): string | null {
  const row = spec({ ...source, features: [], productType: "" }, "Fabric type", "Material");
  return row ? row.value.replace(/\s+/g, " ").trim() : null;
}

/** The specification labels the rules above read, for narrowing a query. */
export const HIGHLIGHT_SPEC_LABELS = [
  "Noise Control",
  "Battery Average Life",
  "Battery Life",
  "Water Resistance Level",
  "Additional Features",
  "Ear Placement",
  "Headphones Ear Placement",
  "Form Factor",
  "Connectivity Technology",
  "Number of Items",
  "Number Of Items",
  "Fabric type",
  "Material",
] as const;

export interface OptionCounts {
  /** Options the listing has. */
  total: number;
  /** Options with a listed USD price. */
  priced: number;
  /** Priced options that are not out of stock: what can be selected here. */
  purchasable: number;
}

/** The same rules as checkout pricing and the variant picker. */
export function countOptions(
  variants: { priceCents: number | null; currency: string | null; availability: CatalogAvailability }[],
): OptionCounts {
  const priced = variants.filter((v) => v.priceCents !== null && v.currency === "USD");
  return {
    total: variants.length,
    priced: priced.length,
    purchasable: priced.filter((v) => v.availability !== "out_of_stock").length,
  };
}

/** "7 of 31 options priced" — the one wording used wherever options are
 *  counted. An option without a price is not called out of stock. */
export function optionsPricedText(counts: Pick<OptionCounts, "total" | "priced">): string {
  return `${counts.priced} of ${counts.total} ${counts.total === 1 ? "option" : "options"} priced`;
}

/** ", 2 out of stock" when priced options are also reported out of stock. */
export function outOfStockText(counts: OptionCounts): string {
  const out = counts.priced - counts.purchasable;
  return out > 0 ? `${out} out of stock` : "";
}
