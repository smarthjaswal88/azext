-- Supabase-backed product catalog, populated from Bright Data.
--
-- Four tables:
--   catalog_products        one row per source product (an Amazon ASIN today)
--   catalog_variants        purchasable options of a product
--   catalog_specifications  specification rows and feature bullets
--   catalog_sync_runs       safe metadata about each import: counts and codes,
--                           never raw payloads, tokens or upstream messages
--
-- Access model matches the orders and AI tables: row-level security on, no
-- policies, table privileges revoked from anon and authenticated. Every read
-- and write goes through server code holding the secret key, which bypasses
-- RLS. Catalog reads reach the browser only through the /api/catalog routes.
--
-- Money is integer cents. There is no floating point anywhere in here.
--
-- No review text, reviewer data, seller data or images are stored. Images are
-- referenced by URL only, and only from Amazon's image CDN (enforced in code).
--
-- Additive: nothing here touches an earlier migration's objects. Wrapped in a
-- transaction so a failure part-way leaves nothing half-created.

begin;

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

create table if not exists public.catalog_products (
  id                 uuid         primary key default gen_random_uuid(),
  slug               text         not null,
  source             text         not null,
  source_product_id  text         not null,
  source_url         text         not null,
  title              text         not null,
  brand              text,
  category           text         not null,
  product_type       text         not null,
  description        text,
  price_cents        integer      not null,
  -- The source's was-price, kept only when it is higher than the price.
  list_price_cents   integer,
  currency           text         not null,
  rating             numeric(2,1),
  rating_count       integer,
  availability       text         not null default 'unknown',
  -- The source's own availability wording, e.g. "Only 3 left in stock".
  availability_text  text,
  image_url          text,
  -- The source's category breadcrumb, for reference. `category` above is ours.
  source_categories  text[]       not null default '{}',
  -- Which import keyword found this product. Null when it had to be inferred.
  discovery_keyword  text,
  fetched_at         timestamptz  not null,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),
  search_vector      tsvector     generated always as (
                       setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
                       setweight(to_tsvector('english', coalesce(brand, '')), 'A') ||
                       setweight(to_tsvector('english', coalesce(description, '')), 'C')
                     ) stored,

  constraint catalog_products_slug_key
    unique (slug),
  constraint catalog_products_source_product_key
    unique (source, source_product_id),

  constraint catalog_products_slug_format
    check (char_length(slug) <= 120 and slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  constraint catalog_products_source_check
    check (source in ('bright_data_amazon')),
  constraint catalog_products_asin_format
    check (source <> 'bright_data_amazon' or source_product_id ~ '^[A-Z0-9]{10}$'),
  constraint catalog_products_source_url_https
    check (char_length(source_url) <= 500 and source_url ~ '^https://'),
  constraint catalog_products_title_length
    check (char_length(title) between 1 and 500),
  constraint catalog_products_brand_length
    check (brand is null or char_length(brand) between 1 and 120),
  constraint catalog_products_category_format
    check (category ~ '^[a-z0-9_-]{1,40}$'),
  constraint catalog_products_product_type_format
    check (product_type ~ '^[a-z0-9_]{1,40}$'),
  constraint catalog_products_description_length
    check (description is null or char_length(description) between 1 and 10000),
  constraint catalog_products_price_range
    check (price_cents between 1 and 100000000),
  constraint catalog_products_list_price_above_price
    check (list_price_cents is null or list_price_cents > price_cents),
  constraint catalog_products_currency_format
    check (currency ~ '^[A-Z]{3}$'),
  constraint catalog_products_rating_range
    check (rating is null or rating between 0 and 5),
  constraint catalog_products_rating_count_range
    check (rating_count is null or rating_count >= 0),
  constraint catalog_products_availability_check
    check (availability in ('in_stock', 'limited_stock', 'out_of_stock', 'unknown')),
  constraint catalog_products_availability_text_length
    check (availability_text is null or char_length(availability_text) between 1 and 200),
  constraint catalog_products_image_url_https
    check (image_url is null or (char_length(image_url) <= 500 and image_url ~ '^https://')),
  constraint catalog_products_discovery_keyword_length
    check (discovery_keyword is null or char_length(discovery_keyword) between 1 and 100)
);

-- slug is indexed by its unique constraint above.
create index if not exists catalog_products_category_idx
  on public.catalog_products (category);
create index if not exists catalog_products_brand_idx
  on public.catalog_products (brand);
create index if not exists catalog_products_price_idx
  on public.catalog_products (price_cents);
create index if not exists catalog_products_rating_idx
  on public.catalog_products (rating desc nulls last, rating_count desc nulls last);
create index if not exists catalog_products_updated_at_idx
  on public.catalog_products (updated_at desc);
create index if not exists catalog_products_search_idx
  on public.catalog_products using gin (search_vector);

-- ---------------------------------------------------------------------------
-- variants
-- ---------------------------------------------------------------------------
-- Every product has exactly one default variant: the listing itself. Further
-- rows appear only when the source returns variations. A variant whose price
-- the source did not give has a null price and is not purchasable — nothing
-- borrows the parent's price.

create table if not exists public.catalog_variants (
  id                 uuid         primary key default gen_random_uuid(),
  product_id         uuid         not null references public.catalog_products (id) on delete cascade,
  -- The source's id for this option (an ASIN today).
  source_variant_id  text         not null,
  label              text,
  -- Named option values when the source gives them, e.g. {"color": "Black"}.
  options            jsonb        not null default '{}'::jsonb,
  price_cents        integer,
  currency           text,
  availability       text         not null default 'unknown',
  is_default         boolean      not null default false,
  position           integer      not null default 0,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),

  constraint catalog_variants_source_key
    unique (product_id, source_variant_id),

  constraint catalog_variants_source_variant_length
    check (char_length(source_variant_id) between 1 and 64),
  constraint catalog_variants_label_length
    check (label is null or char_length(label) between 1 and 200),
  constraint catalog_variants_options_object
    check (jsonb_typeof(options) = 'object'),
  constraint catalog_variants_price_range
    check (price_cents is null or price_cents between 1 and 100000000),
  constraint catalog_variants_currency_format
    check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint catalog_variants_price_has_currency
    check (price_cents is null or currency is not null),
  constraint catalog_variants_availability_check
    check (availability in ('in_stock', 'limited_stock', 'out_of_stock', 'unknown')),
  constraint catalog_variants_position_range
    check (position >= 0)
);

-- product_id lookups use the leading column of catalog_variants_source_key.
create unique index if not exists catalog_variants_one_default_idx
  on public.catalog_variants (product_id)
  where is_default;

-- ---------------------------------------------------------------------------
-- specifications and feature bullets
-- ---------------------------------------------------------------------------

create table if not exists public.catalog_specifications (
  id          uuid         primary key default gen_random_uuid(),
  product_id  uuid         not null references public.catalog_products (id) on delete cascade,
  -- 'specification' rows have a label; 'feature' rows are the listing's
  -- bullet points and have none.
  kind        text         not null,
  label       text,
  value       text         not null,
  position    integer      not null,
  created_at  timestamptz  not null default now(),

  constraint catalog_specifications_position_key
    unique (product_id, position),

  constraint catalog_specifications_kind_check
    check (kind in ('specification', 'feature')),
  constraint catalog_specifications_label_rule
    check (
      (kind = 'specification' and label is not null and char_length(label) between 1 and 120)
      or (kind = 'feature' and label is null)
    ),
  constraint catalog_specifications_value_length
    check (char_length(value) between 1 and 1000),
  constraint catalog_specifications_position_range
    check (position >= 0)
);

-- ---------------------------------------------------------------------------
-- sync runs
-- ---------------------------------------------------------------------------
-- The limits of the authorized collection are written into the constraints:
-- no run can be recorded asking for more than 6 records per keyword or 24 in
-- total, and the import inserts its run row before it contacts Bright Data,
-- so a larger request fails here first.
--
-- trigger_state records whether Bright Data accepted the paid request:
--   not_sent  nothing was sent
--   accepted  Bright Data returned a snapshot id (the collection is billed)
--   rejected  Bright Data refused it with a 4xx (nothing was collected)
--   unknown   the request was sent but the outcome is not known (timeout,
--             network failure, 5xx) — treated as possibly billed

create table if not exists public.catalog_sync_runs (
  id                 uuid         primary key default gen_random_uuid(),
  source             text         not null,
  status             text         not null default 'pending',
  trigger_state      text         not null default 'not_sent',
  dataset_id         text         not null,
  snapshot_id        text,
  keywords           text[]       not null,
  limit_per_keyword  integer      not null,
  max_records        integer      not null,
  fetched_count      integer      not null default 0,
  imported_count     integer      not null default 0,
  updated_count      integer      not null default 0,
  skipped_count      integer      not null default 0,
  failed_count       integer      not null default 0,
  -- Counts keyed by our own reason codes, e.g. {"missing_price": 2}.
  skip_reasons       jsonb        not null default '{}'::jsonb,
  -- Counts keyed by Postgres error codes for records that failed to save.
  failure_codes      jsonb        not null default '{}'::jsonb,
  -- Per-keyword counts: {"linen shirt": {"fetched": 6, "accepted": 5, ...}}.
  keyword_counts     jsonb        not null default '{}'::jsonb,
  -- Which fields were present, by name and count only. Never values.
  field_coverage     jsonb        not null default '{}'::jsonb,
  -- A short code of our own, never an upstream message.
  error_code         text,
  started_at         timestamptz  not null default now(),
  triggered_at       timestamptz,
  finished_at        timestamptz,
  created_at         timestamptz  not null default now(),
  updated_at         timestamptz  not null default now(),

  constraint catalog_sync_runs_source_check
    check (source in ('bright_data_amazon')),
  constraint catalog_sync_runs_status_check
    check (status in ('pending', 'collecting', 'importing', 'completed', 'completed_with_errors', 'failed')),
  constraint catalog_sync_runs_trigger_state_check
    check (trigger_state in ('not_sent', 'accepted', 'rejected', 'unknown')),
  constraint catalog_sync_runs_dataset_format
    check (dataset_id ~ '^gd_[a-z0-9]{1,40}$'),
  constraint catalog_sync_runs_snapshot_format
    check (snapshot_id is null or snapshot_id ~ '^[A-Za-z0-9_-]{1,100}$'),
  constraint catalog_sync_runs_keywords_count
    check (cardinality(keywords) between 1 and 4),
  constraint catalog_sync_runs_limit_per_keyword
    check (limit_per_keyword between 1 and 6),
  constraint catalog_sync_runs_max_records
    check (max_records between 1 and 24),
  constraint catalog_sync_runs_counts_non_negative
    check (
      fetched_count >= 0 and imported_count >= 0 and updated_count >= 0
      and skipped_count >= 0 and failed_count >= 0
    ),
  constraint catalog_sync_runs_json_objects
    check (
      jsonb_typeof(skip_reasons) = 'object' and jsonb_typeof(failure_codes) = 'object'
      and jsonb_typeof(keyword_counts) = 'object' and jsonb_typeof(field_coverage) = 'object'
    ),
  constraint catalog_sync_runs_error_code_format
    check (error_code is null or error_code ~ '^[a-z0-9_]{1,64}$')
);

create index if not exists catalog_sync_runs_started_idx
  on public.catalog_sync_runs (source, started_at desc);

-- At most one run in flight per source, so two concurrent start requests
-- cannot both reach Bright Data.
create unique index if not exists catalog_sync_runs_one_active_idx
  on public.catalog_sync_runs (source)
  where status in ('pending', 'collecting', 'importing');

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.catalog_touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists catalog_products_touch_updated_at on public.catalog_products;
create trigger catalog_products_touch_updated_at
  before update on public.catalog_products
  for each row execute function public.catalog_touch_updated_at();

drop trigger if exists catalog_variants_touch_updated_at on public.catalog_variants;
create trigger catalog_variants_touch_updated_at
  before update on public.catalog_variants
  for each row execute function public.catalog_touch_updated_at();

drop trigger if exists catalog_sync_runs_touch_updated_at on public.catalog_sync_runs;
create trigger catalog_sync_runs_touch_updated_at
  before update on public.catalog_sync_runs
  for each row execute function public.catalog_touch_updated_at();

-- ---------------------------------------------------------------------------
-- upsert, one product at a time, atomically
-- ---------------------------------------------------------------------------
-- Inserts or updates a product by (source, source_product_id) and replaces
-- its variants and specifications in the same transaction. Returns
-- {"product_id": uuid, "slug": text, "inserted": boolean}.
--
-- Stable identifiers: an existing product keeps its id, slug and created_at,
-- and an existing variant keeps its id, so links and cart lines that refer
-- to them survive a re-import. Variants the source no longer returns are
-- removed; specifications are replaced wholesale.

create or replace function public.upsert_catalog_product(
  p_product        jsonb,
  p_variants       jsonb,
  p_specifications jsonb
) returns jsonb
language plpgsql
set search_path = ''
as $$
declare
  v_id       uuid;
  v_slug     text;
  v_inserted boolean;
begin
  if jsonb_typeof(p_product) is distinct from 'object'
     or jsonb_typeof(p_variants) is distinct from 'array'
     or jsonb_typeof(p_specifications) is distinct from 'array' then
    raise exception 'upsert_catalog_product: product must be an object, variants and specifications arrays'
      using errcode = '22023';
  end if;

  insert into public.catalog_products as cp (
    slug, source, source_product_id, source_url, title, brand, category,
    product_type, description, price_cents, list_price_cents, currency,
    rating, rating_count, availability, availability_text, image_url,
    source_categories, discovery_keyword, fetched_at
  )
  values (
    p_product ->> 'slug',
    p_product ->> 'source',
    p_product ->> 'source_product_id',
    p_product ->> 'source_url',
    p_product ->> 'title',
    p_product ->> 'brand',
    p_product ->> 'category',
    p_product ->> 'product_type',
    p_product ->> 'description',
    (p_product ->> 'price_cents')::integer,
    (p_product ->> 'list_price_cents')::integer,
    p_product ->> 'currency',
    (p_product ->> 'rating')::numeric,
    (p_product ->> 'rating_count')::integer,
    coalesce(p_product ->> 'availability', 'unknown'),
    p_product ->> 'availability_text',
    p_product ->> 'image_url',
    coalesce(
      array(select jsonb_array_elements_text(coalesce(p_product -> 'source_categories', '[]'::jsonb))),
      '{}'::text[]
    ),
    p_product ->> 'discovery_keyword',
    (p_product ->> 'fetched_at')::timestamptz
  )
  on conflict (source, source_product_id) do update set
    source_url        = excluded.source_url,
    title             = excluded.title,
    brand             = excluded.brand,
    category          = excluded.category,
    product_type      = excluded.product_type,
    description       = excluded.description,
    price_cents       = excluded.price_cents,
    list_price_cents  = excluded.list_price_cents,
    currency          = excluded.currency,
    rating            = excluded.rating,
    rating_count      = excluded.rating_count,
    availability      = excluded.availability,
    availability_text = excluded.availability_text,
    image_url         = excluded.image_url,
    source_categories = excluded.source_categories,
    discovery_keyword = excluded.discovery_keyword,
    fetched_at        = excluded.fetched_at
  returning cp.id, cp.slug, (cp.xmax = 0) into v_id, v_slug, v_inserted;

  -- Clear the default flag first: the one-default index is checked row by
  -- row, so moving the default between two rows in one statement would
  -- otherwise collide with itself.
  update public.catalog_variants
     set is_default = false
   where product_id = v_id
     and is_default;

  delete from public.catalog_variants as cv
   where cv.product_id = v_id
     and not exists (
       select 1
         from jsonb_array_elements(p_variants) as item
        where item ->> 'source_variant_id' = cv.source_variant_id
     );

  insert into public.catalog_variants as cv (
    product_id, source_variant_id, label, options, price_cents, currency,
    availability, is_default, position
  )
  select
    v_id,
    t.item ->> 'source_variant_id',
    t.item ->> 'label',
    coalesce(t.item -> 'options', '{}'::jsonb),
    (t.item ->> 'price_cents')::integer,
    t.item ->> 'currency',
    coalesce(t.item ->> 'availability', 'unknown'),
    coalesce((t.item ->> 'is_default')::boolean, false),
    (t.ord - 1)::integer
  from jsonb_array_elements(p_variants) with ordinality as t(item, ord)
  on conflict (product_id, source_variant_id) do update set
    label        = excluded.label,
    options      = excluded.options,
    price_cents  = excluded.price_cents,
    currency     = excluded.currency,
    availability = excluded.availability,
    is_default   = excluded.is_default,
    position     = excluded.position;

  delete from public.catalog_specifications
   where product_id = v_id;

  insert into public.catalog_specifications (product_id, kind, label, value, position)
  select
    v_id,
    t.item ->> 'kind',
    t.item ->> 'label',
    t.item ->> 'value',
    (t.ord - 1)::integer
  from jsonb_array_elements(p_specifications) with ordinality as t(item, ord);

  return jsonb_build_object('product_id', v_id, 'slug', v_slug, 'inserted', v_inserted);
end;
$$;

-- ---------------------------------------------------------------------------
-- access
-- ---------------------------------------------------------------------------

alter table public.catalog_products       enable row level security;
alter table public.catalog_variants       enable row level security;
alter table public.catalog_specifications enable row level security;
alter table public.catalog_sync_runs      enable row level security;

-- Deliberately no policies. Deny by default; the secret key bypasses RLS.
revoke all on public.catalog_products       from anon, authenticated;
revoke all on public.catalog_variants       from anon, authenticated;
revoke all on public.catalog_specifications from anon, authenticated;
revoke all on public.catalog_sync_runs      from anon, authenticated;

-- Functions are executable by PUBLIC by default, and anon and authenticated
-- inherit that grant, so it is revoked from PUBLIC as well as from them.
revoke all on function public.upsert_catalog_product(jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.upsert_catalog_product(jsonb, jsonb, jsonb)
  to service_role;

revoke all on function public.catalog_touch_updated_at()
  from public, anon, authenticated;
grant execute on function public.catalog_touch_updated_at()
  to service_role;

commit;

-- Ask the Supabase API to pick up the new tables and function immediately.
notify pgrst, 'reload schema';
