-- Migration 009: Admin Dashboard, Overrides, Single-Featured Trigger & Aggregate Reports
-- Complete admin reporting, role tampering safeguards, and subscription overrides

-- 1. Add admin subscription override audit columns to public.subscriptions
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS admin_override_note TEXT;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS admin_overridden_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS admin_overridden_at TIMESTAMPTZ;

-- 2. Database-level Protection for profiles.role
-- Step 2a: Revoke column update on role from authenticated users
REVOKE UPDATE (role) ON public.profiles FROM authenticated;

-- Step 2b: Database trigger strictly blocking non-service-role changes to profiles.role
CREATE OR REPLACE FUNCTION public.protect_profile_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF current_user != 'service_role' THEN
      RAISE EXCEPTION 'Unauthorized: Modifying user role is strictly restricted to database administrator.'
        USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_profile_role ON public.profiles;
CREATE TRIGGER tr_protect_profile_role
  BEFORE UPDATE OF role ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_role();

-- 3. Database Trigger: Single Featured Charity Enforcement
-- When any charity is set to is_featured = true, automatically unset all other charities
-- Guards with WHEN clause on distinct change and only updates currently true rows to prevent recursion
CREATE OR REPLACE FUNCTION public.maintain_single_featured_charity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.charities
  SET is_featured = false
  WHERE id <> NEW.id AND is_featured = true;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_single_featured_charity ON public.charities;
CREATE TRIGGER tr_single_featured_charity
  AFTER INSERT OR UPDATE OF is_featured ON public.charities
  FOR EACH ROW
  WHEN (NEW.is_featured = true AND (TG_OP = 'INSERT' OR NEW.is_featured IS DISTINCT FROM OLD.is_featured))
  EXECUTE FUNCTION public.maintain_single_featured_charity();

-- 4. Unified Admin Reports Aggregate Function
-- Computes real aggregated statistics in Postgres without loading entire tables into JS
CREATE OR REPLACE FUNCTION public.get_admin_reports()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
  v_total_users BIGINT;
  v_active_subscribers BIGINT;
  v_monthly_subscribers BIGINT;
  v_yearly_subscribers BIGINT;
  v_total_prize_pool NUMERIC;
  v_jackpot_pending NUMERIC;
  v_published_draws_count BIGINT;
  v_tier5_winners BIGINT;
  v_tier4_winners BIGINT;
  v_tier3_winners BIGINT;
  v_total_awarded NUMERIC;
  v_total_paid NUMERIC;
  v_total_pending_payout NUMERIC;
  v_charity_breakdown JSONB;
  v_total_charity_impact NUMERIC;
BEGIN
  -- Security check: Require admin or service role
  IF NOT public.is_admin() AND current_user != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: Administrator privileges required.'
      USING ERRCODE = '42501';
  END IF;

  -- 1. User & Subscriber Counts
  SELECT COUNT(*) INTO v_total_users FROM public.profiles;
  SELECT COUNT(*) INTO v_active_subscribers FROM public.subscriptions WHERE status = 'active';
  SELECT COUNT(*) INTO v_monthly_subscribers FROM public.subscriptions WHERE status = 'active' AND plan = 'monthly';
  SELECT COUNT(*) INTO v_yearly_subscribers FROM public.subscriptions WHERE status = 'active' AND plan = 'yearly';

  -- 2. Prize Pool Stats
  SELECT COALESCE(SUM(pool_total), 0) INTO v_total_prize_pool FROM public.draws WHERE status = 'published';

  -- Get latest published draw rollover if any
  SELECT COALESCE(jackpot_rolled_over, 0) INTO v_jackpot_pending
  FROM public.draws
  WHERE status = 'published'
  ORDER BY draw_month DESC
  LIMIT 1;
  IF v_jackpot_pending IS NULL THEN
    v_jackpot_pending := 0;
  END IF;

  -- 3. Draw & Winner Stats
  SELECT COUNT(*) INTO v_published_draws_count FROM public.draws WHERE status = 'published';
  SELECT COUNT(*) INTO v_tier5_winners FROM public.winners WHERE tier = '5';
  SELECT COUNT(*) INTO v_tier4_winners FROM public.winners WHERE tier = '4';
  SELECT COUNT(*) INTO v_tier3_winners FROM public.winners WHERE tier = '3';
  SELECT COALESCE(SUM(prize_amount), 0) INTO v_total_awarded FROM public.winners;
  SELECT COALESCE(SUM(prize_amount), 0) INTO v_total_paid FROM public.winners WHERE payment_status = 'paid';
  SELECT COALESCE(SUM(prize_amount), 0) INTO v_total_pending_payout FROM public.winners WHERE payment_status = 'pending';

  -- 4. Charity Contribution Breakdown (Donations + Payments charity_amount)
  WITH charity_donations AS (
    SELECT
      c.id AS charity_id,
      c.name AS charity_name,
      c.slug AS charity_slug,
      c.category AS charity_category,
      c.is_active,
      COALESCE(SUM(d.amount), 0) AS total_donations
    FROM public.charities c
    LEFT JOIN public.donations d ON d.charity_id = c.id
    GROUP BY c.id, c.name, c.slug, c.category, c.is_active
  ),
  charity_payments AS (
    SELECT
      p.charity_id,
      COALESCE(SUM(p.charity_amount), 0) AS total_subscription_contributions
    FROM public.payments p
    WHERE p.charity_id IS NOT NULL
    GROUP BY p.charity_id
  )
  SELECT
    COALESCE(jsonb_agg(
      jsonb_build_object(
        'id', cd.charity_id,
        'name', cd.charity_name,
        'slug', cd.charity_slug,
        'category', cd.charity_category,
        'is_active', cd.is_active,
        'total_donations', cd.total_donations,
        'total_subscription_contributions', COALESCE(cp.total_subscription_contributions, 0),
        'total_raised', cd.total_donations + COALESCE(cp.total_subscription_contributions, 0)
      )
      ORDER BY (cd.total_donations + COALESCE(cp.total_subscription_contributions, 0)) DESC
    ), '[]'::jsonb),
    COALESCE(SUM(cd.total_donations + COALESCE(cp.total_subscription_contributions, 0)), 0)
  INTO v_charity_breakdown, v_total_charity_impact
  FROM charity_donations cd
  LEFT JOIN charity_payments cp ON cp.charity_id = cd.charity_id;

  -- Assemble unified JSON response
  v_result := jsonb_build_object(
    'users', jsonb_build_object(
      'total_users', v_total_users,
      'active_subscribers', v_active_subscribers,
      'monthly_subscribers', v_monthly_subscribers,
      'yearly_subscribers', v_yearly_subscribers
    ),
    'prize_pool', jsonb_build_object(
      'total_prize_pool', v_total_prize_pool,
      'jackpot_pending_carry_in', v_jackpot_pending,
      'effective_total_pool', v_total_prize_pool + v_jackpot_pending
    ),
    'draws', jsonb_build_object(
      'published_draws_count', v_published_draws_count,
      'tier5_winners', v_tier5_winners,
      'tier4_winners', v_tier4_winners,
      'tier3_winners', v_tier3_winners,
      'total_winners', v_tier5_winners + v_tier4_winners + v_tier3_winners,
      'total_prize_awarded', v_total_awarded,
      'total_paid_out', v_total_paid,
      'total_pending_payout', v_total_pending_payout
    ),
    'charities', jsonb_build_object(
      'total_charity_impact', v_total_charity_impact,
      'breakdown', v_charity_breakdown
    )
  );

  RETURN v_result;
END;
$$;

-- Grant execution to authenticated (function enforces is_admin inside) and service_role
REVOKE ALL ON FUNCTION public.get_admin_reports() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_reports() TO authenticated, service_role;
