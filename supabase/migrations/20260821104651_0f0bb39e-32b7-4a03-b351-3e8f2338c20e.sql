ALTER TABLE public.teachers REPLICA IDENTITY FULL;
ALTER TABLE public.schedule_slots REPLICA IDENTITY FULL;
ALTER TABLE public.leaves REPLICA IDENTITY FULL;
ALTER TABLE public.substitutions REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.teachers;
ALTER PUBLICATION supabase_realtime ADD TABLE public.schedule_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.leaves;
ALTER PUBLICATION supabase_realtime ADD TABLE public.substitutions;