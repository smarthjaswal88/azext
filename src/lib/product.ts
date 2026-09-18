/** Pure helpers over a Product. No data access — see src/server/catalog.ts. */

import type { OptionKey, Product, ProductImage, Variant } from "./types";

export type Selection = Partial<Record<OptionKey, string>>;

/** Finds the variant matching a full selection. Returns undefined if the
 *  combination does not exist, which is different from existing but being
 *  out of stock — callers need to tell those apart. */
export function findVariant(product: Product, selection: Selection): Variant | undefined {
  return product.variants.find((v) =>
    product.optionAxes.every((axis) => v.options[axis.key] === selection[axis.key]),
  );
}

export function findVariantById(product: Product, id: string): Variant | undefined {
  return product.variants.find((v) => v.id === id);
}

/** The selection a product page opens on: the first available variant, falling
 *  back to the first variant so a fully sold-out product still renders. */
export function defaultSelection(product: Product): Selection {
  const variant = product.variants.find((v) => v.available) ?? product.variants[0];
  return { ...variant.options };
}

/** Lowest price among available variants, falling back to the lowest overall
 *  so listings never show a blank price for a sold-out product. */
export function fromPriceCents(product: Product): number {
  const available = product.variants.filter((v) => v.available);
  const pool = available.length > 0 ? available : product.variants;
  return Math.min(...pool.map((v) => v.priceCents));
}

export function priceRangeCents(product: Product): { min: number; max: number } {
  const prices = product.variants.map((v) => v.priceCents);
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function hasMultiplePrices(product: Product): boolean {
  const { min, max } = priceRangeCents(product);
  return min !== max;
}

/** Images depicting a colour, falling back to everything when a product's
 *  images are not colour-specific. */
export function imagesForColor(product: Product, colorId: string | undefined): ProductImage[] {
  if (!colorId) return product.images;
  const matching = product.images.filter((img) => img.colorId === colorId);
  return matching.length > 0 ? matching : product.images;
}

/** Whether any variant in this colour can be bought — used to mark a colour
 *  swatch as sold out without having to pick a size first. */
export function colorHasStock(product: Product, colorId: string): boolean {
  return product.variants.some((v) => v.options.color === colorId && v.available);
}

/** Which option values are in stock given the rest of the selection. Lets the
 *  UI mark individual sizes unavailable for the chosen colour. */
export function valueHasStock(
  product: Product,
  axisKey: OptionKey,
  valueId: string,
  selection: Selection,
): boolean {
  return product.variants.some((v) => {
    if (v.options[axisKey] !== valueId) return false;
    if (!v.available) return false;
    return product.optionAxes.every(
      (axis) => axis.key === axisKey || v.options[axis.key] === selection[axis.key],
    );
  });
}

export function discountPercent(variant: Variant): number | undefined {
  if (!variant.listPriceCents || variant.listPriceCents <= variant.priceCents) return undefined;
  return Math.round(((variant.listPriceCents - variant.priceCents) / variant.listPriceCents) * 100);
}
