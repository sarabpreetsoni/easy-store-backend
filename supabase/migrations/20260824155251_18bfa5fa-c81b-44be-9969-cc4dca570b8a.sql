-- teachers
DROP POLICY IF EXISTS "Anyone can manage teachers" ON public.teachers;
CREATE POLICY "Anyone can view teachers" ON public.teachers FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can insert teachers" ON public.teachers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update teachers" ON public.teachers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete teachers" ON public.teachers FOR DELETE TO authenticated USING (true);

-- schedule_slots
DROP POLICY IF EXISTS "Anyone can manage schedule slots" ON public.schedule_slots;
CREATE POLICY "Anyone can view schedule slots" ON public.schedule_slots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can insert schedule slots" ON public.schedule_slots FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update schedule slots" ON public.schedule_slots FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete schedule slots" ON public.schedule_slots FOR DELETE TO authenticated USING (true);

-- leaves
DROP POLICY IF EXISTS "Anyone can manage leaves" ON public.leaves;
CREATE POLICY "Anyone can view leaves" ON public.leaves FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can insert leaves" ON public.leaves FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update leaves" ON public.leaves FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete leaves" ON public.leaves FOR DELETE TO authenticated USING (true);

-- substitutions
DROP POLICY IF EXISTS "Anyone can manage substitutions" ON public.substitutions;
CREATE POLICY "Anyone can view substitutions" ON public.substitutions FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Authenticated can insert substitutions" ON public.substitutions FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update substitutions" ON public.substitutions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete substitutions" ON public.substitutions FOR DELETE TO authenticated USING (true);

REVOKE INSERT, UPDATE, DELETE ON public.teachers FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.schedule_slots FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.leaves FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.substitutions FROM anon;

GRANT SELECT ON public.teachers TO anon;
GRANT SELECT ON public.schedule_slots TO anon;
GRANT SELECT ON public.leaves TO anon;
GRANT SELECT ON public.substitutions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_slots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaves TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.substitutions TO authenticated;
GRANT ALL ON public.teachers TO service_role;
GRANT ALL ON public.schedule_slots TO service_role;
GRANT ALL ON public.leaves TO service_role;
GRANT ALL ON public.substitutions TO service_role;