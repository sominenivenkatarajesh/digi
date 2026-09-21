-- Migration 002: Public Stats Function
-- Provides safe aggregated counts for the public homepage without exposing sensitive user or subscriber details.

CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS TABLE (
  active_subscribers BIGINT,
  active_charities BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.subscriptions WHERE status = 'active')::BIGINT AS active_subscribers,
    (SELECT COUNT(*) FROM public.charities WHERE is_active = true)::BIGINT AS active_charities;
END;
$$;

-- Grant execution privileges to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;
