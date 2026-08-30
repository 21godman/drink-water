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
    '*/30 * * * *',
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

do $$
declare
  reminder_job_id bigint;
begin
  select jobid
  into reminder_job_id
  from cron.job
  where jobname = 'drink-water-send-reminders';

  if reminder_job_id is not null then
    perform cron.alter_job(
      job_id := reminder_job_id,
      schedule := '*/30 * * * *'
    );
  end if;
end;
$$;
