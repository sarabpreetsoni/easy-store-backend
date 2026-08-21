import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { DAYS, PERIODS, indexSlots, slotKey, type TimetableData } from "@/lib/timetable";

function cellText(data: TimetableData, teacherId: string, day: string, period: string) {
  const slot = indexSlots(data.slots).get(slotKey(teacherId, day, period));
  if (!slot || !slot.class_name) return "";
  return slot.subject ? `${slot.class_name} (${slot.subject})` : slot.class_name;
}

/** Rows: one per teacher + day, columns = periods. */
export function buildTimetableRows(data: TimetableData): string[][] {
  const map = indexSlots(data.slots);
  const rows: string[][] = [];
  for (const t of data.teachers) {
    for (const day of DAYS) {
      const onLeave = data.leaves.some((l) => l.teacher_id === t.id && l.day === day);
      const cells = PERIODS.map((p) => {
        const slot = map.get(slotKey(t.id, day, p));
        const base = slot?.class_name
          ? slot.subject
            ? `${slot.class_name} (${slot.subject})`
            : slot.class_name
          : "";
        const sub = data.substitutions.find(
          (s) => s.day === day && s.period === p && s.sub_teacher_id === t.id,
        );
        const covering = sub
          ? `SUB for ${data.teachers.find((x) => x.id === sub.absent_teacher_id)?.name ?? "—"}`
          : "";
        return [base, covering].filter(Boolean).join(" / ");
      });
      rows.push([t.name, t.default_subject || "", day, onLeave ? "On leave" : "", ...cells]);
    }
  }
  return rows;
}

export const TIMETABLE_HEADERS = ["Teacher", "Subject", "Day", "Status", ...PERIODS];

function download(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function csvEscape(v: string) {
  return /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

export function exportTimetableCsv(data: TimetableData) {
  const lines = [TIMETABLE_HEADERS, ...buildTimetableRows(data)]
    .map((r) => r.map(csvEscape).join(","))
    .join("\n");
  download(
    `timetable-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([lines], { type: "text/csv;charset=utf-8;" }),
  );
}

export function exportTimetablePdf(data: TimetableData) {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  doc.setFontSize(14);
  doc.text("Timetable", 40, 32);
  doc.setFontSize(9);
  doc.text(`Generated ${new Date().toLocaleString()}`, 40, 46);

  autoTable(doc, {
    head: [TIMETABLE_HEADERS],
    body: buildTimetableRows(data),
    startY: 58,
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [15, 76, 76] },
  });

  doc.save(`timetable-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export { cellText };
