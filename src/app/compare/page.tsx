import Image from "next/image";
import Link from "next/link";
import { CompareAddToCart } from "@/components/compare-add-to-cart";
import { GuidancePanel } from "@/components/guidance-panel";
import { SiteHeader } from "@/components/site-header";
import { RatingLine } from "@/components/star-rating";
import {
  compareHref,
  decodeSelection,
  MAX_COMPARE,
  MIN_COMPARE,
  type CompareSelection,
} from "@/lib/compare";
import {
  comparisonGroupDescription,
  comparisonGroupLabel,
  comparisonGroupOf,
} from "@/lib/comparison-group";
import { formatCount, formatPrice } from "@/lib/format";
import { discountPercent, findVariant, imagesForColor } from "@/lib/product";
import type { OptionKey, Product, Variant } from "@/lib/types";
import { readAiAvailability } from "@/server/ai/budget";
import { getProductsBySlugs } from "@/server/catalog";

export const metadata = { title: "Compare products" };

type RawParams = Record<string, string | string[] | undefined>;

interface Column {
  product: Product;
  selection: CompareSelection;
  variant?: Variant;
  /** True when the product varies by size and none has been chosen yet. */
  needsSize: boolean;
}

/** Resolves one column's selection against the catalog. Anything the URL names
 *  that does not exist is ignored rather than trusted. */
function buildColumn(product: Product, selection: CompareSelection): Column {
  const colorAxis = product.optionAxes.find((a) => a.key === "color");
  const sizeAxis = product.optionAxes.find((a) => a.key === "size");

  const firstAvailable = product.variants.find((v) => v.available) ?? product.variants[0];

  const colorId = colorAxis?.values.some((v) => v.id === selection.colorId)
    ? selection.colorId
    : firstAvailable.options.color;

  // Size is deliberately NOT defaulted. A shopper must choose one before a
  // garment can reach the cart, so an unchosen size stays unchosen.
  const sizeId = sizeAxis?.values.some((v) => v.id === selection.sizeId)
    ? selection.sizeId
    : undefined;

  const resolved: CompareSelection = { slug: product.slug, colorId, sizeId };
  const variant = sizeAxis
    ? sizeId
      ? findVariant(product, { color: colorId, size: sizeId })
      : undefined
    : findVariant(product, { color: colorId });

  return { product, selection: resolved, variant, needsSize: Boolean(sizeAxis) && !sizeId };
}

function selectionsFrom(columns: Column[]): CompareSelection[] {
  return columns.map((c) => c.selection);
}

/** The selection field an option axis writes to. */
function fieldFor(key: OptionKey): "colorId" | "sizeId" {
  return key === "color" ? "colorId" : "sizeId";
}

function chosenValue(selection: CompareSelection, key: OptionKey): string | undefined {
  return key === "color" ? selection.colorId : selection.sizeId;
}

/** Link that changes one axis on one column and leaves the rest alone. */
function axisHref(columns: Column[], slug: string, key: OptionKey, valueId: string): string {
  return compareHref(
    selectionsFrom(columns).map((sel) =>
      sel.slug === slug ? { ...sel, [fieldFor(key)]: valueId } : sel,
    ),
  );
}

function removeHref(columns: Column[], slug: string): string {
  return compareHref(selectionsFrom(columns).filter((sel) => sel.slug !== slug));
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  const params = await searchParams;
  const raw = params.p;
  const rawList = Array.isArray(raw) ? raw : raw ? [raw] : [];

  const requested = rawList
    .map(decodeSelection)
    .filter((s): s is CompareSelection => s !== undefined);

  // Dedupe by slug, keeping the first occurrence and the cap.
  const seen = new Set<string>();
  const unique: CompareSelection[] = [];
  for (const sel of requested) {
    if (seen.has(sel.slug)) continue;
    seen.add(sel.slug);
    unique.push(sel);
  }
  const capped = unique.slice(0, MAX_COMPARE);

  const products = await getProductsBySlugs(capped.map((s) => s.slug));
  const notices: string[] = [];

  if (products.length < capped.length) {
    notices.push(
      `${capped.length - products.length} selection${capped.length - products.length === 1 ? " was" : "s were"} not found in the catalog and ${capped.length - products.length === 1 ? "has" : "have"} been left out.`,
    );
  }
  if (unique.length > MAX_COMPARE) {
    notices.push(`Only the first ${MAX_COMPARE} products are shown.`);
  }

  // One comparison group at a time. When a URL names more than one, we do NOT
  // pick a subset on the shopper's behalf — quietly dropping half of what they
  // asked for and showing the rest as though it were the request is worse than
  // asking. They are shown what is in the link and choose which group to open.
  const groupsPresent = [...new Set(products.map(comparisonGroupOf))];

  if (groupsPresent.length > 1) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-6 sm:px-4">
          <h1 className="text-xl font-bold sm:text-2xl">Compare products</h1>
          <div className="mt-4 rounded-lg border border-border-subtle bg-surface p-4 sm:p-6">
            <h2 className="text-base font-semibold">
              This link mixes {groupsPresent.length} kinds of product
            </h2>
            <p className="mt-1.5 max-w-prose text-sm text-ink-muted">
              Products are only compared against similar ones, so that the rows line up and mean
              something. Pick which set you would like to see — nothing has been chosen for you.
            </p>

            <ul className="mt-4 space-y-3">
              {groupsPresent.map((g) => {
                const inThisGroup = products.filter((p) => comparisonGroupOf(p) === g);
                const selections = inThisGroup.map(
                  (p) => capped.find((c) => c.slug === p.slug) ?? { slug: p.slug },
                );
                return (
                  <li
                    key={g}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface-muted p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{comparisonGroupLabel(g)}</p>
                      <p className="text-xs text-ink-muted">
                        {inThisGroup.map((p) => p.title).join(" · ")}
                      </p>
                    </div>
                    {inThisGroup.length >= MIN_COMPARE ? (
                      <Link
                        href={compareHref(selections)}
                        className="shrink-0 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
                      >
                        Compare these {inThisGroup.length}
                      </Link>
                    ) : (
                      <span className="shrink-0 text-xs text-ink-muted">
                        Only one here — add another to compare
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>

            <Link
              href="/search"
              className="mt-4 inline-block text-sm text-ink-link hover:underline"
            >
              Or keep browsing
            </Link>
          </div>
        </main>
      </>
    );
  }

  const group = groupsPresent[0];
  const columns: Column[] = products.map((product) =>
    buildColumn(product, capped.find((s) => s.slug === product.slug) ?? { slug: product.slug }),
  );

  if (columns.length < MIN_COMPARE) {
    return (
      <>
        <SiteHeader />
        <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-6 sm:px-4">
          <h1 className="text-xl font-bold sm:text-2xl">Compare products</h1>
          {notices.length > 0 && (
            <ul className="mt-3 space-y-1 rounded-md border border-border-subtle bg-surface p-3 text-sm text-ink-muted">
              {notices.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          )}
          <div className="mt-4 rounded-lg border border-border-subtle bg-surface p-10 text-center">
            <p className="text-base font-semibold">
              Pick at least {MIN_COMPARE} products to compare.
            </p>
            <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
              {group
                ? `Add another item from ${comparisonGroupDescription(group)} — products are only compared against similar ones.`
                : "Use “Add to compare” on any product, then open the comparison from the tray."}{" "}
              Comparison is optional — you can buy anything without it.
            </p>
            <Link
              href="/search"
              className="mt-5 inline-block rounded-full bg-accent px-5 py-2 text-sm font-semibold text-accent-ink hover:bg-accent-hover"
            >
              Browse products
            </Link>
          </div>
        </main>
      </>
    );
  }

  // Specification rows are the union of every label present, in the order they
  // first appear, so the rows line up across columns. A product that does not
  // carry a label says so rather than borrowing a neighbour's value.
  const specLabels: string[] = [];
  for (const column of columns) {
    for (const spec of column.product.specs) {
      if (!specLabels.includes(spec.label)) specLabels.push(spec.label);
    }
  }

  // Equal-width product columns that share whatever space is left after the
  // label column. minmax(0,1fr) rather than a minimum width, so two or three
  // columns fit the desktop viewport instead of forcing the container to
  // scroll.
  const gridCols = `140px repeat(${columns.length}, minmax(0, 1fr))`;
  const cell = "border-b border-border-subtle px-2.5 py-3 sm:px-3";
  // Sticky so the attribute label stays readable while the columns scroll on a
  // narrow screen — otherwise you scroll right and lose what the row means.
  const labelCell =
    `${cell} sticky left-0 z-10 bg-surface-muted text-[11px] font-semibold uppercase ` +
    "tracking-wide text-ink-muted sm:text-xs";

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1500px] flex-1 px-3 py-4 sm:px-4">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-xl font-bold sm:text-2xl">Compare products</h1>
          <Link href="/search" className="text-sm text-ink-link hover:underline">
            Keep shopping
          </Link>
        </div>

        {notices.length > 0 && (
          <ul
            role="status"
            className="mb-3 space-y-1 rounded-md border border-border-strong bg-surface p-3 text-sm text-ink-muted"
          >
            {notices.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        )}

        {/* Scrolling is confined to this container: the page itself never
            scrolls sideways. Below `lg` the grid keeps a floor width so columns
            stay readable and the container scrolls; from `lg` the floor is
            removed and the whole table fits. */}
        <div className="overflow-x-auto rounded-lg border border-border-subtle bg-surface">
          <div
            className="grid min-w-[600px] lg:min-w-0"
            style={{ gridTemplateColumns: gridCols }}
          >
            {/* ---- product ---- */}
            <div className={`${labelCell} flex items-end`}>Product</div>
            {columns.map((column) => {
              const gallery = imagesForColor(column.product, column.selection.colorId);
              return (
                <div key={`head-${column.product.slug}`} className={cell}>
                  <div className="relative mx-auto aspect-square w-full max-w-[110px] rounded bg-surface-image sm:max-w-[132px]">
                    <Image
                      src={gallery[0].src}
                      alt={gallery[0].alt}
                      fill
                      sizes="132px"
                      className="object-contain"
                    />
                  </div>
                  <p className="mt-2 text-[11px] uppercase tracking-wide text-ink-muted">
                    {column.product.brand}
                  </p>
                  <Link
                    href={`/product/${column.product.slug}`}
                    className="mt-0.5 block text-sm font-medium leading-snug hover:text-ink-link hover:underline"
                  >
                    {column.product.title}
                  </Link>
                  <Link
                    href={removeHref(columns, column.product.slug)}
                    className="mt-1.5 inline-block text-xs text-ink-link hover:underline"
                  >
                    Remove from comparison
                  </Link>
                </div>
              );
            })}

            {/* ---- options ---- */}
            <div className={labelCell}>Options</div>
            {columns.map((column) => (
              <div key={`opts-${column.product.slug}`} className={cell}>
                {column.product.optionAxes.map((axis) => {
                  const chosen = chosenValue(column.selection, axis.key);
                  return (
                    <div key={axis.key} className="mb-2.5 last:mb-0">
                      <p className="mb-1 text-xs text-ink-muted">
                        {axis.label}
                        {axis.key === "size" && !chosen && (
                          <span className="ml-1 font-semibold text-sale">— choose one</span>
                        )}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {axis.values.map((value) => {
                          const isChosen = value.id === chosen;
                          return (
                            <Link
                              key={value.id}
                              href={axisHref(columns, column.product.slug, axis.key, value.id)}
                              scroll={false}
                              aria-current={isChosen}
                              className={`flex items-center gap-1 rounded border px-1.5 py-0.5 text-xs transition ${
                                isChosen
                                  ? "border-accent-ring bg-surface-muted font-semibold ring-1 ring-accent-ring"
                                  : "border-border-strong hover:border-ink"
                              }`}
                            >
                              {value.swatch && (
                                <span
                                  aria-hidden="true"
                                  className="inline-block size-3 rounded-full border border-border-strong"
                                  style={{ background: value.swatch }}
                                />
                              )}
                              {value.label}
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}

            {/* ---- price and availability ---- */}
            <div className={labelCell}>Price</div>
            {columns.map((column) => {
              const discount = column.variant ? discountPercent(column.variant) : undefined;
              return (
                <div key={`price-${column.product.slug}`} className={cell}>
                  {column.variant ? (
                    <>
                      <p className="flex flex-wrap items-baseline gap-1.5">
                        <span className="text-lg font-semibold">
                          {formatPrice(column.variant.priceCents)}
                        </span>
                        {discount !== undefined && (
                          <span className="text-xs font-semibold text-sale">-{discount}%</span>
                        )}
                      </p>
                      <p className="mt-1 text-sm">
                        {column.variant.available ? (
                          <span className="font-semibold text-in-stock">In stock</span>
                        ) : (
                          <span className="font-semibold text-sale">Unavailable</span>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-ink-muted">
                      Choose a size to see the price for this option.
                    </p>
                  )}
                </div>
              );
            })}

            {/* ---- ratings ---- */}
            <div className={labelCell}>Ratings</div>
            {columns.map((column) => (
              <div key={`rating-${column.product.slug}`} className={cell}>
                <RatingLine
                  average={column.product.rating.average}
                  ratingCount={column.product.rating.ratingCount}
                  showCount={false}
                />
                <p className="mt-1 text-xs text-ink-muted">
                  {formatCount(column.product.rating.ratingCount)} ratings
                </p>
                <p className="text-xs text-ink-muted">
                  {formatCount(column.product.rating.reviewCount)} written reviews
                </p>
              </div>
            ))}

            {/* ---- specifications ---- */}
            {specLabels.map((label) => (
              <SpecRow key={label} label={label} columns={columns} labelCell={labelCell} cell={cell} />
            ))}

            {/* ---- review excerpts ---- */}
            <div className={labelCell}>Review excerpts</div>
            {columns.map((column) => {
              const reviews = column.product.reviews.slice(0, 2);
              return (
                <div key={`reviews-${column.product.slug}`} className={cell}>
                  <p className="mb-2 text-xs text-ink-muted">
                    {reviews.length} of {formatCount(column.product.reviews.length)} written demo
                    reviews held for this product. The{" "}
                    {formatCount(column.product.rating.reviewCount)} figure above is an aggregate
                    in the demo data — those individual reviews do not exist here.
                  </p>
                  <ul className="space-y-2.5">
                    {reviews.map((review) => {
                      const bought = review.variantId
                        ? column.product.variants.find((v) => v.id === review.variantId)
                        : undefined;
                      const boughtLabel = bought
                        ? column.product.optionAxes
                            .map(
                              (axis) =>
                                axis.values.find((v) => v.id === bought.options[axis.key])?.label,
                            )
                            .filter(Boolean)
                            .join(" · ")
                        : undefined;
                      return (
                        <li key={review.id} className="text-xs leading-snug">
                          <p className="font-semibold">
                            {review.rating}★ {review.title}
                          </p>
                          <p className="mt-0.5 line-clamp-3 text-ink-muted">{review.body}</p>
                          {boughtLabel && (
                            <p className="mt-0.5 text-[11px] text-ink-muted">
                              Bought: {boughtLabel}
                            </p>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}

            {/* ---- cart ---- */}
            <div className={`${labelCell} border-b-0`}>Buy</div>
            {columns.map((column) => (
              <div key={`cart-${column.product.slug}`} className="border-b-0 px-2.5 py-3 sm:px-3">
                <CompareAddToCart
                  variantId={column.variant?.id}
                  available={column.variant?.available ?? false}
                  needsSize={column.needsSize}
                />
                <Link
                  href={`/product/${column.product.slug}?${new URLSearchParams({
                    ...(column.selection.colorId ? { color: column.selection.colorId } : {}),
                    ...(column.selection.sizeId ? { size: column.selection.sizeId } : {}),
                  })}`}
                  className="mt-2 block text-center text-xs text-ink-link hover:underline"
                >
                  View full details
                </Link>
              </div>
            ))}
          </div>
        </div>

        {/* Guidance sits below the table on purpose: the comparison and its
            purchase controls stay usable while guidance is loading, has failed,
            or is switched off entirely. */}
        <GuidancePanel
          items={columns.map((column) => ({
            slug: column.product.slug,
            title: column.product.title,
            colorId: column.selection.colorId,
            sizeId: column.selection.sizeId,
          }))}
          group={columns[0].product.comparisonGroup}
          aiAvailable={readAiAvailability().available}
        />

        <p className="mt-3 text-xs text-ink-muted">
          Comparison is optional. Every product can be bought from its own page without it.
        </p>
      </main>
    </>
  );
}

/** One specification row. A product lacking the label reads "Not provided" —
 *  never a value borrowed from another column or invented. */
function SpecRow({
  label,
  columns,
  labelCell,
  cell,
}: {
  label: string;
  columns: Column[];
  labelCell: string;
  cell: string;
}) {
  return (
    <>
      <div className={labelCell}>{label}</div>
      {columns.map((column) => {
        const spec = column.product.specs.find((s) => s.label === label);
        return (
          <div key={`${label}-${column.product.slug}`} className={`${cell} text-sm`}>
            {spec ? (
              spec.value
            ) : (
              <span className="text-ink-muted">Not provided</span>
            )}
          </div>
        );
      })}
    </>
  );
}
