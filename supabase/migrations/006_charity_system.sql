-- Migration 006: Charity System
-- Enhances charities table with categories, short_description and unique slugs,
-- ensures donations.stripe_payment_id uniqueness, creates public.get_charity_totals(),
-- and enforces minimum charity percent via database trigger.

-- 1. Update charities table
ALTER TABLE public.charities ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Community';
ALTER TABLE public.charities ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE public.charities ADD COLUMN IF NOT EXISTS slug TEXT;

-- Seed and update the 3 default verified charities with slugs, categories, and short descriptions
UPDATE public.charities
SET
  slug = 'hope-horizons',
  category = 'Children & Healthcare',
  short_description = 'Transforming pediatric healthcare & critical care access for children facing severe illnesses.'
WHERE name ILIKE '%Hope Horizons%' AND slug IS NULL;

UPDATE public.charities
SET
  slug = 'clean-oceans',
  category = 'Environment',
  short_description = 'Restoring marine ecosystems through plastic recovery and reef rehabilitation.'
WHERE name ILIKE '%Clean Oceans%' AND slug IS NULL;

UPDATE public.charities
SET
  slug = 'emergency-shelter',
  category = 'Community & Housing',
  short_description = 'Rapid crisis relief and sustainable housing for vulnerable families in urban centers.'
WHERE name ILIKE '%Emergency Shelter%' AND slug IS NULL;

-- Ensure any existing charity without a slug gets an auto-generated one
UPDATE public.charities
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL;

-- Enforce unique constraint on charities.slug
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'charities_slug_key'
  ) THEN
    ALTER TABLE public.charities ADD CONSTRAINT charities_slug_key UNIQUE (slug);
  END IF;
END $$;

-- 2. Update donations table: ensure stripe_payment_id exists and is UNIQUE for idempotency
ALTER TABLE public.donations ADD COLUMN IF NOT EXISTS stripe_payment_id TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'donations_stripe_payment_id_key'
  ) THEN
    ALTER TABLE public.donations ADD CONSTRAINT donations_stripe_payment_id_key UNIQUE (stripe_payment_id);
  END IF;
END $$;

-- 3. SQL Function: public.get_charity_totals()
-- Aggregates real totals raised per charity from payments.charity_amount and donations.amount
CREATE OR REPLACE FUNCTION public.get_charity_totals()
RETURNS TABLE (
  charity_id UUID,
  total_raised NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH payment_sums AS (
    SELECT p.charity_id, COALESCE(SUM(p.charity_amount), 0) AS total_payments
    FROM public.payments p
    WHERE p.charity_id IS NOT NULL
    GROUP BY p.charity_id
  ),
  donation_sums AS (
    SELECT d.charity_id, COALESCE(SUM(d.amount), 0) AS total_donations
    FROM public.donations d
    WHERE d.charity_id IS NOT NULL
    GROUP BY d.charity_id
  ),
  all_c AS (
    SELECT id FROM public.charities
  )
  SELECT
    all_c.id AS charity_id,
    ROUND(COALESCE(ps.total_payments, 0) + COALESCE(ds.total_donations, 0), 2) AS total_raised
  FROM all_c
  LEFT JOIN payment_sums ps ON all_c.id = ps.charity_id
  LEFT JOIN donation_sums ds ON all_c.id = ds.charity_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_charity_totals() TO anon, authenticated;

-- 4. Database Trigger: Enforce minimum charity contribution percent
CREATE OR REPLACE FUNCTION public.check_charity_percent_min()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_pct NUMERIC;
BEGIN
  SELECT min_charity_percent INTO v_min_pct FROM public.platform_settings LIMIT 1;
  IF v_min_pct IS NULL THEN
    v_min_pct := 10;
  END IF;

  IF NEW.charity_percent < v_min_pct THEN
    RAISE EXCEPTION 'Charity contribution percent cannot be less than % percent', v_min_pct;
  END IF;

  IF NEW.charity_percent > 100 THEN
    RAISE EXCEPTION 'Charity contribution percent cannot exceed 100 percent';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_charity_percent ON public.profiles;
CREATE TRIGGER trigger_check_charity_percent
  BEFORE INSERT OR UPDATE OF charity_percent ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_charity_percent_min();

-- 5. Seed sample charity events including charity golf days
DO $$
DECLARE
  v_hope_id UUID;
  v_ocean_id UUID;
BEGIN
  SELECT id INTO v_hope_id FROM public.charities WHERE slug = 'hope-horizons' LIMIT 1;
  SELECT id INTO v_ocean_id FROM public.charities WHERE slug = 'clean-oceans' LIMIT 1;

  IF v_hope_id IS NOT NULL THEN
    INSERT INTO public.charity_events (charity_id, title, event_date, location, description)
    VALUES
      (
        v_hope_id,
        'Annual Digital Heroes Charity Golf Classic',
        now() + interval '14 days',
        'Wentworth Golf Club, Surrey',
        '18-hole Stableford tournament and evening charity dinner supporting pediatric intensive care programs.'
      )
    ON CONFLICT DO NOTHING;
  END IF;

  IF v_ocean_id IS NOT NULL THEN
    INSERT INTO public.charity_events (charity_id, title, event_date, location, description)
    VALUES
      (
        v_ocean_id,
        'Coastal Links Charity Pro-Am Invitational',
        now() + interval '30 days',
        'Royal St George''s, Kent',
        'Competitive links golf tournament and marine habitat conservation gala dinner.'
      )
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 6. Update handle_new_user() trigger function to persist charity_id and charity_percent
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charity_id UUID;
  v_charity_pct NUMERIC;
BEGIN
  IF new.raw_user_meta_data->>'charity_id' IS NOT NULL THEN
    BEGIN
      v_charity_id := (new.raw_user_meta_data->>'charity_id')::UUID;
    EXCEPTION WHEN OTHERS THEN
      v_charity_id := NULL;
    END;
  END IF;

  IF new.raw_user_meta_data->>'charity_percent' IS NOT NULL THEN
    BEGIN
      v_charity_pct := (new.raw_user_meta_data->>'charity_percent')::NUMERIC;
    EXCEPTION WHEN OTHERS THEN
      v_charity_pct := 10;
    END;
  ELSE
    v_charity_pct := 10;
  END IF;

  INSERT INTO public.profiles (id, email, full_name, role, charity_id, charity_percent)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    COALESCE(new.raw_user_meta_data->>'role', 'member'),
    v_charity_id,
    GREATEST(10, COALESCE(v_charity_pct, 10))
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = EXCLUDED.email,
    full_name = EXCLUDED.full_name,
    charity_id = COALESCE(EXCLUDED.charity_id, public.profiles.charity_id),
    charity_percent = COALESCE(EXCLUDED.charity_percent, public.profiles.charity_percent);

  RETURN new;
END;
$$;

