-- Lowers the default AI spend ceiling, and stops two identical concurrent
-- requests from both paying.
--
-- Additive and safe on top of 0003. It does not touch ai_usage: every existing
-- spend record is preserved, and nothing here resets, replenishes or forgives
-- spend. The ceiling is the only thing that changes.

-- ---------------------------------------------------------------------------
-- 1. Ceiling: $5.00 -> $0.50
-- ---------------------------------------------------------------------------
-- Only rewrites the value if it is still the untouched 0003 default. An
-- operator who has deliberately chosen their own ceiling keeps it.
update public.ai_budget
   set limit_micros = 500000,
       updated_at = now()
 where id
   and limit_micros = 5000000;

-- Fresh databases where 0003 somehow did not insert.
insert into public.ai_budget (id, limit_micros)
values (true, 500000)
on conflict (id) do nothing;

-- The supported way to change the ceiling. Deliberately the only write path:
-- there is no scheduled job, no top-up and no reset anywhere in this schema,
-- so a budget can only move when a human runs this.
--
--   select public.ai_set_budget_limit(2000000);  -- $2.00
--
create or replace function public.ai_set_budget_limit(p_limit_micros bigint)
returns jsonb
language plpgsql
as $$
begin
  if p_limit_micros < 0 then
    raise exception 'budget limit cannot be negative';
  end if;

  update public.ai_budget
     set limit_micros = p_limit_micros,
         updated_at = now()
   where id;

  return public.ai_budget_status();
end;
$$;

revoke all on function public.ai_set_budget_limit(bigint) from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Deduplicate concurrent identical requests
-- ---------------------------------------------------------------------------
-- The results cache stops a repeat of a question that has already been
-- answered. It does nothing for two identical questions asked at the same
-- moment: both miss the cache, both call the provider, both are billed.
--
-- This adds an in-flight check inside the same function that reserves budget,
-- so the check and the reservation happen in one statement and cannot
-- interleave. A reservation older than the window no longer blocks, so a
-- crashed request cannot wedge a cache key permanently.
create index if not exists ai_usage_cache_key_inflight_idx
  on public.ai_usage(cache_key, created_at desc)
  where state = 'reserved';

create or replace function public.ai_begin_request(
  p_visitor_hash    text,
  p_model           text,
  p_estimate_micros bigint,
  p_cache_key       text,
  p_max_per_hour    integer,
  p_max_per_day     integer
) returns jsonb
language plpgsql
as $$
declare
  v_limit     bigint;
  v_committed bigint;
  v_hour      integer;
  v_day       integer;
  v_inflight  integer;
  v_id        uuid;
begin
  select limit_micros into v_limit from public.ai_budget where id;
  if v_limit is null then
    return jsonb_build_object('status', 'no_budget_configured');
  end if;

  -- An identical question is already being paid for right now. Two minutes is
  -- comfortably longer than the 25-second request timeout, so a live request is
  -- always caught while an abandoned one stops blocking quickly.
  if p_cache_key is not null then
    select count(*) into v_inflight
    from public.ai_usage
    where cache_key = p_cache_key
      and state = 'reserved'
      and created_at > now() - interval '2 minutes';

    if v_inflight > 0 then
      return jsonb_build_object('status', 'duplicate_in_flight');
    end if;
  end if;

  select count(*) into v_hour
  from public.ai_usage
  where visitor_hash = p_visitor_hash
    and state <> 'released'
    and created_at > now() - interval '1 hour';

  if v_hour >= p_max_per_hour then
    return jsonb_build_object('status', 'rate_limited', 'scope', 'hour');
  end if;

  select count(*) into v_day
  from public.ai_usage
  where visitor_hash = p_visitor_hash
    and state <> 'released'
    and created_at > now() - interval '1 day';

  if v_day >= p_max_per_day then
    return jsonb_build_object('status', 'rate_limited', 'scope', 'day');
  end if;

  select coalesce(sum(
    case when state = 'settled' then coalesce(actual_micros, estimate_micros)
         else estimate_micros end
  ), 0)
    into v_committed
  from public.ai_usage
  where state <> 'released';

  if v_committed + p_estimate_micros > v_limit then
    return jsonb_build_object(
      'status', 'budget_exhausted',
      'committed_micros', v_committed,
      'limit_micros', v_limit
    );
  end if;

  insert into public.ai_usage (state, model, visitor_hash, cache_key, estimate_micros)
  values ('reserved', p_model, p_visitor_hash, p_cache_key, p_estimate_micros)
  returning id into v_id;

  return jsonb_build_object('status', 'ok', 'request_id', v_id);
end;
$$;

revoke all on function public.ai_begin_request(text, text, bigint, text, integer, integer)
  from anon, authenticated;
