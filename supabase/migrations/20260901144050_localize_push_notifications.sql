alter table public.push_subscriptions
  add column language text not null default 'zh-TW'
  check (language in ('en', 'zh-TW', 'th'));

drop function public.register_push_subscription(uuid, text, text, text, bigint);

create function public.register_push_subscription(
  subscription_user_id uuid,
  subscription_endpoint text,
  subscription_p256dh text,
  subscription_auth text,
  subscription_expiration_time bigint default null,
  subscription_language text default 'zh-TW'
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

  if subscription_language not in ('en', 'zh-TW', 'th') then
    raise exception 'invalid_notification_language';
  end if;

  insert into public.push_subscriptions (
    user_id,
    endpoint,
    p256dh,
    auth,
    expiration_time,
    language
  )
  values (
    subscription_user_id,
    subscription_endpoint,
    subscription_p256dh,
    subscription_auth,
    subscription_expiration_time,
    subscription_language
  )
  on conflict (endpoint) do update
  set user_id = excluded.user_id,
      p256dh = excluded.p256dh,
      auth = excluded.auth,
      expiration_time = excluded.expiration_time,
      language = excluded.language,
      disabled_at = null,
      updated_at = now()
  returning id into subscription_id;

  return subscription_id;
end;
$$;

revoke all on function public.register_push_subscription(
  uuid, text, text, text, bigint, text
) from public, anon, authenticated;
grant execute on function public.register_push_subscription(
  uuid, text, text, text, bigint, text
) to service_role;

drop function public.claim_due_deliveries(timestamptz, integer);

create function public.claim_due_deliveries(
  claim_time timestamptz default now(),
  claim_limit integer default 100
)
returns table(
  delivery_id bigint,
  endpoint text,
  p256dh text,
  auth text,
  attempt_count smallint,
  language text
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
    scheduled_for,
    next_attempt_at
  )
  select
    advanced.user_id,
    subscriptions.id,
    advanced.scheduled_for,
    claim_time
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
    claimed.attempt_count,
    subscriptions.language
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
