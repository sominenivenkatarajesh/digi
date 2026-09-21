-- Phase 1 Migration: Initial Database Schema
-- Digital Heroes: Profiles, Charities, Subscriptions, Platform Settings, RLS & Triggers

-- 1. Create Profiles Table (links to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. Create Charities Table
CREATE TABLE IF NOT EXISTS public.charities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  tagline TEXT,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'Humanitarian',
  impact_metric TEXT,
  image_url TEXT,
  website_url TEXT,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Create Platform Settings Table
CREATE TABLE IF NOT EXISTS public.platform_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  monthly_price NUMERIC NOT NULL DEFAULT 10,
  yearly_price NUMERIC NOT NULL DEFAULT 99,
  currency TEXT NOT NULL DEFAULT '£',
  draw_day_of_month INTEGER NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Create Subscriptions Table
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  charity_id UUID REFERENCES public.charities(id) NOT NULL,
  plan_type TEXT NOT NULL DEFAULT 'monthly' CHECK (plan_type IN ('monthly', 'yearly')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Create Draw Entries Table
CREATE TABLE IF NOT EXISTS public.draw_entries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  subscription_id UUID REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  draw_month TEXT NOT NULL,
  ticket_numbers INTEGER[] NOT NULL DEFAULT '{7, 14, 21, 28, 35}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Enable Row Level Security (RLS) on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_entries ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Charities Policies
CREATE POLICY "Anyone can view active charities"
  ON public.charities FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage charities"
  ON public.charities FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Platform Settings Policies
CREATE POLICY "Anyone can view platform settings"
  ON public.platform_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update platform settings"
  ON public.platform_settings FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Subscriptions Policies
CREATE POLICY "Users can view their own subscriptions"
  ON public.subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions"
  ON public.subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions"
  ON public.subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- Draw Entries Policies
CREATE POLICY "Users can view their own draw entries"
  ON public.draw_entries FOR SELECT
  USING (auth.uid() = user_id);

-- 8. Auto-create Profile Trigger on Signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'subscriber'
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name;

  RETURN new;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'handle_new_user error: %', SQLERRM;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Seed Default Platform Settings
INSERT INTO public.platform_settings (monthly_price, yearly_price, currency, draw_day_of_month)
SELECT 10, 99, '£', 1
WHERE NOT EXISTS (SELECT 1 FROM public.platform_settings);

-- 10. Seed Verified Charities
INSERT INTO public.charities (name, tagline, description, category, impact_metric, website_url, is_featured, is_active)
VALUES
  (
    'Hope Horizons Children''s Foundation',
    'Transforming pediatric healthcare & critical care access',
    'Providing life-saving medical equipment, compassionate family support, and specialized pediatric care for children facing severe illnesses.',
    'Children & Healthcare',
    '100% of draw contributions directly fund life-saving hospital treatments and family assistance.',
    'https://example.org/hope-horizons',
    true,
    true
  ),
  (
    'Clean Oceans Global',
    'Restoring marine ecosystems through plastic recovery and reef rehabilitation',
    'Deploying cleanup barriers and ocean monitoring fleets to protect coastal waters and restore coral reefs across four continents.',
    'Environment',
    'Every monthly subscriber contribution funds 25kg of ocean plastic extraction.',
    'https://example.org/clean-oceans',
    false,
    true
  ),
  (
    'Emergency Shelter Coalition',
    'Rapid crisis relief and sustainable housing for vulnerable families',
    'Providing emergency heating, nutrition, and permanent rehousing programs for displaced families in urban centers.',
    'Community & Housing',
    'Supports over 120 family shelter nights each month.',
    'https://example.org/shelter-coalition',
    false,
    true
  )
ON CONFLICT DO NOTHING;
