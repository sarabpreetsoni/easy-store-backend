import {
  DAYS,
  PERIODS,
  indexSlots,
  slotKey,
  type TimetableData,
  type AdjustmentHistoryEntry,
} from "@/lib/timetable";

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

export type DayGroupedHistory = {
  day: string;
  entries: AdjustmentHistoryEntry[];
  assignedCount: number;
  removedCount: number;
};

/** Group history entries day-wise in order of the timetable week */
export function groupHistoryByDay(history: AdjustmentHistoryEntry[]): DayGroupedHistory[] {
  const map = new Map<string, AdjustmentHistoryEntry[]>();
  for (const h of history) {
    if (!map.has(h.day)) map.set(h.day, []);
    map.get(h.day)!.push(h);
  }

  const dayOrder = new Map<string, number>(DAYS.map((d, idx) => [d, idx]));

  return Array.from(map.entries())
    .sort(([dayA, entriesA], [dayB, entriesB]) => {
      const orderA = dayOrder.has(dayA) ? dayOrder.get(dayA)! : 999;
      const orderB = dayOrder.has(dayB) ? dayOrder.get(dayB)! : 999;
      if (orderA !== orderB) return orderA - orderB;
      const latestA = new Date(entriesA[0]?.created_at ?? 0).getTime();
      const latestB = new Date(entriesB[0]?.created_at ?? 0).getTime();
      return latestB - latestA;
    })
    .map(([day, entries]) => ({
      day,
      entries,
      assignedCount: entries.filter((e) => e.action === "assigned").length,
      removedCount: entries.filter((e) => e.action === "removed").length,
    }));
}

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

/** Formats day-wise grouped adjustment history for CSV export */
export function buildAdjustmentHistoryCsvLines(history?: AdjustmentHistoryEntry[]): string[] {
  if (!history || history.length === 0) {
    return [
      "",
      "================================================================================",
      "ADJUSTMENT HISTORY (LAST 7 DAYS)",
      "================================================================================",
      "No adjustments recorded in the last 7 days.",
    ];
  }

  const grouped = groupHistoryByDay(history);
  const lines: string[] = [
    "",
    "================================================================================",
    "ADJUSTMENT HISTORY — DAY-WISE GROUPING (LAST 7 DAYS)",
    "================================================================================",
  ];

  for (const group of grouped) {
    lines.push("");
    lines.push(
      `--- [DAY: ${group.day.toUpperCase()}] (${group.entries.length} changes: ${group.assignedCount} assigned, ${group.removedCount} removed) ---`,
    );
    lines.push(
      [
        "Day",
        "Period",
        "Action",
        "Class",
        "Subject",
        "Absent Teacher",
        "Substitute Teacher",
        "Summary",
        "Timestamp",
      ]
        .map(csvEscape)
        .join(","),
    );

    for (const h of group.entries) {
      const summary =
        h.action === "removed"
          ? `Cover removed for ${h.absent_teacher_name}${h.sub_teacher_name ? ` (was ${h.sub_teacher_name})` : ""}`
          : `${h.sub_teacher_name} covering for ${h.absent_teacher_name}`;
      const dateStr = new Date(h.created_at).toLocaleString();

      lines.push(
        [
          h.day,
          h.period,
          h.action.toUpperCase(),
          h.class_name || "—",
          h.subject || "—",
          h.absent_teacher_name,
          h.sub_teacher_name || "—",
          summary,
          dateStr,
        ]
          .map(csvEscape)
          .join(","),
      );
    }
  }

  return lines;
}

/** Exports timetable and day-wise grouped adjustment history in CSV */
export function exportTimetableCsv(data: TimetableData, history?: AdjustmentHistoryEntry[]) {
  const timetableSection = [
    "================================================================================",
    "TIMETABLE SCHEDULE",
    "================================================================================",
    TIMETABLE_HEADERS.map(csvEscape).join(","),
    ...buildTimetableRows(data).map((r) => r.map(csvEscape).join(",")),
  ];

  const historySection = buildAdjustmentHistoryCsvLines(history);
  const fullCsv = [...timetableSection, ...historySection].join("\n");

  download(
    `timetable-and-history-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([fullCsv], { type: "text/csv;charset=utf-8;" }),
  );
}

/** Standalone export for just day-wise grouped adjustment history in CSV */
export function exportHistoryCsv(history: AdjustmentHistoryEntry[]) {
  const lines = buildAdjustmentHistoryCsvLines(history);
  download(
    `adjustment-history-${new Date().toISOString().slice(0, 10)}.csv`,
    new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" }),
  );
}

const HISTORY_HEADERS = [
  "Period",
  "Action",
  "Class",
  "Subject",
  "Absent Teacher",
  "Substitute Teacher",
  "Details / Note",
  "Date & Time",
];

/** Exports timetable and day-wise grouped adjustment history into a PDF */
export async function exportTimetablePdf(data: TimetableData, history?: AdjustmentHistoryEntry[]) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();

  // Header Banner
  doc.setFontSize(16);
  doc.setTextColor(15, 76, 76);
  doc.text("Timetable Manager", 40, 32);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generated: ${new Date().toLocaleString()}  |  Weekly Schedule & Day-Wise Adjustment History`,
    40,
    46,
  );

  // Section 1: Timetable Schedule
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text("Weekly Timetable Schedule", 40, 64);

  autoTable(doc, {
    head: [TIMETABLE_HEADERS],
    body: buildTimetableRows(data),
    startY: 72,
    styles: { fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: [15, 76, 76], textColor: [255, 255, 255] },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // Section 2: Adjustment History (Day-Wise Grouped)
  let currentY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 200) + 24;

  if (currentY > pageHeight - 160) {
    doc.addPage();
    currentY = 40;
  }

  doc.setFontSize(14);
  doc.setTextColor(15, 76, 76);
  doc.text("Adjustment History (Day-Wise Grouping)", 40, currentY);
  currentY += 15;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    "Log of substitutions and schedule modifications for the last 7 days, grouped by day.",
    40,
    currentY,
  );
  currentY += 14;

  if (!history || history.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text("No adjustments recorded in the last 7 days.", 40, currentY + 12);
  } else {
    const grouped = groupHistoryByDay(history);

    for (const group of grouped) {
      if (currentY > pageHeight - 110) {
        doc.addPage();
        currentY = 40;
      }

      // Day group banner
      doc.setFontSize(11);
      doc.setTextColor(15, 76, 76);
      doc.text(
        `● ${group.day} — ${group.entries.length} change${group.entries.length === 1 ? "" : "s"} (${group.assignedCount} assigned, ${group.removedCount} removed)`,
        40,
        currentY + 10,
      );
      currentY += 16;

      const groupRows = group.entries.map((h) => {
        const summary =
          h.action === "removed"
            ? `Cover removed for ${h.absent_teacher_name}${h.sub_teacher_name ? ` (was ${h.sub_teacher_name})` : ""}`
            : `${h.sub_teacher_name} covering for ${h.absent_teacher_name}`;
        const dateStr = new Date(h.created_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return [
          h.period,
          h.action.toUpperCase(),
          h.class_name || "—",
          h.subject || "—",
          h.absent_teacher_name,
          h.sub_teacher_name || "—",
          summary,
          dateStr,
        ];
      });

      autoTable(doc, {
        head: [HISTORY_HEADERS],
        body: groupRows,
        startY: currentY,
        styles: { fontSize: 7, cellPadding: 3 },
        headStyles: { fillColor: [44, 122, 123], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 55, fontStyle: "bold" },
          2: { cellWidth: 50 },
          3: { cellWidth: 60 },
          4: { cellWidth: 100 },
          5: { cellWidth: 100 },
          6: { cellWidth: 190 },
          7: { cellWidth: 85 },
        },
        didParseCell: (hookData: { section: string; column: { index: number }; cell: { raw: unknown; styles: { textColor?: [number, number, number] } } }) => {
          if (hookData.section === "body" && hookData.column.index === 1) {
            const val = hookData.cell.raw;
            if (val === "ASSIGNED") {
              hookData.cell.styles.textColor = [16, 120, 60];
            } else if (val === "REMOVED") {
              hookData.cell.styles.textColor = [185, 28, 28];
            }
          }
        },
      });

      currentY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? currentY) + 18;
    }
  }

  doc.save(`timetable-and-history-${new Date().toISOString().slice(0, 10)}.pdf`);
}

/** Standalone export for just day-wise grouped adjustment history into a PDF */
export async function exportHistoryPdf(history: AdjustmentHistoryEntry[]) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([
    import("jspdf"),
    import("jspdf-autotable"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFontSize(16);
  doc.setTextColor(15, 76, 76);
  doc.text("Adjustment History (Day-Wise Grouping)", 40, 32);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text(
    `Generated: ${new Date().toLocaleString()}  |  Last 7 Days Staff Substitutions and Leaves`,
    40,
    46,
  );

  let currentY = 64;

  if (!history || history.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text("No adjustments recorded in the last 7 days.", 40, currentY + 20);
  } else {
    const grouped = groupHistoryByDay(history);

    for (const group of grouped) {
      if (currentY > pageHeight - 110) {
        doc.addPage();
        currentY = 40;
      }

      doc.setFontSize(11);
      doc.setTextColor(15, 76, 76);
      doc.text(
        `● ${group.day} — ${group.entries.length} change${group.entries.length === 1 ? "" : "s"} (${group.assignedCount} assigned, ${group.removedCount} removed)`,
        40,
        currentY + 10,
      );
      currentY += 16;

      const groupRows = group.entries.map((h) => {
        const summary =
          h.action === "removed"
            ? `Cover removed for ${h.absent_teacher_name}${h.sub_teacher_name ? ` (was ${h.sub_teacher_name})` : ""}`
            : `${h.sub_teacher_name} covering for ${h.absent_teacher_name}`;
        const dateStr = new Date(h.created_at).toLocaleString(undefined, {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        return [
          h.period,
          h.action.toUpperCase(),
          h.class_name || "—",
          h.subject || "—",
          h.absent_teacher_name,
          h.sub_teacher_name || "—",
          summary,
          dateStr,
        ];
      });

      autoTable(doc, {
        head: [HISTORY_HEADERS],
        body: groupRows,
        startY: currentY,
        styles: { fontSize: 7, cellPadding: 3 },
        headStyles: { fillColor: [44, 122, 123], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 35 },
          1: { cellWidth: 55, fontStyle: "bold" },
          2: { cellWidth: 50 },
          3: { cellWidth: 60 },
          4: { cellWidth: 100 },
          5: { cellWidth: 100 },
          6: { cellWidth: 190 },
          7: { cellWidth: 85 },
        },
        didParseCell: (hookData: { section: string; column: { index: number }; cell: { raw: unknown; styles: { textColor?: [number, number, number] } } }) => {
          if (hookData.section === "body" && hookData.column.index === 1) {
            const val = hookData.cell.raw;
            if (val === "ASSIGNED") {
              hookData.cell.styles.textColor = [16, 120, 60];
            } else if (val === "REMOVED") {
              hookData.cell.styles.textColor = [185, 28, 28];
            }
          }
        },
      });

      currentY = ((doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? currentY) + 18;
    }
  }

  doc.save(`adjustment-history-${new Date().toISOString().slice(0, 10)}.pdf`);
}

export { cellText };
