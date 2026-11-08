import type { Request, Response } from "express";
import PDFDocument from "pdfkit";
import * as db from "../database";
import * as errors from "./admin.errors";

export async function getCurrentlyPunchedIn(req: Request, res: Response) {
  const entries = await db.listCurrentlyPunchedIn();
  return res.status(200).json(entries);
}

function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone });
    return true;
  } catch {
    return false;
  }
}

// Returns the ms offset such that `local time = utc time + offset` for the
// given IANA zone, evaluated near `atMs` (close enough to land on the right
// side of any DST transition for day-boundary math).
function getTimeZoneOffsetMs(timeZone: string, atMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(atMs));

  const map: Record<string, string> = {};

  for (const part of parts) {
    map[part.type] = part.value;
  }

  const asUtc = Date.UTC(
    Number(map.year),
    Number(map.month) - 1,
    Number(map.day),
    Number(map.hour),
    Number(map.minute),
    Number(map.second),
  );

  return asUtc - atMs;
}

function todayInTimeZone(timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseDateParam(raw: unknown, timeZone: string | null): { startMs: number; endMs: number } | null {
  const dateStr = typeof raw === "string" && raw.length > 0 ? raw : null;

  if (!timeZone) {
    // No timezone supplied - fall back to the server's own local time.
    const base = dateStr ? new Date(`${dateStr}T00:00:00`) : new Date();

    if (Number.isNaN(base.getTime())) {
      return null;
    }

    const start = new Date(base.getFullYear(), base.getMonth(), base.getDate(), 0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 1, 0, 0, 0, 0);

    return { startMs: start.getTime(), endMs: end.getTime() };
  }

  const resolvedDateStr = dateStr ?? todayInTimeZone(timeZone);
  const naiveUtcMs = new Date(`${resolvedDateStr}T00:00:00Z`).getTime();

  if (Number.isNaN(naiveUtcMs)) {
    return null;
  }

  const startMs = naiveUtcMs - getTimeZoneOffsetMs(timeZone, naiveUtcMs);
  const endMs = startMs + 24 * 60 * 60 * 1000;

  return { startMs, endMs };
}

function formatTime(ms: number | null, timeZone: string | null): string {
  if (ms === null) {
    return "--";
  }

  return new Date(ms).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    ...(timeZone ? { timeZone } : {}),
  });
}

function formatDuration(timeIn: number, timeOut: number | null): string {
  const end = timeOut ?? Date.now();
  const totalMinutes = Math.max(0, Math.round((end - timeIn) / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m${timeOut === null ? " (ongoing)" : ""}`;
}

const COLUMNS = [
  { label: "Name", width: 220 },
  { label: "Time In", width: 110 },
  { label: "Time Out", width: 110 },
  { label: "Duration", width: 120 },
];

export async function exportAttendancePdf(req: Request, res: Response) {
  const rawTimeZone = req.query.tz;
  const timeZone = typeof rawTimeZone === "string" && rawTimeZone.length > 0 ? rawTimeZone : null;

  if (timeZone && !isValidTimeZone(timeZone)) {
    return res.status(400).json(errors.MALFORMED_ATTENDANCE_EXPORT_REQUEST);
  }

  const range = parseDateParam(req.query.date, timeZone);

  if (!range) {
    return res.status(400).json(errors.MALFORMED_ATTENDANCE_EXPORT_REQUEST);
  }

  const sessions = await db.getSessionsForDateRange(range.startMs, range.endMs);
  const dateLabel = new Date(range.startMs).toLocaleDateString([], timeZone ? { timeZone } : undefined);

  const doc = new PDFDocument({ margin: 40, size: "letter" });

  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="attendance-${dateLabel.replace(/\//g, "-")}.pdf"`);

  doc.pipe(res);

  doc.fontSize(16).text(`ShopClock Attendance — ${dateLabel}`, { align: "left" });
  doc.moveDown();

  const startX = doc.page.margins.left;
  let y = doc.y;

  function drawRow(cells: string[], opts: { header?: boolean } = {}) {
    doc.fontSize(10).font(opts.header ? "Helvetica-Bold" : "Helvetica");
    let x = startX;

    for (let i = 0; i < COLUMNS.length; i++) {
      doc.text(cells[i] ?? "", x, y, { width: COLUMNS[i]!.width });
      x += COLUMNS[i]!.width;
    }

    y += 20;

    if (y > doc.page.height - doc.page.margins.bottom) {
      doc.addPage();
      y = doc.page.margins.top;
    }
  }

  drawRow(COLUMNS.map((c) => c.label), { header: true });
  doc.moveTo(startX, y - 4).lineTo(startX + 560, y - 4).stroke();

  if (sessions.length === 0) {
    doc.fontSize(10).font("Helvetica").text("No sessions recorded for this date.", startX, y);
  } else {
    for (const session of sessions) {
      drawRow([
        session.fullName,
        formatTime(session.timeIn, timeZone),
        formatTime(session.timeOut, timeZone),
        formatDuration(session.timeIn, session.timeOut),
      ]);
    }
  }

  doc.end();
}
