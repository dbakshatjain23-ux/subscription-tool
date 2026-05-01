-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table to track user roles and metadata (linked to Supabase Auth users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  full_name TEXT,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  cost NUMERIC NOT NULL CHECK (cost >= 0),
  billingCycle TEXT NOT NULL CHECK (billingCycle IN ('monthly', 'yearly')),
  renewalDate DATE NOT NULL,
  team TEXT NOT NULL,
  owner TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active', 'cancelled')) DEFAULT 'active',
  notes TEXT,
  last_renewed_at TIMESTAMP WITH TIME ZONE,
  auto_renewed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT valid_renewal_date CHECK (renewalDate >= CURRENT_DATE)
);

-- Audit logs table to track all changes
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'USER_CREATED')),
  resource_type TEXT NOT NULL,
  resource_id UUID,
  old_values JSONB,
  new_values JSONB,
  ip_address TEXT,
  user_agent TEXT,
  status TEXT DEFAULT 'success',
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Session/cache table for tracking active sessions (optional, for security)
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_activity TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_renewal_date ON subscriptions(renewalDate);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_team ON subscriptions(team);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- Row Level Security (RLS) Policies

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS profiles_users_can_view_own ON profiles;
CREATE POLICY profiles_users_can_view_own ON profiles FOR SELECT
  USING (auth.uid() = id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS profiles_admin_can_insert ON profiles;
CREATE POLICY profiles_admin_can_insert ON profiles FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS profiles_admin_can_update ON profiles;
CREATE POLICY profiles_admin_can_update ON profiles FOR UPDATE
  USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Subscriptions policies
DROP POLICY IF EXISTS subscriptions_users_can_view_own ON subscriptions;
CREATE POLICY subscriptions_users_can_view_own ON subscriptions FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS subscriptions_users_can_create ON subscriptions;
CREATE POLICY subscriptions_users_can_create ON subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS subscriptions_users_can_update_own ON subscriptions;
CREATE POLICY subscriptions_users_can_update_own ON subscriptions FOR UPDATE
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

DROP POLICY IF EXISTS subscriptions_users_can_delete_own ON subscriptions;
CREATE POLICY subscriptions_users_can_delete_own ON subscriptions FOR DELETE
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Audit logs policies
DROP POLICY IF EXISTS audit_logs_users_can_view_own ON audit_logs;
CREATE POLICY audit_logs_users_can_view_own ON audit_logs FOR SELECT
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'));

-- Sessions policies
DROP POLICY IF EXISTS sessions_users_can_view_own ON sessions;
CREATE POLICY sessions_users_can_view_own ON sessions FOR SELECT
  USING (auth.uid() = user_id);

-- Functions and triggers

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers to update updated_at
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to handle subscription auto-renewal
CREATE OR REPLACE FUNCTION handle_subscription_renewal()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.renewalDate < CURRENT_DATE AND NEW.status = 'active' AND NOT NEW.auto_renewed THEN
    NEW.last_renewed_at = now();
    NEW.auto_renewed = true;
    -- Reset renewal date based on billing cycle
    IF NEW.billingCycle = 'monthly' THEN
      NEW.renewalDate = CURRENT_DATE + INTERVAL '1 month';
    ELSE
      NEW.renewalDate = CURRENT_DATE + INTERVAL '1 year';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS subscription_auto_renewal ON subscriptions;
CREATE TRIGGER subscription_auto_renewal BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION handle_subscription_renewal();

-- Function to create audit log on subscription changes
CREATE OR REPLACE FUNCTION log_subscription_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, new_values)
    VALUES (NEW.user_id, 'CREATE', 'subscription', NEW.id, row_to_json(NEW));
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
    VALUES (NEW.user_id, 'UPDATE', 'subscription', NEW.id, row_to_json(OLD), row_to_json(NEW));
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (user_id, action, resource_type, resource_id, old_values)
    VALUES (OLD.user_id, 'DELETE', 'subscription', OLD.id, row_to_json(OLD));
  END IF;
  RETURN NULL;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS audit_subscriptions ON subscriptions;
CREATE TRIGGER audit_subscriptions AFTER INSERT OR UPDATE OR DELETE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION log_subscription_changes();

-- Function to create profile on new user signup
CREATE OR REPLACE FUNCTION create_profile_for_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role, full_name)
  VALUES (NEW.id, NEW.email, 'user', NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER SET search_path = public, auth;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_profile_for_user();

-- Cleanup sessions older than 30 days
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM sessions WHERE expires_at < now() OR last_activity < now() - INTERVAL '30 days';
END;
$$ language 'plpgsql';
