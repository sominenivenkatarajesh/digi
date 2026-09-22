-- Migration 008: Winner Verification, Column Security & Payout Tracking
-- Implements secure winner verification, column-level privileges, and storage bucket security

-- 1. Ensure public.winners has rejection_reason and admin_note columns
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE public.winners ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- 2. Restrict column-level UPDATE privileges on public.winners
-- Revoke all table-level UPDATE privileges from authenticated users
REVOKE UPDATE ON public.winners FROM authenticated;

-- Grant UPDATE ONLY on proof_url to authenticated users
GRANT UPDATE (proof_url) ON public.winners TO authenticated;

-- 3. Database Trigger: Second-layer defense against unauthorized column changes
CREATE OR REPLACE FUNCTION public.protect_winner_columns()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- If executed by an admin (or internal service_role), allow changes
  IF public.is_admin() OR current_user = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For non-admin authenticated users: strictly prohibit modification of any sensitive columns
  IF NEW.prize_amount IS DISTINCT FROM OLD.prize_amount OR
     NEW.tier IS DISTINCT FROM OLD.tier OR
     NEW.payment_status IS DISTINCT FROM OLD.payment_status OR
     NEW.draw_id IS DISTINCT FROM OLD.draw_id OR
     NEW.user_id IS DISTINCT FROM OLD.user_id OR
     NEW.verification_status IS DISTINCT FROM OLD.verification_status OR
     NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by OR
     NEW.reviewed_at IS DISTINCT FROM OLD.reviewed_at OR
     NEW.rejection_reason IS DISTINCT FROM OLD.rejection_reason OR
     NEW.admin_note IS DISTINCT FROM OLD.admin_note OR
     NEW.paid_at IS DISTINCT FROM OLD.paid_at THEN
    RAISE EXCEPTION 'Unauthorized: Non-admin users may only update proof_url.'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_winner_columns ON public.winners;
CREATE TRIGGER tr_protect_winner_columns
  BEFORE UPDATE ON public.winners
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_winner_columns();

-- 4. Ensure RLS Policies on public.winners
ALTER TABLE public.winners ENABLE ROW LEVEL SECURITY;

-- Users can read their own winner records; admins can read all
DROP POLICY IF EXISTS "Users can read own winners records" ON public.winners;
CREATE POLICY "Users can read own winners records"
  ON public.winners FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- Users can update proof_url for their own winning row (gated by column privileges and trigger)
DROP POLICY IF EXISTS "Users can upload proof for own win" ON public.winners;
CREATE POLICY "Users can upload proof for own win"
  ON public.winners FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Admin has full access to winners
DROP POLICY IF EXISTS "Admin can manage winners" ON public.winners;
CREATE POLICY "Admin can manage winners"
  ON public.winners FOR ALL
  TO authenticated
  USING (public.is_admin());

-- 5. Storage Policies for "winner-proofs" bucket
-- Ensure bucket exists and is strictly private
INSERT INTO storage.buckets (id, name, public)
VALUES ('winner-proofs', 'winner-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- INSERT: User can upload only into their own folder {user_id}/...
DROP POLICY IF EXISTS "Users can upload proof to own folder" ON storage.objects;
CREATE POLICY "Users can upload proof to own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'winner-proofs' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- UPDATE: User can update/replace proof only in their own folder
DROP POLICY IF EXISTS "Users can update proof in own folder" ON storage.objects;
CREATE POLICY "Users can update proof in own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'winner-proofs' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- SELECT: User can read only their own proof; admins can read any proof
DROP POLICY IF EXISTS "Users can read own proof" ON storage.objects;
CREATE POLICY "Users can read own proof"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'winner-proofs' AND
    ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

-- DELETE: User can delete only from their own folder
DROP POLICY IF EXISTS "Users can delete own proof" ON storage.objects;
CREATE POLICY "Users can delete own proof"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'winner-proofs' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ADMIN: Admin has full access to winner-proofs
DROP POLICY IF EXISTS "Admin has full access to winner-proofs" ON storage.objects;
CREATE POLICY "Admin has full access to winner-proofs"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'winner-proofs' AND public.is_admin());
