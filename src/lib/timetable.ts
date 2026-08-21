import { supabase } from "@/integrations/supabase/client";

export const DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export const PERIODS = ["P1", "P2", "P3", "P4", "P5", "P6", "P7", "P8"] as const;

export type Teacher = {
  id: string;
  name: string;
  default_subject: string;
};

export type Slot = {
  id: string;
  teacher_id: string;
  day: string;
  period: string;
  class_name: string;
  subject: string;
};

export type Leave = { id: string; teacher_id: string; day: string };

export type Substitution = {
  id: string;
  day: string;
  period: string;
  absent_teacher_id: string;
  sub_teacher_id: string;
};

export type TimetableData = {
  teachers: Teacher[];
  slots: Slot[];
  leaves: Leave[];
  substitutions: Substitution[];
};

export async function fetchTimetable(): Promise<TimetableData> {
  const [teachers, slots, leaves, substitutions] = await Promise.all([
    supabase.from("teachers").select("id,name,default_subject").order("created_at"),
    supabase.from("schedule_slots").select("id,teacher_id,day,period,class_name,subject"),
    supabase.from("leaves").select("id,teacher_id,day"),
    supabase
      .from("substitutions")
      .select("id,day,period,absent_teacher_id,sub_teacher_id"),
  ]);

  const err =
    teachers.error || slots.error || leaves.error || substitutions.error;
  if (err) throw new Error(err.message);

  return {
    teachers: teachers.data ?? [],
    slots: slots.data ?? [],
    leaves: leaves.data ?? [],
    substitutions: substitutions.data ?? [],
  };
}

export function slotKey(teacherId: string, day: string, period: string) {
  return `${teacherId}|${day}|${period}`;
}

export function indexSlots(slots: Slot[]) {
  const map = new Map<string, Slot>();
  for (const s of slots) map.set(slotKey(s.teacher_id, s.day, s.period), s);
  return map;
}

/** Teachers who are free (and not overloaded) for a given day + period. */
export function getFreeTeachers(
  data: TimetableData,
  day: string,
  period: string,
): Teacher[] {
  const slotMap = indexSlots(data.slots);
  const onLeave = new Set(
    data.leaves.filter((l) => l.day === day).map((l) => l.teacher_id),
  );
  const daySubs = data.substitutions.filter((s) => s.day === day);

  return data.teachers.filter((teacher) => {
    if (onLeave.has(teacher.id)) return false;

    const slot = slotMap.get(slotKey(teacher.id, day, period));
    if (slot && slot.class_name !== "") return false;

    const alreadySubbingNow = daySubs.some(
      (s) => s.period === period && s.sub_teacher_id === teacher.id,
    );
    if (alreadySubbingNow) return false;

    const activeToday = PERIODS.filter((p) => {
      const s = slotMap.get(slotKey(teacher.id, day, p));
      return s && s.class_name !== "";
    }).length;
    const subsToday = daySubs.filter((s) => s.sub_teacher_id === teacher.id).length;
    const freePeriods = PERIODS.length - activeToday;

    return freePeriods - subsToday > 0;
  });
}
