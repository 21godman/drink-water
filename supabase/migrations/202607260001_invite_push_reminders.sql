create extension if not exists pgcrypto with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;
create extension if not exists supabase_vault with schema vault;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  joined_at timestamptz not null default now(),
  revoked_at timestamptz
);

create unique index members_one_active_owner
  on public.members ((role))
  where role = 'owner' and revoked_at is null;

create table public.invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash bytea not null unique,
  grants_role text not null check (grants_role in ('owner', 'member')),
  created_by uuid references public.members(user_id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_by uuid references auth.users(id) on delete set null,
  redeemed_at timestamptz,
  check (expires_at > created_at),
  check (
    (redeemed_by is null and redeemed_at is null)
    or (redeemed_by is not null and redeemed_at is not null)
  )
);

create table public.invite_redemption_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  window_started_at timestamptz not null default now(),
  failure_count integer not null default 0 check (failure_count >= 0)
);

create table public.reminder_preferences (
  user_id uuid primary key references public.members(user_id) on delete cascade,
  enabled boolean not null default false,
  start_time time not null default '07:00',
  end_time time not null default '23:00',
  interval_minutes smallint not null default 60
    check (interval_minutes in (30, 60, 90)),
  time_zone text not null,
  next_reminder_at timestamptz,
  updated_at timestamptz not null default now(),
  check (start_time < end_time)
);

create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.members(user_id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  expiration_time bigint,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  disabled_at timestamptz
);

create index push_subscriptions_active_user
  on public.push_subscriptions (user_id)
  where disabled_at is null;

create table public.notification_deliveries (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.members(user_id) on delete cascade,
  subscription_id uuid not null references public.push_subscriptions(id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count smallint not null default 0 check (attempt_count >= 0),
  next_attempt_at timestamptz not null default now(),
  locked_at timestamptz,
  response_status integer,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (subscription_id, scheduled_for)
);

create index notification_deliveries_pending
  on public.notification_deliveries (next_attempt_at, created_at)
  where status in ('pending', 'processing');

alter table public.members enable row level security;
alter table public.invite_codes enable row level security;
alter table public.invite_redemption_limits enable row level security;
alter table public.reminder_preferences enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_deliveries enable row level security;

revoke all on public.invite_codes from anon, authenticated;
revoke all on public.invite_redemption_limits from anon, authenticated;
revoke all on public.notification_deliveries from anon, authenticated;
grant select on public.members to authenticated;
grant select on public.reminder_preferences to authenticated;
grant select on public.push_subscriptions to authenticated;

create or replace function private.is_active_member(check_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members
    where user_id = check_user_id
      and revoked_at is null
  );
$$;

revoke all on function private.is_active_member(uuid) from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.is_active_member(uuid) to authenticated;

create policy "Members read their active membership"
  on public.members
  for select
  to authenticated
  using (user_id = (select auth.uid()) and revoked_at is null);

create policy "Members read their reminder preferences"
  on public.reminder_preferences
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_active_member((select auth.uid()))
  );

create policy "Members read their push subscriptions"
  on public.push_subscriptions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    and private.is_active_member((select auth.uid()))
  );

create or replace function private.new_plain_invite_code()
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  raw_code text := upper(encode(extensions.gen_random_bytes(10), 'hex'));
begin
  return concat(
    substr(raw_code, 1, 4), '-',
    substr(raw_code, 5, 4), '-',
    substr(raw_code, 9, 4), '-',
    substr(raw_code, 13, 4), '-',
    substr(raw_code, 17, 4)
  );
end;
$$;

revoke all on function private.new_plain_invite_code() from public, anon, authenticated;

create or replace function private.normalized_invite_hash(invite_code text)
returns bytea
language sql
immutable
security definer
set search_path = ''
as $$
  select extensions.digest(
    upper(regexp_replace(coalesce(invite_code, ''), '[^0-9A-Fa-f]', '', 'g')),
    'sha256'
  );
$$;

revoke all on function private.normalized_invite_hash(text) from public, anon, authenticated;

create or replace function private.insert_invite(
  invite_role text,
  creator uuid default null
)
returns table(code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  plain_code text;
  expiry timestamptz := now() + interval '24 hours';
begin
  if invite_role not in ('owner', 'member') then
    raise exception 'invalid_invite_role';
  end if;

  loop
    plain_code := private.new_plain_invite_code();
    begin
      insert into public.invite_codes (
        code_hash,
        grants_role,
        created_by,
        expires_at
      )
      values (
        private.normalized_invite_hash(plain_code),
        invite_role,
        creator,
        expiry
      );
      exit;
    exception when unique_violation then
      -- Extremely unlikely random collision; generate another code.
    end;
  end loop;

  return query select plain_code, expiry;
end;
$$;

revoke all on function private.insert_invite(text, uuid) from public, anon, authenticated;

create or replace function private.bootstrap_owner_invite()
returns table(code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.members
    where role = 'owner' and revoked_at is null
  ) or exists (
    select 1 from public.invite_codes codes
    where codes.grants_role = 'owner'
      and codes.redeemed_at is null
      and codes.expires_at > now()
  ) then
    raise exception 'active_owner_or_invite_exists';
  end if;

  return query select * from private.insert_invite('owner', null);
end;
$$;

create or replace function private.recover_owner_invite()
returns table(code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.reminder_preferences
  set enabled = false,
      next_reminder_at = null,
      updated_at = now()
  where user_id in (
    select user_id from public.members
    where role = 'owner' and revoked_at is null
  );

  update public.push_subscriptions
  set disabled_at = now(),
      updated_at = now()
  where user_id in (
    select user_id from public.members
    where role = 'owner' and revoked_at is null
  ) and disabled_at is null;

  update public.members
  set revoked_at = now()
  where role = 'owner' and revoked_at is null;

  update public.invite_codes codes
  set expires_at = now()
  where codes.grants_role = 'owner'
    and codes.redeemed_at is null
    and codes.expires_at > now();

  return query select * from private.insert_invite('owner', null);
end;
$$;

revoke all on function private.bootstrap_owner_invite() from public, anon, authenticated, service_role;
revoke all on function private.recover_owner_invite() from public, anon, authenticated, service_role;

create or replace function public.redeem_invite(
  redeeming_user_id uuid,
  invite_code text
)
returns table(outcome text, member_role text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  limit_row public.invite_redemption_limits%rowtype;
  code_row public.invite_codes%rowtype;
begin
  if redeeming_user_id is null
    or not exists (select 1 from auth.users where id = redeeming_user_id)
  then
    raise exception 'invalid_user';
  end if;

  insert into public.invite_redemption_limits (user_id)
  values (redeeming_user_id)
  on conflict (user_id) do nothing;

  select *
  into limit_row
  from public.invite_redemption_limits
  where user_id = redeeming_user_id
  for update;

  if limit_row.window_started_at <= now() - interval '15 minutes' then
    update public.invite_redemption_limits
    set window_started_at = now(), failure_count = 0
    where user_id = redeeming_user_id
    returning * into limit_row;
  end if;

  if limit_row.failure_count >= 5 then
    return query select 'rate_limited'::text, null::text;
    return;
  end if;

  select *
  into code_row
  from public.invite_codes
  where code_hash = private.normalized_invite_hash(invite_code)
  for update;

  if not found
    or code_row.redeemed_at is not null
    or code_row.expires_at <= now()
  then
    update public.invite_redemption_limits
    set failure_count = failure_count + 1
    where user_id = redeeming_user_id;
    return query select 'invalid'::text, null::text;
    return;
  end if;

  if exists (
    select 1 from public.members
    where user_id = redeeming_user_id and revoked_at is null
  ) then
    return query
      select 'already_member'::text, role
      from public.members
      where user_id = redeeming_user_id;
    return;
  end if;

  update public.invite_codes
  set redeemed_by = redeeming_user_id,
      redeemed_at = now()
  where id = code_row.id;

  insert into public.members (user_id, role)
  values (redeeming_user_id, code_row.grants_role)
  on conflict (user_id) do update
  set role = excluded.role,
      joined_at = now(),
      revoked_at = null;

  update public.invite_redemption_limits
  set failure_count = 0,
      window_started_at = now()
  where user_id = redeeming_user_id;

  return query select 'redeemed'::text, code_row.grants_role;
end;
$$;

revoke all on function public.redeem_invite(uuid, text) from public, anon, authenticated;
grant execute on function public.redeem_invite(uuid, text) to service_role;

create or replace function public.create_member_invite(creating_user_id uuid)
returns table(code text, expires_at timestamptz)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.members
    where user_id = creating_user_id
      and role = 'owner'
      and revoked_at is null
  ) then
    raise exception 'owner_required';
  end if;

  return query
    select * from private.insert_invite('member', creating_user_id);
end;
$$;

revoke all on function public.create_member_invite(uuid) from public, anon, authenticated;
grant execute on function public.create_member_invite(uuid) to service_role;

create or replace function public.next_reminder_after(
  reminder_start time,
  reminder_end time,
  reminder_interval_minutes integer,
  reminder_time_zone text,
  after_time timestamptz
)
returns timestamptz
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  local_after timestamp;
  local_day date;
  next_slot timestamp;
begin
  if reminder_start >= reminder_end
    or reminder_interval_minutes not in (30, 60, 90)
  then
    raise exception 'invalid_reminder_schedule';
  end if;

  local_after := after_time at time zone reminder_time_zone;
  local_day := local_after::date;

  select min(slot)
  into next_slot
  from pg_catalog.generate_series(
    local_day + reminder_start,
    local_day + reminder_end - interval '1 second',
    pg_catalog.make_interval(mins => reminder_interval_minutes)
  ) as slot
  where slot > local_after;

  if next_slot is null then
    next_slot := (local_day + 1) + reminder_start;
  end if;

  return next_slot at time zone reminder_time_zone;
end;
$$;

revoke all on function public.next_reminder_after(time, time, integer, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.next_reminder_after(time, time, integer, text, timestamptz)
  to service_role;

create or replace function public.upsert_reminder_preferences(
  preference_user_id uuid,
  preference_enabled boolean,
  preference_start time,
  preference_end time,
  preference_interval_minutes integer,
  preference_time_zone text
)
returns public.reminder_preferences
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  saved public.reminder_preferences;
begin
  if not private.is_active_member(preference_user_id) then
    raise exception 'active_member_required';
  end if;

  perform now() at time zone preference_time_zone;

  insert into public.reminder_preferences (
    user_id,
    enabled,
    start_time,
    end_time,
    interval_minutes,
    time_zone,
    next_reminder_at,
    updated_at
  )
  values (
    preference_user_id,
    preference_enabled,
    preference_start,
    preference_end,
    preference_interval_minutes,
    preference_time_zone,
    case
      when preference_enabled then public.next_reminder_after(
        preference_start,
        preference_end,
        preference_interval_minutes,
        preference_time_zone,
        now()
      )
      else null
    end,
    now()
  )
  on conflict (user_id) do update
  set enabled = excluded.enabled,
      start_time = excluded.start_time,
      end_time = excluded.end_time,
      interval_minutes = excluded.interval_minutes,
      time_zone = excluded.time_zone,
      next_reminder_at = excluded.next_reminder_at,
      updated_at = now()
  returning * into saved;

  return saved;
end;
$$;

revoke all on function public.upsert_reminder_preferences(
  uuid, boolean, time, time, integer, text
) from public, anon, authenticated;
grant execute on function public.upsert_reminder_preferences(
  uuid, boolean, time, time, integer, text
) to service_role;

create or replace function public.register_push_subscription(
  subscription_user_id uuid,
  subscription_endpoint text,
  subscription_p256dh text,
  subscription_auth text,
  subscription_expiration_time bigint default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  subscription_id uuid;
begin
  if not private.is_active_member(subscription_user_id) then
    raise exception 'active_member_required';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    expiration_time
  )
  values (
    subscription_user_id,
    subscription_endpoint,
    subscription_p256dh,
    subscription_auth,
    subscription_expiration_time
  )
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      expiration_time = excluded.expiration_time,
      disabled_at = null,
      updated_at = now()
  returning id into subscription_id;

  return subscription_id;
end;
$$;

revoke all on function public.register_push_subscription(
  uuid, text, text, text, bigint
) from public, anon, authenticated;
grant execute on function public.register_push_subscription(
  uuid, text, text, text, bigint
) to service_role;

create or replace function public.disable_push_subscriptions(subscription_user_id uuid)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.push_subscriptions
  set disabled_at = now(), updated_at = now()
  where user_id = subscription_user_id and disabled_at is null;
$$;

revoke all on function public.disable_push_subscriptions(uuid)
  from public, anon, authenticated;
grant execute on function public.disable_push_subscriptions(uuid)
  to service_role;

create or replace function public.claim_due_deliveries(
  claim_time timestamptz default now(),
  claim_limit integer default 100
)
returns table(
  delivery_id bigint,
  endpoint text,
  p256dh text,
  auth text,
  attempt_count smallint
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  with due as (
    select preferences.user_id, preferences.next_reminder_at as scheduled_for
    from public.reminder_preferences preferences
    join public.members
      on members.user_id = preferences.user_id
      and members.revoked_at is null
    where preferences.enabled
      and preferences.next_reminder_at <= claim_time
    order by preferences.next_reminder_at
    for update of preferences skip locked
    limit claim_limit
  ),
  advanced as (
    update public.reminder_preferences preferences
    set next_reminder_at = public.next_reminder_after(
          preferences.start_time,
          preferences.end_time,
          preferences.interval_minutes,
          preferences.time_zone,
          greatest(claim_time, due.scheduled_for)
        ),
        updated_at = now()
    from due
    where preferences.user_id = due.user_id
    returning preferences.user_id, due.scheduled_for
  )
  insert into public.notification_deliveries (
    user_id,
    subscription_id,
    scheduled_for
  )
  select
    advanced.user_id,
    subscriptions.id,
    advanced.scheduled_for
  from advanced
  join public.push_subscriptions subscriptions
    on subscriptions.user_id = advanced.user_id
    and subscriptions.disabled_at is null
  where advanced.scheduled_for >= claim_time - interval '2 minutes'
  on conflict (subscription_id, scheduled_for) do nothing;

  return query
  with candidates as (
    select deliveries.id
    from public.notification_deliveries deliveries
    join public.push_subscriptions active_subscriptions
      on active_subscriptions.id = deliveries.subscription_id
      and active_subscriptions.disabled_at is null
    where (
      deliveries.status = 'pending'
      and deliveries.next_attempt_at <= claim_time
    ) or (
      deliveries.status = 'processing'
      and deliveries.locked_at <= claim_time - interval '5 minutes'
    )
    order by deliveries.created_at
    for update skip locked
    limit claim_limit
  ),
  claimed as (
    update public.notification_deliveries deliveries
    set status = 'processing',
        locked_at = claim_time,
        attempt_count = deliveries.attempt_count + 1
    from candidates
    where deliveries.id = candidates.id
    returning deliveries.*
  )
  select
    claimed.id,
    subscriptions.endpoint,
    subscriptions.p256dh,
    subscriptions.auth,
    claimed.attempt_count
  from claimed
  join public.push_subscriptions subscriptions
    on subscriptions.id = claimed.subscription_id
  where subscriptions.disabled_at is null;
end;
$$;

revoke all on function public.claim_due_deliveries(timestamptz, integer)
  from public, anon, authenticated;
grant execute on function public.claim_due_deliveries(timestamptz, integer)
  to service_role;

create or replace function public.finish_notification_delivery(
  finished_delivery_id bigint,
  delivery_success boolean,
  delivery_permanent_failure boolean,
  delivery_response_status integer default null,
  delivery_error_message text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  current_delivery public.notification_deliveries%rowtype;
begin
  select *
  into current_delivery
  from public.notification_deliveries
  where id = finished_delivery_id
  for update;

  if not found then
    return;
  end if;

  if delivery_success then
    update public.notification_deliveries
    set status = 'sent',
        sent_at = now(),
        locked_at = null,
        response_status = delivery_response_status,
        error_message = null
    where id = finished_delivery_id;
  elsif delivery_permanent_failure or current_delivery.attempt_count >= 3 then
    update public.notification_deliveries
    set status = 'failed',
        locked_at = null,
        response_status = delivery_response_status,
        error_message = left(delivery_error_message, 500)
    where id = finished_delivery_id;

    if delivery_permanent_failure then
      update public.push_subscriptions
      set disabled_at = now(), updated_at = now()
      where id = current_delivery.subscription_id;
    end if;
  else
    update public.notification_deliveries
    set status = 'pending',
        locked_at = null,
        next_attempt_at = now() + pg_catalog.make_interval(
          mins => greatest(1, current_delivery.attempt_count * 2)
        ),
        response_status = delivery_response_status,
        error_message = left(delivery_error_message, 500)
    where id = finished_delivery_id;
  end if;
end;
$$;

revoke all on function public.finish_notification_delivery(
  bigint, boolean, boolean, integer, text
) from public, anon, authenticated;
grant execute on function public.finish_notification_delivery(
  bigint, boolean, boolean, integer, text
) to service_role;

create or replace function private.configure_reminder_cron(
  project_url text,
  cron_secret text
)
returns bigint
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  scheduled_job_id bigint;
begin
  if project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then
    raise exception 'invalid_project_url';
  end if;
  if length(cron_secret) < 32 then
    raise exception 'cron_secret_too_short';
  end if;

  perform vault.create_secret(project_url, 'drink_water_project_url');
  perform vault.create_secret(cron_secret, 'drink_water_cron_secret');

  perform cron.unschedule(jobid)
  from cron.job
  where jobname = 'drink-water-send-reminders';

  select cron.schedule(
    'drink-water-send-reminders',
    '* * * * *',
    $job$
      select net.http_post(
        url := (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'drink_water_project_url'
          order by created_at desc
          limit 1
        ) || '/functions/v1/send-reminders',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'drink_water_cron_secret'
            order by created_at desc
            limit 1
          )
        ),
        body := '{}'::jsonb
      );
    $job$
  ) into scheduled_job_id;

  return scheduled_job_id;
end;
$$;

revoke all on function private.configure_reminder_cron(text, text)
  from public, anon, authenticated, service_role;
