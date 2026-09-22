-- Migration 004: Ensure Unique user_id on subscriptions table for idempotent upsert
-- Enforces 1-to-1 subscription per user for safe Stripe synchronization

DO $$
BEGIN
  -- If duplicate rows exist for any user, keep the most recently updated one
  DELETE FROM public.subscriptions a
  USING public.subscriptions b
  WHERE a.user_id = b.user_id
    AND a.created_at < b.created_at;

  -- Add unique constraint on user_id if not present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscriptions_user_id_key'
  ) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_user_id_key UNIQUE (user_id);
  END IF;
END $$;
