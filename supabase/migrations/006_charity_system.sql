-- Migration 006: Charity System
-- Enhances charities table with categories, short_description and unique slugs,
-- ensures donations.stripe_payment_id uniqueness, creates public.get_charity_totals(),
-- seeds 6 distinct active charities with upcoming events, and enforces minimum charity percent via database trigger.

-- 1. Update charities table structure
ALTER TABLE public.charities ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Community';
ALTER TABLE public.charities ADD COLUMN IF NOT EXISTS short_description TEXT;
ALTER TABLE public.charities ADD COLUMN IF NOT EXISTS slug TEXT;

-- Seed and update the 3 default verified charities with slugs, categories, and short descriptions
UPDATE public.charities
SET
  slug = 'hope-horizons',
  category = 'Children & Healthcare',
  short_description = 'Transforming pediatric healthcare & critical care access for children facing severe illnesses.'
WHERE name ILIKE '%Hope Horizons%' AND (slug IS NULL OR slug = '');

UPDATE public.charities
SET
  slug = 'clean-oceans',
  category = 'Environment',
  short_description = 'Restoring marine ecosystems through plastic recovery and reef rehabilitation.'
WHERE name ILIKE '%Clean Oceans%' AND (slug IS NULL OR slug = '');

UPDATE public.charities
SET
  slug = 'emergency-shelter',
  category = 'Community & Housing',
  short_description = 'Rapid crisis relief and sustainable housing for vulnerable families in urban centers.'
WHERE name ILIKE '%Emergency Shelter%' AND (slug IS NULL OR slug = '');

-- Seed 3 additional charities so there are 6 distinct active causes across diverse categories
INSERT INTO public.charities (name, slug, category, tagline, description, short_description, is_active, is_featured)
SELECT
  'Veterans Support Network',
  'veterans-support',
  'Veterans & Military',
  'Dedicated rehabilitation and housing support for armed forces heroes',
  'Providing specialized mental healthcare, accessible transitional housing, and career training for injured veterans transitioning into civilian life.',
  'Comprehensive housing, mental health, and career rehabilitation for military veterans.',
  true,
  false
WHERE NOT EXISTS (SELECT 1 FROM public.charities WHERE slug = 'veterans-support');

INSERT INTO public.charities (name, slug, category, tagline, description, short_description, is_active, is_featured)
SELECT
  'Youth Education & Golf Trust',
  'youth-education-trust',
  'Education & Youth',
  'Empowering underprivileged youth through STEM education and junior golf',
  'Funding academic scholarships, technology access, and grassroots junior golf programs to inspire resilience, character, and lifelong opportunities.',
  'STEM scholarships and grassroots youth sports programs for disadvantaged children.',
  true,
  false
WHERE NOT EXISTS (SELECT 1 FROM public.charities WHERE slug = 'youth-education-trust');

INSERT INTO public.charities (name, slug, category, tagline, description, short_description, is_active, is_featured)
SELECT
  'Green Canopy National Forests',
  'green-canopy-forests',
  'Conservation',
  'Reforesting native UK woodlands and protecting wildlife habitats',
  'Restoring ancient native woodlands, planting indigenous trees, and creating natural green corridors to safeguard endangered British wildlife.',
  'Restoring indigenous British forests and protecting native woodland biodiversity.',
  true,
  false
WHERE NOT EXISTS (SELECT 1 FROM public.charities WHERE slug = 'green-canopy-forests');

-- Ensure any existing charity without a slug gets an auto-generated one
UPDATE public.charities
SET slug = lower(regexp_replace(name, '[^a-zA-Z0-9]+', '-', 'g'))
WHERE slug IS NULL OR slug = '';

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
-- Only fires when charity_percent is inserted or changed; defaults safely so signup is never broken
CREATE OR REPLACE FUNCTION public.check_charity_percent_min()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_min_pct NUMERIC;
BEGIN
  -- Default to 10 if null
  IF NEW.charity_percent IS NULL THEN
    NEW.charity_percent := 10;
  END IF;

  -- Only enforce when charity_percent is inserted or changed
  IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND (OLD.charity_percent IS DISTINCT FROM NEW.charity_percent)) THEN
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_check_charity_percent ON public.profiles;
CREATE TRIGGER trigger_check_charity_percent
  BEFORE INSERT OR UPDATE OF charity_percent ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_charity_percent_min();

-- 5. Seed sample charity events including charity golf days across the charities
DO $$
DECLARE
  v_hope_id UUID;
  v_ocean_id UUID;
  v_vet_id UUID;
  v_youth_id UUID;
BEGIN
  SELECT id INTO v_hope_id FROM public.charities WHERE slug = 'hope-horizons' LIMIT 1;
  SELECT id INTO v_ocean_id FROM public.charities WHERE slug = 'clean-oceans' LIMIT 1;
  SELECT id INTO v_vet_id FROM public.charities WHERE slug = 'veterans-support' LIMIT 1;
  SELECT id INTO v_youth_id FROM public.charities WHERE slug = 'youth-education-trust' LIMIT 1;

  IF v_hope_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.charity_events WHERE charity_id = v_hope_id AND title ILIKE '%Charity Golf Classic%') THEN
    INSERT INTO public.charity_events (charity_id, title, event_date, location, description)
    VALUES (
      v_hope_id,
      'Annual Digital Heroes Charity Golf Classic',
      now() + interval '14 days',
      'Wentworth Golf Club, Surrey',
      '18-hole Stableford tournament and evening charity dinner supporting pediatric intensive care programs.'
    );
  END IF;

  IF v_ocean_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.charity_events WHERE charity_id = v_ocean_id AND title ILIKE '%Coastal Links%') THEN
    INSERT INTO public.charity_events (charity_id, title, event_date, location, description)
    VALUES (
      v_ocean_id,
      'Coastal Links Charity Pro-Am Invitational',
      now() + interval '30 days',
      'Royal St George''s, Kent',
      'Competitive links golf tournament and marine habitat conservation gala dinner.'
    );
  END IF;

  IF v_vet_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.charity_events WHERE charity_id = v_vet_id AND title ILIKE '%Veterans Charity Scramble%') THEN
    INSERT INTO public.charity_events (charity_id, title, event_date, location, description)
    VALUES (
      v_vet_id,
      'Heroes Fore Veterans Golf Scramble',
      now() + interval '42 days',
      'The Belfry, Sutton Coldfield',
      'Team scramble competition uniting golfers, veterans, and supporters for transitional housing funds.'
    );
  END IF;

  IF v_youth_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.charity_events WHERE charity_id = v_youth_id AND title ILIKE '%Junior Golf Masters%') THEN
    INSERT INTO public.charity_events (charity_id, title, event_date, location, description)
    VALUES (
      v_youth_id,
      'NextGen Junior Golf Masters & STEM Fair',
      now() + interval '24 days',
      'Centurion Club, St Albans',
      'Youth skills showcase, clinic with PGA professionals, and STEM scholarship awards banquet.'
    );
  END IF;
END $$;

-- 6. Update handle_new_user() trigger function to persist charity_id and charity_percent safely
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_charity_id UUID := NULL;
  v_charity_pct NUMERIC := 10;
  v_role TEXT := 'subscriber';
  v_meta_role TEXT;
  v_raw_charity TEXT;
BEGIN
  -- 1. Determine safe role (strictly 'subscriber' or 'admin', default 'subscriber')
  v_meta_role := lower(COALESCE(new.raw_user_meta_data->>'role', 'subscriber'));
  IF v_meta_role IN ('subscriber', 'admin') THEN
    v_role := v_meta_role;
  ELSE
    v_role := 'subscriber';
  END IF;

  -- 2. Validate charity_percent (must be between 10 and 100)
  IF new.raw_user_meta_data->>'charity_percent' IS NOT NULL THEN
    BEGIN
      v_charity_pct := (new.raw_user_meta_data->>'charity_percent')::NUMERIC;
      IF v_charity_pct < 10 THEN
        v_charity_pct := 10;
      ELSIF v_charity_pct > 100 THEN
        v_charity_pct := 100;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_charity_pct := 10;
    END;
  ELSE
    v_charity_pct := 10;
  END IF;

  -- 3. Validate charity_id: ensure it is a valid UUID AND actually exists in public.charities
  v_raw_charity := new.raw_user_meta_data->>'charity_id';
  IF v_raw_charity IS NOT NULL AND v_raw_charity <> '' THEN
    BEGIN
      SELECT id INTO v_charity_id
      FROM public.charities
      WHERE id = v_raw_charity::UUID
      LIMIT 1;
    EXCEPTION WHEN OTHERS THEN
      v_charity_id := NULL;
    END;
  END IF;

  -- If no valid charity was found from metadata, assign the first active charity
  IF v_charity_id IS NULL THEN
    SELECT id INTO v_charity_id
    FROM public.charities
    WHERE is_active = true
    ORDER BY is_featured DESC, name ASC
    LIMIT 1;
  END IF;

  -- 4. Safely insert or update profile inside an exception block so auth signup NEVER fails
  BEGIN
    INSERT INTO public.profiles (id, email, full_name, role, charity_id, charity_percent)
    VALUES (
      new.id,
      new.email,
      COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
      v_role,
      v_charity_id,
      v_charity_pct
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = EXCLUDED.full_name,
      role = COALESCE(public.profiles.role, EXCLUDED.role),
      charity_id = COALESCE(EXCLUDED.charity_id, public.profiles.charity_id),
      charity_percent = COALESCE(EXCLUDED.charity_percent, public.profiles.charity_percent);
  EXCEPTION WHEN OTHERS THEN
    -- Fallback minimal insert to ensure auth signup succeeds even if charity/role has unexpected issue
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
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'handle_new_user error: %', SQLERRM;
    END;
  END;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
