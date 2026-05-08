ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_billingcycle_check;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_billingcycle_check
  CHECK (billingcycle IN ('monthly', 'quarterly', 'yearly'));

ALTER TABLE subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_user_id_fkey;

ALTER TABLE subscriptions
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE subscriptions
  ADD CONSTRAINT subscriptions_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE OR REPLACE FUNCTION handle_subscription_renewal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.renewalDate < CURRENT_DATE AND NEW.status = 'active' AND NOT NEW.auto_renewed THEN
    NEW.last_renewed_at = now();
    NEW.auto_renewed = true;
    IF NEW.billingCycle = 'monthly' THEN
      NEW.renewalDate = CURRENT_DATE + INTERVAL '1 month';
    ELSIF NEW.billingCycle = 'quarterly' THEN
      NEW.renewalDate = CURRENT_DATE + INTERVAL '3 months';
    ELSE
      NEW.renewalDate = CURRENT_DATE + INTERVAL '1 year';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;

ALTER TABLE audit_logs
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;
