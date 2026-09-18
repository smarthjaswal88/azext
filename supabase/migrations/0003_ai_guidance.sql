-- Spend controls and caching for DeepSeek-powered comparison guidance.
--
-- Three jobs:
--   1. a persistent global spend budget, so the total cost of this feature is
--      bounded across restarts and across server instances;
--   2. per-visitor rate limits;
--   3. a cache, so an identical comparison is never paid for twice.
--
-- Money is integer micro-dollars (1_000_000 = $1). Costs are ESTIMATED before
-- a call from the token ceiling, then reconciled against the usage the API
-- reports. See the limitations noted in README.md — this bounds spend, it does
-- not make a dollar figure a hard guarantee.
--
-- Access model matches the orders tables: RLS on, no policies, service role
-- only.

create extension if not exists "pgcrypto";

create table if not exists public.ai_budget (
  id            boolean primary key default true check (id),
  limit_micros  bigint      not null check (limit_micros >= 0),
  updated_at    timestamptz not null default now()
);

create table if not exists public.ai_usage (
  id                 uuid        primary key default gen_random_uuid(),
  created_at         timestamptz not null default now(),
  settled_at         timestamptz,
  -- 'reserved' while a call is in flight, then 'settled' or 'released'.
  state              text        not null default 'reserved'
                                 check (state in ('reserved', 'settled', 'released')),
  model              text        not null,
  -- Salted hash of the caller. No IP or user agent is stored.
  visitor_hash       text        not null,
  cache_key          text,
  estimate_micros    bigint      not null check (estimate_micros >= 0),
  actual_micros      bigint      check (actual_micros >= 0),
  prompt_tokens      integer,
  completion_tokens  integer,
  outcome            text
);

create index if not exists ai_usage_state_idx   on public.ai_usage(state);
create index if not exists ai_usage_visitor_idx on public.ai_usage(visitor_hash, created_at desc);

create table if not exists public.ai_guidance_cache (
  cache_key   text        primary key,
  model       text        not null,
  payload     jsonb       not null,
  created_at  timestamptz not null default now()
);

alter table public.ai_budget         enable row level security;
alter table public.ai_usage          enable row level security;
alter table public.ai_guidance_cache enable row level security;

revoke all on public.ai_budget         from anon, authenticated;
revoke all on public.ai_usage          from anon, authenticated;
revoke all on public.ai_guidance_cache from anon, authenticated;

-- Reserves headroom for one call, or explains why it cannot.
--
-- Committed spend is the sum of settled actuals plus the estimates of calls
-- still in flight, so two concurrent requests cannot both slip under the limit.
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
  v_id        uuid;
begin
  select limit_micros into v_limit from public.ai_budget where id;
  if v_limit is null then
    return jsonb_build_object('status', 'no_budget_configured');
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

-- Replaces the reservation with what the call actually cost. `released` is used
-- when no call was billed (a failure before the request reached the provider),
-- so the reservation stops counting against the budget.
create or replace function public.ai_settle_request(
  p_request_id       uuid,
  p_state            text,
  p_actual_micros    bigint,
  p_prompt_tokens    integer,
  p_completion_tokens integer,
  p_outcome          text
) returns void
language plpgsql
as $$
begin
  update public.ai_usage
     set state = p_state,
         actual_micros = p_actual_micros,
         prompt_tokens = p_prompt_tokens,
         completion_tokens = p_completion_tokens,
         outcome = p_outcome,
         settled_at = now()
   where id = p_request_id;
end;
$$;

create or replace function public.ai_budget_status()
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'limit_micros', (select limit_micros from public.ai_budget where id),
    'committed_micros', coalesce((
      select sum(case when state = 'settled' then coalesce(actual_micros, estimate_micros)
                      else estimate_micros end)
      from public.ai_usage where state <> 'released'
    ), 0)
  );
$$;

revoke all on function public.ai_begin_request(text, text, bigint, text, integer, integer)
  from anon, authenticated;
revoke all on function public.ai_settle_request(uuid, text, bigint, integer, integer, text)
  from anon, authenticated;
revoke all on function public.ai_budget_status() from anon, authenticated;

-- Set the cap. Change this value to raise or lower the ceiling; it is the only
-- thing standing between the feature and unbounded spend.
insert into public.ai_budget (id, limit_micros)
values (true, 5000000)  -- $5.00
on conflict (id) do nothing;
