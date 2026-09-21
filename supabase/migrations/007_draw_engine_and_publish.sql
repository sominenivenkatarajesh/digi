-- Migration 007: Draw Engine, Simulation Storage, and Atomic Publish
-- PRD Section 06 & 07: Draw and Reward System & Prize Pool Management

-- 1. Ensure columns on public.draws
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS draw_month DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'random';
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS winning_numbers INTEGER[];
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS pool_total NUMERIC DEFAULT 0;
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS tier5_pool NUMERIC DEFAULT 0;
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS tier4_pool NUMERIC DEFAULT 0;
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS tier3_pool NUMERIC DEFAULT 0;
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS jackpot_carried_in NUMERIC DEFAULT 0;
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS jackpot_rolled_over NUMERIC DEFAULT 0;
ALTER TABLE public.draws ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

-- Ensure check constraints on draws
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'draws_mode_check') THEN
    ALTER TABLE public.draws ADD CONSTRAINT draws_mode_check CHECK (mode IN ('random', 'algorithm'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'draws_status_check') THEN
    ALTER TABLE public.draws ADD CONSTRAINT draws_status_check CHECK (status IN ('draft', 'published'));
  END IF;
END $$;

-- Partial unique index ensuring only ONE published draw exists per draw_month
CREATE UNIQUE INDEX IF NOT EXISTS unique_published_draw_month
ON public.draws (draw_month)
WHERE status = 'published';

-- 2. Update draw_simulations table: allow simulations to exist independently before publishing
ALTER TABLE public.draw_simulations ALTER COLUMN draw_id DROP NOT NULL;
ALTER TABLE public.draw_simulations ADD COLUMN IF NOT EXISTS draw_month DATE NOT NULL DEFAULT CURRENT_DATE;
ALTER TABLE public.draw_simulations ADD COLUMN IF NOT EXISTS mode TEXT NOT NULL DEFAULT 'random';
ALTER TABLE public.draw_simulations ADD COLUMN IF NOT EXISTS winning_numbers INTEGER[];
ALTER TABLE public.draw_simulations ADD COLUMN IF NOT EXISTS result_summary JSONB;

-- 3. Ensure draw_entries columns
ALTER TABLE public.draw_entries ADD COLUMN IF NOT EXISTS scores_snapshot INTEGER[];
ALTER TABLE public.draw_entries ADD COLUMN IF NOT EXISTS match_count INTEGER DEFAULT 0;

-- 4. Ensure winners table columns and check constraints
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS tier TEXT NOT NULL DEFAULT '3';
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS prize_amount NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS verification_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pending';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'winners_tier_check') THEN
    ALTER TABLE public.winners ADD CONSTRAINT winners_tier_check CHECK (tier IN ('5', '4', '3'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'winners_verification_status_check') THEN
    ALTER TABLE public.winners ADD CONSTRAINT winners_verification_status_check CHECK (verification_status IN ('pending', 'approved', 'rejected'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'winners_payment_status_check') THEN
    ALTER TABLE public.winners ADD CONSTRAINT winners_payment_status_check CHECK (payment_status IN ('pending', 'paid'));
  END IF;
END $$;

-- 5. Atomic publish_draw function with transaction advisory lock and duplicate prevention
CREATE OR REPLACE FUNCTION public.publish_draw(
  p_draw_month DATE,
  p_mode TEXT,
  p_winning_numbers INTEGER[],
  p_pool_total NUMERIC,
  p_tier5_pool NUMERIC,
  p_tier4_pool NUMERIC,
  p_tier3_pool NUMERIC,
  p_jackpot_carried_in NUMERIC,
  p_jackpot_rolled_over NUMERIC,
  p_entries JSONB,
  p_winners JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_draw_id UUID;
  v_normalized_month DATE;
BEGIN
  -- Normalize to 1st of the month
  v_normalized_month := date_trunc('month', p_draw_month)::DATE;

  -- Take transaction-level advisory lock on this specific month
  PERFORM pg_advisory_xact_lock(hashtext('publish_draw_' || v_normalized_month::text));

  -- Check again inside the lock: reject if already published
  IF EXISTS (
    SELECT 1 FROM public.draws
    WHERE draw_month = v_normalized_month AND status = 'published'
  ) THEN
    RAISE EXCEPTION 'Draw for month % is already published', v_normalized_month
      USING ERRCODE = '23505';
  END IF;

  -- 1. Insert official draw record
  INSERT INTO public.draws (
    draw_month,
    mode,
    status,
    winning_numbers,
    pool_total,
    tier5_pool,
    tier4_pool,
    tier3_pool,
    jackpot_carried_in,
    jackpot_rolled_over,
    published_at
  ) VALUES (
    v_normalized_month,
    p_mode,
    'published',
    p_winning_numbers,
    p_pool_total,
    p_tier5_pool,
    p_tier4_pool,
    p_tier3_pool,
    p_jackpot_carried_in,
    p_jackpot_rolled_over,
    now()
  )
  RETURNING id INTO v_draw_id;

  -- 2. Insert all draw_entries atomically
  IF p_entries IS NOT NULL AND jsonb_array_length(p_entries) > 0 THEN
    INSERT INTO public.draw_entries (
      draw_id,
      user_id,
      scores_snapshot,
      match_count
    )
    SELECT
      v_draw_id,
      (entry->>'user_id')::UUID,
      ARRAY(SELECT jsonb_array_elements_text(entry->'scores_snapshot')::INT),
      COALESCE((entry->>'match_count')::INT, 0)
    FROM jsonb_array_elements(p_entries) AS entry;
  END IF;

  -- 3. Insert all winners atomically with verification_status 'pending' and payment_status 'pending'
  IF p_winners IS NOT NULL AND jsonb_array_length(p_winners) > 0 THEN
    INSERT INTO public.winners (
      draw_id,
      user_id,
      tier,
      prize_amount,
      verification_status,
      payment_status
    )
    SELECT
      v_draw_id,
      (winner->>'user_id')::UUID,
      winner->>'tier',
      (winner->>'prize_amount')::NUMERIC,
      'pending',
      'pending'
    FROM jsonb_array_elements(p_winners) AS winner;
  END IF;

  RETURN v_draw_id;
END;
$$;

-- Security: Revoke execute from public, anon, and authenticated; grant ONLY to service_role
REVOKE ALL ON FUNCTION public.publish_draw(DATE, TEXT, INTEGER[], NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_draw(DATE, TEXT, INTEGER[], NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, JSONB, JSONB) TO service_role;

-- 6. Ensure charity event dates remain in the future relative to today
UPDATE public.charity_events
SET event_date = now() + interval '14 days'
WHERE event_date < now();
