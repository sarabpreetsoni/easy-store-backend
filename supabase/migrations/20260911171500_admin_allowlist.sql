-- Admin allowlist: only these emails can authenticate and write to the timetable.
-- This enforces the restriction at the database level, independent of the frontend.

CREATE TABLE IF NOT EXISTS public.admin_allowlist (
  email TEXT PRIMARY KEY
);

-- Insert the two authorized admins
INSERT INTO public.admin_allowlist (email) VALUES
  ('sssarabsoni@gmail.com'),
  ('higgiepiggie001@gmail.com')
ON CONFLICT (email) DO NOTHING;

-- Enable RLS
ALTER TABLE public.admin_allowlist ENABLE ROW LEVEL SECURITY;

-- Anyone can read the allowlist (needed for future server-side checks)
CREATE POLICY "Public read allowlist"
  ON public.admin_allowlist FOR SELECT
  TO anon, authenticated
  USING (true);

-- Only service_role can insert/update/delete (manage via Supabase dashboard)
GRANT SELECT ON public.admin_allowlist TO anon, authenticated;
GRANT ALL ON public.admin_allowlist TO service_role;

-- ── Tighten write policies: only admins in the allowlist can write ──────────

-- teachers
DROP POLICY IF EXISTS "Authenticated can insert teachers" ON public.teachers;
DROP POLICY IF EXISTS "Authenticated can update teachers" ON public.teachers;
DROP POLICY IF EXISTS "Authenticated can delete teachers" ON public.teachers;

CREATE POLICY "Admin can insert teachers" ON public.teachers
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email())
  );

CREATE POLICY "Admin can update teachers" ON public.teachers
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()));

CREATE POLICY "Admin can delete teachers" ON public.teachers
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()));

-- schedule_slots
DROP POLICY IF EXISTS "Authenticated can insert schedule slots" ON public.schedule_slots;
DROP POLICY IF EXISTS "Authenticated can update schedule slots" ON public.schedule_slots;
DROP POLICY IF EXISTS "Authenticated can delete schedule slots" ON public.schedule_slots;

CREATE POLICY "Admin can insert schedule slots" ON public.schedule_slots
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()));

CREATE POLICY "Admin can update schedule slots" ON public.schedule_slots
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()));

CREATE POLICY "Admin can delete schedule slots" ON public.schedule_slots
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()));

-- leaves
DROP POLICY IF EXISTS "Authenticated can insert leaves" ON public.leaves;
DROP POLICY IF EXISTS "Authenticated can update leaves" ON public.leaves;
DROP POLICY IF EXISTS "Authenticated can delete leaves" ON public.leaves;

CREATE POLICY "Admin can insert leaves" ON public.leaves
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()));

CREATE POLICY "Admin can update leaves" ON public.leaves
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()));

CREATE POLICY "Admin can delete leaves" ON public.leaves
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()));

-- substitutions
DROP POLICY IF EXISTS "Authenticated can insert substitutions" ON public.substitutions;
DROP POLICY IF EXISTS "Authenticated can update substitutions" ON public.substitutions;
DROP POLICY IF EXISTS "Authenticated can delete substitutions" ON public.substitutions;

CREATE POLICY "Admin can insert substitutions" ON public.substitutions
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()));

CREATE POLICY "Admin can update substitutions" ON public.substitutions
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()));

CREATE POLICY "Admin can delete substitutions" ON public.substitutions
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()));

-- adjustment_history
DROP POLICY IF EXISTS "Anyone can manage adjustment history" ON public.adjustment_history;

CREATE POLICY "Admin can insert adjustment history" ON public.adjustment_history
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.admin_allowlist WHERE email = auth.email()));

CREATE POLICY "Anyone can view adjustment history" ON public.adjustment_history
  FOR SELECT TO anon, authenticated
  USING (true);
