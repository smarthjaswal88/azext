-- Demo orders for the prototype storefront.
--
-- Access model: row-level security is enabled and no policy is ever created,
-- so anon and authenticated roles can read nothing. Every read and write goes
-- through server code holding the service-role key, which bypasses RLS. A guest
-- retrieves their own order with an unguessable confirmation token and cannot
-- enumerate anyone else's, because they cannot query the table at all.
--
-- All money is integer cents. There is no floating point anywhere in here.

create extension if not exists "pgcrypto";

create table if not exists public.orders (
  id                 uuid primary key default gen_random_uuid(),
  confirmation_token text        not null unique,
  idempotency_key    text        not null unique,
  status             text        not null default 'demo_placed',
  currency           text        not null default 'USD',
  subtotal_cents     integer     not null check (subtotal_cents >= 0),
  shipping_cents     integer     not null check (shipping_cents >= 0),
  total_cents        integer     not null check (total_cents >= 0),
  -- Fixed demo delivery details. No real personal information is ever stored.
  delivery           jsonb       not null,
  created_at         timestamptz not null default now()
);

create table if not exists public.order_items (
  id                uuid primary key default gen_random_uuid(),
  order_id          uuid    not null references public.orders(id) on delete cascade,
  variant_id        text    not null,
  product_slug      text    not null,
  title             text    not null,
  options_label     text    not null,
  unit_price_cents  integer not null check (unit_price_cents >= 0),
  quantity          integer not null check (quantity between 1 and 10),
  line_total_cents  integer not null check (line_total_cents >= 0)
);

create index if not exists order_items_order_id_idx on public.order_items(order_id);

alter table public.orders      enable row level security;
alter table public.order_items enable row level security;

-- Deliberately no policies. Deny by default; service role bypasses RLS.
revoke all on public.orders      from anon, authenticated;
revoke all on public.order_items from anon, authenticated;

-- Creates an order and its items in one transaction. Idempotent: calling it
-- again with the same key returns the original confirmation token and inserts
-- nothing, so a double-clicked button or a retried request cannot produce a
-- second order.
create or replace function public.create_demo_order(
  p_idempotency_key    text,
  p_confirmation_token text,
  p_currency           text,
  p_subtotal_cents     integer,
  p_shipping_cents     integer,
  p_total_cents        integer,
  p_delivery           jsonb,
  p_items              jsonb
) returns text
language plpgsql
as $$
declare
  v_order_id uuid;
  v_token    text;
begin
  insert into public.orders (
    confirmation_token, idempotency_key, currency,
    subtotal_cents, shipping_cents, total_cents, delivery
  )
  values (
    p_confirmation_token, p_idempotency_key, p_currency,
    p_subtotal_cents, p_shipping_cents, p_total_cents, p_delivery
  )
  on conflict (idempotency_key) do nothing
  returning id, confirmation_token into v_order_id, v_token;

  -- Another call with this key already created the order; return that one.
  if v_order_id is null then
    select confirmation_token into v_token
    from public.orders
    where idempotency_key = p_idempotency_key;
    return v_token;
  end if;

  insert into public.order_items (
    order_id, variant_id, product_slug, title, options_label,
    unit_price_cents, quantity, line_total_cents
  )
  select
    v_order_id,
    item ->> 'variant_id',
    item ->> 'product_slug',
    item ->> 'title',
    item ->> 'options_label',
    (item ->> 'unit_price_cents')::integer,
    (item ->> 'quantity')::integer,
    (item ->> 'line_total_cents')::integer
  from jsonb_array_elements(p_items) as item;

  return v_token;
end;
$$;

revoke all on function public.create_demo_order(
  text, text, text, integer, integer, integer, jsonb, jsonb
) from anon, authenticated;
