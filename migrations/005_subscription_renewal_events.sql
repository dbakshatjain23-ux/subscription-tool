ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS auto_renew BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'paid';

ALTER TABLE subscriptions
  ADD COLUMN IF NOT EXISTS last_paid_at TIMESTAMP WITH TIME ZONE;

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

INSERT INTO app_settings (key, value)
VALUES ('renewal_grace_period_days', '7')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_payment_status_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_payment_status_check
  CHECK (payment_status IN ('paid', 'due', 'unpaid', 'skipped'));

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS valid_renewal_date;

DROP TRIGGER IF EXISTS subscription_auto_renewal ON subscriptions;
DROP FUNCTION IF EXISTS handle_subscription_renewal();

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS app_settings_admin_can_view ON app_settings;
CREATE POLICY app_settings_admin_can_view ON app_settings FOR SELECT
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS app_settings_admin_can_insert ON app_settings;
CREATE POLICY app_settings_admin_can_insert ON app_settings FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS app_settings_admin_can_update ON app_settings;
CREATE POLICY app_settings_admin_can_update ON app_settings FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP TRIGGER IF EXISTS update_app_settings_updated_at ON app_settings;
CREATE TRIGGER update_app_settings_updated_at BEFORE UPDATE ON app_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TABLE IF NOT EXISTS subscription_renewal_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  billingcycle TEXT NOT NULL CHECK (billingcycle IN ('monthly', 'quarterly', 'yearly')),
  amount NUMERIC NOT NULL CHECK (amount >= 0),
  due_date DATE NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('paid', 'due', 'unpaid', 'skipped', 'cancelled')),
  processed_at TIMESTAMP WITH TIME ZONE,
  processed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (subscription_id, due_date)
);

CREATE INDEX IF NOT EXISTS idx_subscription_renewal_events_subscription_id
  ON subscription_renewal_events(subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_renewal_events_due_date
  ON subscription_renewal_events(due_date);

CREATE INDEX IF NOT EXISTS idx_subscription_renewal_events_status
  ON subscription_renewal_events(status);

ALTER TABLE subscription_renewal_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS subscription_renewal_events_users_can_view ON subscription_renewal_events;
CREATE POLICY subscription_renewal_events_users_can_view ON subscription_renewal_events FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM subscriptions
      WHERE subscriptions.id = subscription_renewal_events.subscription_id
        AND (
          subscriptions.user_id = auth.uid()
          OR EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin')
        )
    )
  );

DROP POLICY IF EXISTS subscription_renewal_events_admin_can_insert ON subscription_renewal_events;
CREATE POLICY subscription_renewal_events_admin_can_insert ON subscription_renewal_events FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP POLICY IF EXISTS subscription_renewal_events_admin_can_update ON subscription_renewal_events;
CREATE POLICY subscription_renewal_events_admin_can_update ON subscription_renewal_events FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE profiles.id = auth.uid() AND profiles.role = 'admin'));

DROP TRIGGER IF EXISTS update_subscription_renewal_events_updated_at ON subscription_renewal_events;
CREATE TRIGGER update_subscription_renewal_events_updated_at BEFORE UPDATE ON subscription_renewal_events
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE FUNCTION advance_subscription_renewal_date(input_date DATE, input_billingcycle TEXT)
RETURNS DATE AS $$
BEGIN
  IF input_billingcycle = 'monthly' THEN
    RETURN (input_date + INTERVAL '1 month')::DATE;
  ELSIF input_billingcycle = 'quarterly' THEN
    RETURN (input_date + INTERVAL '3 months')::DATE;
  ELSIF input_billingcycle = 'yearly' THEN
    RETURN (input_date + INTERVAL '1 year')::DATE;
  END IF;

  RAISE EXCEPTION 'Unsupported billing cycle: %', input_billingcycle;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION process_due_subscription_renewals(run_date DATE DEFAULT CURRENT_DATE)
RETURNS INTEGER AS $$
DECLARE
  subscription_record RECORD;
  due_date_cursor DATE;
  processed_count INTEGER := 0;
  grace_period_setting TEXT := '7';
  grace_period_days INTEGER := 7;
  grace_never_expires BOOLEAN := false;
  waiting_for_review BOOLEAN := false;
BEGIN
  SELECT value INTO grace_period_setting
  FROM app_settings
  WHERE key = 'renewal_grace_period_days';

  grace_period_setting := COALESCE(grace_period_setting, '7');
  grace_never_expires := lower(grace_period_setting) = 'never';

  IF NOT grace_never_expires THEN
    IF grace_period_setting ~ '^\d+$' THEN
      grace_period_days := GREATEST(0, grace_period_setting::INTEGER);
    ELSE
      grace_period_days := 7;
    END IF;
  END IF;

  FOR subscription_record IN
    SELECT id, cost, billingcycle, renewaldate, auto_renew
    FROM subscriptions
    WHERE status = 'active'
      AND renewaldate <= run_date
  LOOP
    due_date_cursor := subscription_record.renewaldate;
    waiting_for_review := false;

    IF subscription_record.auto_renew THEN
      WHILE due_date_cursor <= run_date LOOP
        IF grace_never_expires OR run_date <= due_date_cursor + grace_period_days THEN
          INSERT INTO subscription_renewal_events (
            subscription_id,
            billingcycle,
            amount,
            due_date,
            status,
            notes
          )
          VALUES (
            subscription_record.id,
            subscription_record.billingcycle,
            subscription_record.cost,
            due_date_cursor,
            'due',
            'Within renewal grace period; awaiting admin review.'
          )
          ON CONFLICT (subscription_id, due_date)
          DO NOTHING;

          UPDATE subscriptions
          SET
            renewaldate = due_date_cursor,
            payment_status = 'due'
          WHERE id = subscription_record.id;

          waiting_for_review := true;
          EXIT;
        END IF;

        INSERT INTO subscription_renewal_events (
          subscription_id,
          billingcycle,
          amount,
          due_date,
          status,
          processed_at,
          notes
        )
        VALUES (
          subscription_record.id,
          subscription_record.billingcycle,
          subscription_record.cost,
          due_date_cursor,
          'paid',
          now(),
          'Marked paid after renewal grace period.'
        )
        ON CONFLICT (subscription_id, due_date)
        DO UPDATE SET
          status = EXCLUDED.status,
          processed_at = EXCLUDED.processed_at,
          notes = EXCLUDED.notes,
          updated_at = now();

        processed_count := processed_count + 1;
        due_date_cursor := advance_subscription_renewal_date(due_date_cursor, subscription_record.billingcycle);
      END LOOP;

      IF NOT waiting_for_review THEN
        UPDATE subscriptions
        SET
          renewaldate = due_date_cursor,
          payment_status = 'paid',
          last_renewed_at = now(),
          last_paid_at = now(),
          auto_renewed = true
        WHERE id = subscription_record.id;
      END IF;
    ELSE
      INSERT INTO subscription_renewal_events (
        subscription_id,
        billingcycle,
        amount,
        due_date,
        status,
        notes
      )
      VALUES (
        subscription_record.id,
        subscription_record.billingcycle,
        subscription_record.cost,
        due_date_cursor,
        'due',
        'Auto renew is off; awaiting admin review.'
      )
      ON CONFLICT (subscription_id, due_date)
      DO NOTHING;

      UPDATE subscriptions
      SET payment_status = 'due'
      WHERE id = subscription_record.id
        AND payment_status = 'paid';
    END IF;
  END LOOP;

  RETURN processed_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION process_due_subscription_renewals(DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION process_due_subscription_renewals(DATE) FROM anon;
REVOKE ALL ON FUNCTION process_due_subscription_renewals(DATE) FROM authenticated;
