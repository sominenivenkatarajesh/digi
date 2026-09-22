-- Migration 003: Core Platform Schema Alignment
-- Aligns profiles, subscriptions, platform_settings and creates scores, charity_events,
-- payments, draws, draw_simulations, draw_entries, winners, donations, triggers & storage.

-- 1. Helper Function: is_admin()
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;

-- 2. Update Profiles Table
-- Ensure columns full_name, role ('subscriber' | 'admin'), charity_id, charity_percent (default 10, check 10 to 100)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'subscriber';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS charity_id UUID REFERENCES public.charities(id) ON DELETE SET NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS charity_percent NUMERIC DEFAULT 10;

-- Update existing default role if it was 'member'
UPDATE public.profiles SET role = 'subscriber' WHERE role = 'member' OR role IS NULL;

-- Add check constraint on role and charity_percent safely
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check CHECK (role IN ('subscriber', 'admin'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_charity_percent_check'
  ) THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_charity_percent_check CHECK (charity_percent >= 10 AND charity_percent <= 100);
  END IF;
END $$;

-- 3. Update Subscriptions Table
-- Ensure plan, status ('active','inactive','cancelled','lapsed'), stripe_customer_id, stripe_subscription_id, current_period_start, current_period_end, cancel_at_period_end
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'monthly';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS cancel_at_period_end BOOLEAN DEFAULT false;

-- Update subscriptions status check constraint
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_status_check CHECK (status IN ('active', 'inactive', 'cancelled', 'lapsed'));

-- 4. Update Platform Settings Table
-- monthly_price, yearly_price, prize_pool_percent, min_charity_percent (default 10), currency (default 'gbp')
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS monthly_price NUMERIC DEFAULT 10;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS yearly_price NUMERIC DEFAULT 99;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS prize_pool_percent NUMERIC DEFAULT 45;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS min_charity_percent NUMERIC DEFAULT 10;
ALTER TABLE public.platform_settings ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'gbp';

-- Helper Function: has_active_subscription(uid)
CREATE OR REPLACE FUNCTION public.has_active_subscription(uid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = uid AND status = 'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO anon, authenticated;

-- 5. NEW Tables

-- Table: scores (Users enter their last 5 Stableford scores 1-45, one per date)
CREATE TABLE IF NOT EXISTS public.scores (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 1 AND score <= 45),
  played_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (user_id, played_on)
);

-- Table: charity_events
CREATE TABLE IF NOT EXISTS public.charity_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  charity_id UUID REFERENCES public.charities(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  event_date TIMESTAMPTZ NOT NULL,
  location TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table: payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE SET NULL,
  amount NUMERIC NOT NULL,
  stripe_invoice_id TEXT UNIQUE,
  pool_amount NUMERIC,
  charity_amount NUMERIC,
  charity_id UUID REFERENCES public.charities(id) ON DELETE SET NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table: draws
CREATE TABLE IF NOT EXISTS public.draws (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draw_month DATE NOT NULL,
  mode TEXT NOT NULL DEFAULT 'random' CHECK (mode IN ('random', 'algorithm')),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  winning_numbers INTEGER[],
  pool_total NUMERIC DEFAULT 0,
  tier5_pool NUMERIC DEFAULT 0,
  tier4_pool NUMERIC DEFAULT 0,
  tier3_pool NUMERIC DEFAULT 0,
  jackpot_carried_in NUMERIC DEFAULT 0,
  jackpot_rolled_over NUMERIC DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table: draw_simulations
CREATE TABLE IF NOT EXISTS public.draw_simulations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draw_id UUID REFERENCES public.draws(id) ON DELETE CASCADE NOT NULL,
  mode TEXT,
  winning_numbers INTEGER[],
  result_summary JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table: draw_entries (Updated schema)
CREATE TABLE IF NOT EXISTS public.draw_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draw_id UUID REFERENCES public.draws(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  scores_snapshot INTEGER[],
  match_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Ensure draw_entries has draw_id, scores_snapshot, and match_count if it previously existed
ALTER TABLE public.draw_entries ADD COLUMN IF NOT EXISTS draw_id UUID REFERENCES public.draws(id) ON DELETE CASCADE;
ALTER TABLE public.draw_entries ADD COLUMN IF NOT EXISTS scores_snapshot INTEGER[];
ALTER TABLE public.draw_entries ADD COLUMN IF NOT EXISTS match_count INTEGER DEFAULT 0;

-- Table: winners
CREATE TABLE IF NOT EXISTS public.winners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  draw_id UUID REFERENCES public.draws(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  tier TEXT NOT NULL CHECK (tier IN ('5', '4', '3')),
  prize_amount NUMERIC NOT NULL,
  proof_url TEXT,
  verification_status TEXT NOT NULL DEFAULT 'pending' CHECK (verification_status IN ('pending', 'approved', 'rejected')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid')),
  reviewed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Table: donations
CREATE TABLE IF NOT EXISTS public.donations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  charity_id UUID REFERENCES public.charities(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC NOT NULL,
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Trigger: Keep Only Latest 5 Scores Per User
CREATE OR REPLACE FUNCTION public.trim_user_scores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Delete all scores for this user except the 5 most recent by played_on (tie-break by created_at)
  DELETE FROM public.scores
  WHERE user_id = NEW.user_id
    AND id NOT IN (
      SELECT id
      FROM public.scores
      WHERE user_id = NEW.user_id
      ORDER BY played_on DESC, created_at DESC
      LIMIT 5
    );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_trim_user_scores ON public.scores;
CREATE TRIGGER trigger_trim_user_scores
  AFTER INSERT ON public.scores
  FOR EACH ROW
  EXECUTE FUNCTION public.trim_user_scores();

-- 7. Trigger: Update profiles without allowing role escalation
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Non-admin users cannot alter their own role
  IF NEW.role IS DISTINCT FROM OLD.role AND NOT public.is_admin() THEN
    NEW.role := OLD.role;
  END IF;
  NEW.updated_at := timezone('utc'::text, now());
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_protect_profile_role ON public.profiles;
CREATE TRIGGER trigger_protect_profile_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- 8. Enable Row Level Security on all tables
ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_simulations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.winners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;

-- 9. RLS Policies

-- Scores Policies
DROP POLICY IF EXISTS "Users can read own scores" ON public.scores;
CREATE POLICY "Users can read own scores"
  ON public.scores FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can insert own scores" ON public.scores;
CREATE POLICY "Users can insert own scores"
  ON public.scores FOR INSERT
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can update own scores" ON public.scores;
CREATE POLICY "Users can update own scores"
  ON public.scores FOR UPDATE
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can delete own scores" ON public.scores;
CREATE POLICY "Users can delete own scores"
  ON public.scores FOR DELETE
  USING (auth.uid() = user_id OR public.is_admin());

-- Charity Events Policies
DROP POLICY IF EXISTS "Anyone can read charity events" ON public.charity_events;
CREATE POLICY "Anyone can read charity events"
  ON public.charity_events FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Admin can manage charity events" ON public.charity_events;
CREATE POLICY "Admin can manage charity events"
  ON public.charity_events FOR ALL
  USING (public.is_admin());

-- Payments Policies
DROP POLICY IF EXISTS "Users can read own payments" ON public.payments;
CREATE POLICY "Users can read own payments"
  ON public.payments FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admin can manage payments" ON public.payments;
CREATE POLICY "Admin can manage payments"
  ON public.payments FOR ALL
  USING (public.is_admin());

-- Draws Policies
DROP POLICY IF EXISTS "Anyone can read published draws" ON public.draws;
CREATE POLICY "Anyone can read published draws"
  ON public.draws FOR SELECT
  USING (status = 'published' OR public.is_admin());

DROP POLICY IF EXISTS "Admin can manage draws" ON public.draws;
CREATE POLICY "Admin can manage draws"
  ON public.draws FOR ALL
  USING (public.is_admin());

-- Draw Simulations Policies
DROP POLICY IF EXISTS "Admin can manage simulations" ON public.draw_simulations;
CREATE POLICY "Admin can manage simulations"
  ON public.draw_simulations FOR ALL
  USING (public.is_admin());

-- Draw Entries Policies
DROP POLICY IF EXISTS "Users can read own draw entries" ON public.draw_entries;
CREATE POLICY "Users can read own draw entries"
  ON public.draw_entries FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admin can manage draw entries" ON public.draw_entries;
CREATE POLICY "Admin can manage draw entries"
  ON public.draw_entries FOR ALL
  USING (public.is_admin());

-- Winners Policies
DROP POLICY IF EXISTS "Users can read own winners records" ON public.winners;
CREATE POLICY "Users can read own winners records"
  ON public.winners FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Users can upload proof for own win" ON public.winners;
CREATE POLICY "Users can upload proof for own win"
  ON public.winners FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admin can manage winners" ON public.winners;
CREATE POLICY "Admin can manage winners"
  ON public.winners FOR ALL
  USING (public.is_admin());

-- Donations Policies
DROP POLICY IF EXISTS "Users can read own donations" ON public.donations;
CREATE POLICY "Users can read own donations"
  ON public.donations FOR SELECT
  USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "Admin can manage donations" ON public.donations;
CREATE POLICY "Admin can manage donations"
  ON public.donations FOR ALL
  USING (public.is_admin());

-- 10. Storage Buckets Setup & Policies
-- Create buckets if they don't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('winner-proofs', 'winner-proofs', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('charity-media', 'charity-media', true)
ON CONFLICT (id) DO NOTHING;

-- Storage Policies for "winner-proofs" (private, user folder isolated)
DROP POLICY IF EXISTS "Users can upload proof to own folder" ON storage.objects;
CREATE POLICY "Users can upload proof to own folder"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'winner-proofs' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users can read own proof" ON storage.objects;
CREATE POLICY "Users can read own proof"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'winner-proofs' AND
    ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "Admin has full access to winner-proofs" ON storage.objects;
CREATE POLICY "Admin has full access to winner-proofs"
  ON storage.objects FOR ALL
  USING (bucket_id = 'winner-proofs' AND public.is_admin());

-- Storage Policies for "charity-media" (public read, admin write)
DROP POLICY IF EXISTS "Public can view charity-media" ON storage.objects;
CREATE POLICY "Public can view charity-media"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'charity-media');

DROP POLICY IF EXISTS "Admin can manage charity-media" ON storage.objects;
CREATE POLICY "Admin can manage charity-media"
  ON storage.objects FOR ALL
  USING (bucket_id = 'charity-media' AND public.is_admin());

-- 11. Seed Charity Events
DO $$
DECLARE
  v_charity_id UUID;
BEGIN
  SELECT id INTO v_charity_id FROM public.charities LIMIT 1;
  IF v_charity_id IS NOT NULL THEN
    INSERT INTO public.charity_events (charity_id, title, event_date, location, description)
    VALUES
      (
        v_charity_id,
        'Annual Pediatric Health Gala',
        now() + interval '21 days',
        'St. James Hall, London',
        'Annual fundraising banquet highlighting major medical equipment installations funded by subscribers.'
      ),
      (
        v_charity_id,
        'Community 5K Fun Run & Family Walk',
        now() + interval '45 days',
        'Hyde Park, London',
        'Community athletic day raising awareness and direct support for children undergoing hospital care.'
      ),
      (
        v_charity_id,
        'Impact Presentation & Open Briefing',
        now() + interval '60 days',
        'Online Webinar & Stream',
        'Live briefing with foundation medical staff reviewing direct subscriber funding allocations.'
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
