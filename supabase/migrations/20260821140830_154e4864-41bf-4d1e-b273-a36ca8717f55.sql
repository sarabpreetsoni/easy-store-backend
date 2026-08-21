CREATE TABLE public.adjustment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day text NOT NULL,
  period text NOT NULL,
  absent_teacher_name text NOT NULL DEFAULT '',
  sub_teacher_name text NOT NULL DEFAULT '',
  class_name text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  action text NOT NULL DEFAULT 'assigned',
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adjustment_history TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.adjustment_history TO anon;
GRANT ALL ON public.adjustment_history TO service_role;

ALTER TABLE public.adjustment_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can manage adjustment history"
ON public.adjustment_history FOR ALL
TO anon, authenticated
USING (true) WITH CHECK (true);

CREATE INDEX adjustment_history_created_at_idx ON public.adjustment_history (created_at DESC);

CREATE OR REPLACE FUNCTION public.prune_adjustment_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.adjustment_history WHERE created_at < now() - interval '7 days';
  RETURN NULL;
END;
$$;

CREATE TRIGGER prune_adjustment_history_after_insert
AFTER INSERT ON public.adjustment_history
FOR EACH STATEMENT EXECUTE FUNCTION public.prune_adjustment_history();