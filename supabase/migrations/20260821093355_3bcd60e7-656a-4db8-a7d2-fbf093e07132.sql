CREATE TABLE public.teachers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  default_subject TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO anon, authenticated;
GRANT ALL ON public.teachers TO service_role;
ALTER TABLE public.teachers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage teachers" ON public.teachers FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.schedule_slots (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  period TEXT NOT NULL,
  class_name TEXT NOT NULL DEFAULT '',
  subject TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, day, period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_slots TO anon, authenticated;
GRANT ALL ON public.schedule_slots TO service_role;
ALTER TABLE public.schedule_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage schedule slots" ON public.schedule_slots FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.leaves (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, day)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaves TO anon, authenticated;
GRANT ALL ON public.leaves TO service_role;
ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage leaves" ON public.leaves FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

CREATE TABLE public.substitutions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  day TEXT NOT NULL,
  period TEXT NOT NULL,
  absent_teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  sub_teacher_id UUID NOT NULL REFERENCES public.teachers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (day, period, absent_teacher_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.substitutions TO anon, authenticated;
GRANT ALL ON public.substitutions TO service_role;
ALTER TABLE public.substitutions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can manage substitutions" ON public.substitutions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

INSERT INTO public.teachers (name, default_subject) VALUES
  ('Mr. Sharma', 'Math'),
  ('Mrs. Gupta', 'Science'),
  ('Mr. Singh', 'English');

INSERT INTO public.schedule_slots (teacher_id, day, period, class_name, subject)
SELECT t.id, d.day, p.period,
  CASE WHEN p.period IN ('P1','P2') THEN '' ELSE 'Class X' END,
  CASE WHEN p.period IN ('P1','P2') THEN '' ELSE t.default_subject END
FROM public.teachers t
CROSS JOIN (VALUES ('Monday'),('Tuesday'),('Wednesday'),('Thursday'),('Friday'),('Saturday')) AS d(day)
CROSS JOIN (VALUES ('P1'),('P2'),('P3'),('P4'),('P5'),('P6'),('P7'),('P8')) AS p(period);