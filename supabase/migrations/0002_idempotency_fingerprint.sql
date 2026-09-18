-- Binds an idempotency key to the request it was first used for.
--
-- 0001 returned the existing order for any repeat of a key, whatever the new
-- request contained. That makes a retry safe but makes a *reused* key silently
-- hand back an unrelated order — the caller asks to buy B, is told "done", and
-- is shown order A. This migration distinguishes the two cases by storing a
-- fingerprint of what the key was used for:
--
--   same key, same fingerprint  -> the original order (a genuine retry)
--   same key, different payload -> refused, and no token is disclosed
--
-- Additive and safe to apply on top of 0001.

alter table public.orders
  add column if not exists request_fingerprint text;

-- The old signature cannot be CREATE OR REPLACE'd into the new one, because
-- adding a parameter defines an overload rather than replacing it.
drop function if exists public.create_demo_order(
  text, text, text, integer, integer, integer, jsonb, jsonb
);

create or replace function public.create_demo_order_v2(
  p_idempotency_key     text,
  p_request_fingerprint text,
  p_confirmation_token  text,
  p_currency            text,
  p_subtotal_cents      integer,
  p_shipping_cents      integer,
  p_total_cents         integer,
  p_delivery            jsonb,
  p_items               jsonb
) returns jsonb
language plpgsql
as $$
declare
  v_order_id uuid;
  v_token    text;
  v_existing record;
begin
  insert into public.orders (
    confirmation_token, idempotency_key, request_fingerprint, currency,
    subtotal_cents, shipping_cents, total_cents, delivery
  )
  values (
    p_confirmation_token, p_idempotency_key, p_request_fingerprint, p_currency,
    p_subtotal_cents, p_shipping_cents, p_total_cents, p_delivery
  )
  on conflict (idempotency_key) do nothing
  returning id, confirmation_token into v_order_id, v_token;

  if v_order_id is not null then
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

    return jsonb_build_object('status', 'created', 'confirmation_token', v_token);
  end if;

  -- The key already exists. Only hand back the order if this is the same
  -- request; otherwise disclose nothing at all.
  select confirmation_token, request_fingerprint
    into v_existing
  from public.orders
  where idempotency_key = p_idempotency_key;

  if v_existing.request_fingerprint is distinct from p_request_fingerprint then
    return jsonb_build_object('status', 'conflict');
  end if;

  return jsonb_build_object(
    'status', 'reused',
    'confirmation_token', v_existing.confirmation_token
  );
end;
$$;

revoke all on function public.create_demo_order_v2(
  text, text, text, text, integer, integer, integer, jsonb, jsonb
) from anon, authenticated;
