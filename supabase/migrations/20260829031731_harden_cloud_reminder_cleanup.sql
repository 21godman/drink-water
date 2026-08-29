create index if not exists invite_codes_created_by_idx
  on public.invite_codes (created_by)
  where created_by is not null;

create index if not exists invite_codes_redeemed_by_idx
  on public.invite_codes (redeemed_by)
  where redeemed_by is not null;

create index if not exists push_subscriptions_user_id_idx
  on public.push_subscriptions (user_id);

create index if not exists notification_deliveries_user_id_idx
  on public.notification_deliveries (user_id);

create or replace function public.disable_push_subscriptions(subscription_user_id uuid)
returns void
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
  where user_id = subscription_user_id;

  update public.push_subscriptions
  set disabled_at = now(),
      updated_at = now()
  where user_id = subscription_user_id
    and disabled_at is null;
end;
$$;

revoke all on function public.disable_push_subscriptions(uuid)
  from public, anon, authenticated;
grant execute on function public.disable_push_subscriptions(uuid)
  to service_role;

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
  project_url_secret_id uuid;
  cron_secret_id uuid;
begin
  if project_url !~ '^https://[a-z0-9-]+\.supabase\.co$' then
    raise exception 'invalid_project_url';
  end if;
  if length(cron_secret) < 32 then
    raise exception 'cron_secret_too_short';
  end if;

  select id
  into project_url_secret_id
  from vault.secrets
  where name = 'drink_water_project_url';

  if project_url_secret_id is null then
    perform vault.create_secret(project_url, 'drink_water_project_url');
  else
    perform vault.update_secret(project_url_secret_id, project_url);
  end if;

  select id
  into cron_secret_id
  from vault.secrets
  where name = 'drink_water_cron_secret';

  if cron_secret_id is null then
    perform vault.create_secret(cron_secret, 'drink_water_cron_secret');
  else
    perform vault.update_secret(cron_secret_id, cron_secret);
  end if;

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
        ) || '/functions/v1/send-reminders',
        headers := jsonb_build_object(
          'content-type', 'application/json',
          'x-cron-secret', (
            select decrypted_secret
            from vault.decrypted_secrets
            where name = 'drink_water_cron_secret'
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
