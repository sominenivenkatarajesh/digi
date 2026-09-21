-- Migration 005: Tighten RLS on public.scores
-- Enforces that INSERT, UPDATE, and DELETE operations require an active subscription (or admin)
-- SELECT remains open to the owner (and admin)

-- Drop previous write policies
DROP POLICY IF EXISTS "Users can insert own scores" ON public.scores;
DROP POLICY IF EXISTS "Users can update own scores" ON public.scores;
DROP POLICY IF EXISTS "Users can delete own scores" ON public.scores;

-- Create tightened write policies requiring has_active_subscription(auth.uid()) OR is_admin()
CREATE POLICY "Users can insert own scores"
  ON public.scores FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND (public.has_active_subscription(auth.uid()) OR public.is_admin())
  );

CREATE POLICY "Users can update own scores"
  ON public.scores FOR UPDATE
  USING (
    auth.uid() = user_id
    AND (public.has_active_subscription(auth.uid()) OR public.is_admin())
  )
  WITH CHECK (
    auth.uid() = user_id
    AND (public.has_active_subscription(auth.uid()) OR public.is_admin())
  );

CREATE POLICY "Users can delete own scores"
  ON public.scores FOR DELETE
  USING (
    auth.uid() = user_id
    AND (public.has_active_subscription(auth.uid()) OR public.is_admin())
  );
