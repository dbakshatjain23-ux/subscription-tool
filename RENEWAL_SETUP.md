# Renewal Processing Setup

This project uses a long-term renewal model:

- `subscriptions` stores the current state.
- `subscription_renewal_events` stores every paid, unpaid, skipped, due, or cancelled renewal cycle.
- `app_settings.renewal_grace_period_days` controls the current-cycle review window.
- `process_due_subscription_renewals()` opens and closes due active renewal cycles.

## Safe Migration

Apply migrations in order through the Supabase SQL editor or your normal migration workflow.

The renewal migration is non-destructive:

- Existing subscriptions are not deleted.
- Existing subscriptions receive `auto_renew = true`.
- Existing subscriptions receive `payment_status = 'paid'`.
- Existing renewal dates, owners, teams, costs, and notes are kept.
- The old renewal trigger is removed because renewal processing is now handled by the scheduled function.

## Manual Test

After applying `migrations/005_subscription_renewal_events.sql`, run:

```sql
select public.process_due_subscription_renewals(current_date);
```

The function returns the number of renewal cycles processed.

## Renewal Grace Period

The default grace period is 7 days.

During the grace period:

- the current cycle is recorded as `due`
- the subscription `payment_status` becomes `due`
- super admins can mark the current cycle paid, unpaid, skipped, cancelled, or move it to the next cycle
- the subscription does not advance automatically yet

After the grace period:

- the scheduler records the current cycle as `paid`
- the subscription `payment_status` becomes `paid`
- the subscription advances to the next renewal date

To change the grace period from SQL:

```sql
update app_settings
set value = '14'
where key = 'renewal_grace_period_days';
```

To keep the current cycle editable indefinitely:

```sql
update app_settings
set value = 'never'
where key = 'renewal_grace_period_days';
```

Admins can also change this from Settings in the app.

## Supabase Cron Schedule

Enable `pg_cron` if it is not already enabled:

```sql
create extension if not exists pg_cron with schema extensions;
```

Schedule the renewal processor once per day:

```sql
select cron.schedule(
  'process-due-subscription-renewals',
  '5 0 * * *',
  $$select public.process_due_subscription_renewals(current_date);$$
);
```

Check the job:

```sql
select jobid, jobname, schedule, active
from cron.job
where jobname = 'process-due-subscription-renewals';
```

Remove the job if needed:

```sql
select cron.unschedule('process-due-subscription-renewals');
```

## Runtime Behavior

When `auto_renew = true` and the renewal date is due but still inside the grace period:

- a `due` renewal event is recorded
- `payment_status` becomes `due`
- `renewaldate` stays on the current cycle

When `auto_renew = true` and the grace period has expired:

- a `paid` renewal event is recorded
- `payment_status` stays `paid`
- `last_paid_at` and `last_renewed_at` are updated
- `renewaldate` advances by the billing cycle

When `auto_renew = false` and the renewal date is due:

- a `due` renewal event is recorded
- `payment_status` becomes `due`
- `renewaldate` does not move

When an admin marks the current cycle unpaid:

- a renewal event is recorded as `unpaid`
- `payment_status` becomes `unpaid`
- `renewaldate` advances to the next cycle

When an admin skips a renewal:

- a renewal event is recorded as `skipped`
- `payment_status` becomes `skipped`
- `renewaldate` advances to the next cycle

Payment status changes are only accepted for the current cycle while it is inside the configured grace period, unless the grace period is set to `never`.

## Free Plan Notes

This setup uses the Supabase database and `pg_cron`. It does not require Supabase Edge Functions. On the Supabase Free plan, watch the included database size as renewal history grows.
