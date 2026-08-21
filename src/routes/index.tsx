import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import {
  DAYS,
  PERIODS,
  fetchAdjustmentHistory,
  fetchTimetable,
  findConflicts,
  getFreeTeachers,
  indexSlots,
  logAdjustment,
  slotKey,
  type Conflict,
  type TimetableData,
} from "@/lib/timetable";
import { exportTimetableCsv, exportTimetablePdf } from "@/lib/export";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Timetable Manager - Staff Schedules & Substitutions" },
      {
        name: "description",
        content:
          "Manage teacher timetables, mark leaves and assign substitute periods. All data is saved to the cloud and shared across devices.",
      },
      { property: "og:title", content: "Timetable Manager" },
      {
        property: "og:description",
        content:
          "Manage teacher timetables, leaves and substitutions with cloud-synced data.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

const TIMETABLE_KEY = ["timetable"];

function Index() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: TIMETABLE_KEY,
    queryFn: fetchTimetable,
  });

  const [day, setDay] = useState<string>(DAYS[0]);
  const [staffOpen, setStaffOpen] = useState(false);
  const [editorTeacher, setEditorTeacher] = useState<string | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY });

  // Live updates: refetch whenever any other user changes timetable data.
  useEffect(() => {
    const channel = supabase
      .channel("timetable-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "teachers" },
        () => queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "schedule_slots" },
        () => queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leaves" },
        () => queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY }),
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "substitutions" },
        () => queryClient.invalidateQueries({ queryKey: TIMETABLE_KEY }),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  if (error) {
    return (
      <main className="flex min-h-screen items-center justify-center p-6">
        <p className="text-sm text-destructive">
          Could not load the timetable: {(error as Error).message}
        </p>
      </main>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-16">
      <header className="sticky top-0 z-20 border-b border-border bg-primary px-4 py-3 text-primary-foreground">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-lg font-bold leading-tight">
              Timetable Manager
            </h1>
            <p className="text-[11px] opacity-80">Cloud-synced staff scheduling</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setStaffOpen(true)}>
            Staff
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-4 p-4">
        <nav className="flex gap-2 overflow-x-auto pb-1">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setDay(d)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                d === day
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground border border-border"
              }`}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </nav>

        {isLoading || !data ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            Loading timetable…
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-[20rem_1fr]">
            <StaffWorkload
              data={data}
              day={day}
              onEdit={setEditorTeacher}
              refresh={refresh}
            />
            <DayBoard data={data} day={day} refresh={refresh} />
          </div>
        )}
      </main>

      {data && (
        <>
          <StaffDialog
            open={staffOpen}
            onOpenChange={setStaffOpen}
            data={data}
            refresh={refresh}
          />
          <ScheduleEditor
            teacherId={editorTeacher}
            onClose={() => setEditorTeacher(null)}
            data={data}
            refresh={refresh}
          />
        </>
      )}
    </div>
  );
}

function Card({
  title,
  right,
  children,
}: {
  title: string;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border bg-muted px-4 py-3">
        <h2 className="font-display text-sm font-bold">{title}</h2>
        {right}
      </div>
      <div className="p-3">{children}</div>
    </section>
  );
}

function StaffWorkload({
  data,
  day,
  onEdit,
  refresh,
}: {
  data: TimetableData;
  day: string;
  onEdit: (id: string) => void;
  refresh: () => void;
}) {
  const slotMap = useMemo(() => indexSlots(data.slots), [data.slots]);
  const leaveFor = (id: string) =>
    data.leaves.find((l) => l.teacher_id === id && l.day === day);

  const toggleLeave = useMutation({
    mutationFn: async (teacherId: string) => {
      const existing = leaveFor(teacherId);
      if (existing) {
        const { error } = await supabase.from("leaves").delete().eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("leaves")
          .insert({ teacher_id: teacherId, day });
        if (error) throw error;
        await supabase
          .from("substitutions")
          .delete()
          .eq("day", day)
          .eq("sub_teacher_id", teacherId);
      }
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card
      title="Staff Workload"
      right={
        <span className="rounded-full bg-accent px-3 py-1 text-[10px] font-bold uppercase text-accent-foreground">
          {day}
        </span>
      }
    >
      <div className="space-y-2">
        {data.teachers.map((t) => {
          const classes = PERIODS.filter(
            (p) => (slotMap.get(slotKey(t.id, day, p))?.class_name ?? "") !== "",
          ).length;
          const subs = data.substitutions.filter(
            (s) => s.day === day && s.sub_teacher_id === t.id,
          ).length;
          const onLeave = Boolean(leaveFor(t.id));

          return (
            <div
              key={t.id}
              className={`rounded-xl border p-3 ${
                onLeave ? "border-destructive/40 bg-destructive/5" : "border-border"
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-display text-sm font-bold">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.default_subject || "No subject"} · {classes} classes
                    {subs > 0 ? ` · ${subs} sub` : ""}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => onEdit(t.id)}>
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    variant={onLeave ? "destructive" : "outline"}
                    onClick={() => toggleLeave.mutate(t.id)}
                  >
                    {onLeave ? "On leave" : "Leave"}
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
        {data.teachers.length === 0 && (
          <p className="p-4 text-center text-xs text-muted-foreground">
            No staff yet — add teachers from the Staff button.
          </p>
        )}
      </div>
    </Card>
  );
}

function DayBoard({
  data,
  day,
  refresh,
}: {
  data: TimetableData;
  day: string;
  refresh: () => void;
}) {
  const slotMap = useMemo(() => indexSlots(data.slots), [data.slots]);
  const onLeave = data.leaves.filter((l) => l.day === day).map((l) => l.teacher_id);
  const teacherName = (id: string) =>
    data.teachers.find((t) => t.id === id)?.name ?? "Unknown";

  const assign = useMutation({
    mutationFn: async (v: {
      period: string;
      absentId: string;
      subId: string | null;
    }) => {
      if (!v.subId) {
        const { error } = await supabase
          .from("substitutions")
          .delete()
          .eq("day", day)
          .eq("period", v.period)
          .eq("absent_teacher_id", v.absentId);
        if (error) throw error;
        return;
      }
      const { error } = await supabase.from("substitutions").upsert(
        {
          day,
          period: v.period,
          absent_teacher_id: v.absentId,
          sub_teacher_id: v.subId,
        },
        { onConflict: "day,period,absent_teacher_id" },
      );
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card title={`${day} periods`}>
      <div className="space-y-3">
        {PERIODS.map((period) => {
          const gaps = onLeave
            .map((id) => ({ id, slot: slotMap.get(slotKey(id, day, period)) }))
            .filter((g) => (g.slot?.class_name ?? "") !== "");
          const free = getFreeTeachers(data, day, period);
          const teaching = data.teachers.filter(
            (t) =>
              !onLeave.includes(t.id) &&
              (slotMap.get(slotKey(t.id, day, period))?.class_name ?? "") !== "",
          );

          return (
            <div key={period} className="rounded-xl border border-border p-3">
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-primary-foreground">
                  {period}
                </span>
                <span className="text-xs text-muted-foreground">
                  {teaching.length} teaching · {free.length} free
                </span>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {teaching.map((t) => {
                  const slot = slotMap.get(slotKey(t.id, day, period))!;
                  return (
                    <span
                      key={t.id}
                      className="rounded-lg bg-muted px-2 py-1 text-[11px]"
                    >
                      {t.name.split(" ").slice(-1)} · {slot.class_name} (
                      {slot.subject || "—"})
                    </span>
                  );
                })}
                {teaching.length === 0 && gaps.length === 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    No classes scheduled.
                  </span>
                )}
              </div>

              {gaps.map((gap) => {
                const current = data.substitutions.find(
                  (s) =>
                    s.day === day &&
                    s.period === period &&
                    s.absent_teacher_id === gap.id,
                );
                return (
                  <div
                    key={gap.id}
                    className="mt-2 rounded-lg border border-accent/60 bg-accent/15 p-2"
                  >
                    <p className="text-[11px] font-bold text-accent-foreground">
                      {teacherName(gap.id)} absent · {gap.slot!.class_name}{" "}
                      {gap.slot!.subject && `(${gap.slot!.subject})`}
                    </p>
                    <select
                      value={current?.sub_teacher_id ?? ""}
                      onChange={(e) =>
                        assign.mutate({
                          period,
                          absentId: gap.id,
                          subId: e.target.value || null,
                        })
                      }
                      className="mt-1 w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                    >
                      <option value="">Assign substitute…</option>
                      {current && (
                        <option value={current.sub_teacher_id}>
                          {teacherName(current.sub_teacher_id)} (assigned)
                        </option>
                      )}
                      {free
                        .filter((t) => t.id !== current?.sub_teacher_id)
                        .map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                    </select>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StaffDialog({
  open,
  onOpenChange,
  data,
  refresh,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: TimetableData;
  refresh: () => void;
}) {
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");

  const addTeacher = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Please enter a teacher name.");
      const { data: created, error } = await supabase
        .from("teachers")
        .insert({ name: name.trim(), default_subject: subject.trim() })
        .select("id")
        .single();
      if (error) throw error;

      const rows = DAYS.flatMap((d) =>
        PERIODS.map((p) => ({
          teacher_id: created.id,
          day: d,
          period: p,
          class_name: "",
          subject: "",
        })),
      );
      const { error: slotError } = await supabase.from("schedule_slots").insert(rows);
      if (slotError) throw slotError;
    },
    onSuccess: () => {
      setName("");
      setSubject("");
      toast.success("Teacher added");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeTeacher = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("teachers").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Teacher removed");
      refresh();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">Staff Directory</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            placeholder="Teacher name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Input
            placeholder="Default subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
          />
          <Button
            className="w-full"
            onClick={() => addTeacher.mutate()}
            disabled={addTeacher.isPending}
          >
            Add teacher
          </Button>
        </div>
        <div className="space-y-2">
          {data.teachers.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-border p-3"
            >
              <div>
                <p className="text-sm font-bold">{t.name}</p>
                <p className="text-xs text-muted-foreground">
                  {t.default_subject || "No subject"}
                </p>
              </div>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => removeTeacher.mutate(t.id)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ScheduleEditor({
  teacherId,
  onClose,
  data,
  refresh,
}: {
  teacherId: string | null;
  onClose: () => void;
  data: TimetableData;
  refresh: () => void;
}) {
  const [editDay, setEditDay] = useState<string>(DAYS[0]);
  const [draft, setDraft] = useState<Record<string, { class_name: string; subject: string }>>(
    {},
  );

  const teacher = data.teachers.find((t) => t.id === teacherId) ?? null;
  const slotMap = useMemo(() => indexSlots(data.slots), [data.slots]);

  const valueFor = (period: string) => {
    const key = `${editDay}|${period}`;
    if (draft[key]) return draft[key];
    const slot = teacher ? slotMap.get(slotKey(teacher.id, editDay, period)) : undefined;
    return { class_name: slot?.class_name ?? "", subject: slot?.subject ?? "" };
  };

  const setValue = (period: string, patch: Partial<{ class_name: string; subject: string }>) => {
    const key = `${editDay}|${period}`;
    setDraft((prev) => ({ ...prev, [key]: { ...valueFor(period), ...patch } }));
  };

  const draftRows = useMemo(
    () =>
      Object.entries(draft).map(([key, value]) => {
        const [d, p] = key.split("|");
        return {
          day: d!,
          period: p!,
          class_name: value.class_name,
          subject: value.subject,
        };
      }),
    [draft],
  );

  const conflicts: Conflict[] = useMemo(
    () => (teacher ? findConflicts(data, teacher.id, draftRows) : []),
    [data, teacher, draftRows],
  );

  const [confirmConflicts, setConfirmConflicts] = useState(false);

  const save = useMutation({
    mutationFn: async () => {
      if (!teacher) return;
      const rows = draftRows.map((r) => ({ teacher_id: teacher.id, ...r }));
      if (rows.length === 0) return;
      const { error } = await supabase
        .from("schedule_slots")
        .upsert(rows, { onConflict: "teacher_id,day,period" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Schedule saved");
      setDraft({});
      setConfirmConflicts(false);
      refresh();
      onClose();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const attemptSave = () => {
    if (conflicts.length > 0 && !confirmConflicts) {
      setConfirmConflicts(true);
      toast.warning(
        `${conflicts.length} scheduling conflict${conflicts.length > 1 ? "s" : ""} found`,
      );
      return;
    }
    save.mutate();
  };

  return (
    <Dialog
      open={Boolean(teacherId)}
      onOpenChange={(v) => {
        if (!v) {
          setDraft({});
          setConfirmConflicts(false);
          onClose();
        }
      }}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">
            {teacher?.name ?? "Schedule"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {DAYS.map((d) => (
            <button
              key={d}
              onClick={() => setEditDay(d)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold ${
                d === editDay
                  ? "bg-primary text-primary-foreground"
                  : "border border-border bg-card text-muted-foreground"
              }`}
            >
              {d.slice(0, 3)}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {PERIODS.map((p) => {
            const v = valueFor(p);
            const hasConflict = conflicts.some((c) =>
              c.message.startsWith(`${editDay} ${p}:`),
            );
            return (
              <div
                key={p}
                className={`rounded-xl border p-2 ${
                  hasConflict ? "border-destructive bg-destructive/5" : "border-border"
                }`}
              >
                <p className="mb-1 text-[10px] font-bold uppercase text-muted-foreground">
                  {p}
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Class (blank = free)"
                    value={v.class_name}
                    onChange={(e) => setValue(p, { class_name: e.target.value })}
                  />
                  <Input
                    placeholder="Subject"
                    value={v.subject}
                    onChange={(e) => setValue(p, { subject: e.target.value })}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {conflicts.length > 0 && (
          <div className="rounded-xl border border-destructive bg-destructive/10 p-3">
            <p className="text-xs font-bold text-destructive">
              {conflicts.length} conflict{conflicts.length > 1 ? "s" : ""} detected
            </p>
            <ul className="mt-1 space-y-1">
              {conflicts.map((c, i) => (
                <li key={i} className="text-[11px] text-destructive">
                  • {c.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        <Button
          onClick={attemptSave}
          disabled={save.isPending}
          variant={conflicts.length > 0 && confirmConflicts ? "destructive" : "default"}
        >
          {conflicts.length > 0
            ? confirmConflicts
              ? "Save anyway"
              : "Check & save schedule"
            : "Save schedule"}
        </Button>

      </DialogContent>
    </Dialog>
  );
}
